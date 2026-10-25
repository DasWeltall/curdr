"""Opt-in Expo push, persisted devices/outbox and private notification bodies.

A release build with FCM credentials is required. This worker makes no model
calls. App-active leases suppress pushes; quiet hours hold work until wake.
"""
import asyncio,json,os,re,time
from datetime import datetime,timezone
from zoneinfo import ZoneInfo,ZoneInfoNotFoundError
import httpx
from fastapi import Depends,HTTPException
from pydantic import BaseModel,Field

TOKEN=re.compile(r'^(?:ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]{10,200}\]$')
class Device(BaseModel):
    id:str=Field(pattern=r'^[a-zA-Z0-9_-]{16,100}$')
    token:str=Field(max_length=240)
    active:bool=False
class Presence(BaseModel):
    active:bool

def enabled():return os.getenv('CURDR_PUSH_ENABLED','').lower() in ('1','true','yes')
def awake(settings,clock):
    if settings.get('sleeping'):return False
    try:local=datetime.fromtimestamp(clock,timezone.utc).astimezone(ZoneInfo(settings.get('timezone','Europe/Berlin')))
    except ZoneInfoNotFoundError:return False
    return not settings.get('quiet') or 7<=local.hour<22

def attention(db,event):
    kind,data=event.get('type'),event.get('data') or {}
    if not isinstance(data,dict):return None
    channel=data.get('channel','main')
    if kind=='approval' and data.get('state')=='pending':
        current=db.get('approvals',data['id']) or {}
        if current.get('state')!='pending':return None
        expiry=current.get('expiresAt')
        if expiry:
            try:
                if datetime.fromisoformat(expiry).timestamp()<=time.time():return None
            except ValueError:return None
        return 'approval:'+data['id'],'A decision needs you',{'channel':channel,'approvalId':data['id']}
    if kind=='task_update' and data.get('status') in ('review','need'):
        current=db.get('tasks',data['id']) or {}
        if current.get('status')!=data['status']:return None
        return 'task:'+data['id']+':'+data['status'],'Work is ready for review' if data['status']=='review' else 'Your input is needed',{'channel':channel,'taskId':data['id']}
    if kind=='message' and data.get('role')=='agent' and not data.get('streaming') and not data.get('failed') and data.get('kind') in ('text','artifact','result','brief'):
        return 'message:'+data['id'],'An update is ready',{'channel':channel,'messageId':data['id']}
    return None

class PushService:
    def __init__(self,db,client=None):self.db=db;self.client=client
    def remove(self,id):
        with self.db.lock:
            self.db.conn.execute("DELETE FROM objects WHERE kind='push_devices' AND id=?",(id,))
            self.db.conn.execute("DELETE FROM objects WHERE kind='push_outbox' AND id=?",(id,))
    async def tick(self,clock=None):
        if not enabled():return
        clock=clock or time.time();db=self.db
        if not awake(db.get('settings','main'),clock):return
        # Receipts must never block a device's next decision/result notification.
        receipts=[r for r in db.all('push_receipts') if r.get('next',0)<=clock][:100]
        if receipts:
            response=await self.send('/getReceipts',{'ids':[r['id'] for r in receipts]})
            results=(response or {}).get('data',{})
            for receipt in receipts:
                result=results.get(receipt['id']);device=db.get('push_devices',receipt['device'])
                if result and result.get('details',{}).get('error')=='DeviceNotRegistered' and device and device['token']==receipt['token']:self.remove(device['id'])
                if result or not device or clock-receipt['created']>86400:db.conn.execute("DELETE FROM objects WHERE kind='push_receipts' AND id=?",(receipt['id'],))
                else:db.put('push_receipts',receipt['id'],{**receipt,'next':clock+900})
        for device in db.all('push_devices'):
            id=device['id'];pending=db.get('push_outbox',id)
            if clock-device.get('updated',0)>90*86400:self.remove(id);continue
            if device.get('activeUntil',0)>clock:
                _,seq=db.snapshot();db.put('push_devices',id,{**device,'cursor':seq});db.conn.execute("DELETE FROM objects WHERE kind='push_outbox' AND id=?",(id,));continue
            if not pending:
                events=db.events_after(device.get('cursor',0))
                if not events:continue
                candidates=[];seen=device.get('seen',[])
                for seq,raw in events:
                    item=attention(db,json.loads(raw))
                    if item and item[0] not in seen:candidates.append(item);seen.append(item[0])
                if candidates:
                    _,title,data=candidates[-1]
                    pending={'id':id,'cursor':events[-1][0],'seen':seen[-200:],'created':clock,'attempts':0,'payload':{'to':device['token'],'title':'curdr','body':title if len(candidates)==1 else 'Updates are ready for you','data':data,'sound':'default','channelId':'attention','ttl':3600}}
                    db.put('push_outbox',id,pending)
                else:db.put('push_devices',id,{**device,'cursor':events[-1][0]});continue
            if pending.get('next',0)>clock:continue
            if clock-pending['created']>86400 or pending.get('attempts',0)>=6:
                db.put('push_devices',id,{**device,'cursor':pending['cursor'],'seen':pending['seen']});db.conn.execute("DELETE FROM objects WHERE kind='push_outbox' AND id=?",(id,));continue
            # Re-check state after a quiet period/retry; resolved requests must not ring.
            payload_data=pending['payload']['data']
            approval_id=payload_data.get('approvalId');task_id=payload_data.get('taskId')
            obsolete=(approval_id and (db.get('approvals',approval_id) or {}).get('state')!='pending') or (task_id and (db.get('tasks',task_id) or {}).get('status') not in ('review','need'))
            if obsolete:
                db.put('push_devices',id,{**device,'cursor':pending['cursor'],'seen':pending['seen']});db.conn.execute("DELETE FROM objects WHERE kind='push_outbox' AND id=?",(id,));continue
            response=await self.send('/send',pending['payload']);ticket=(response or {}).get('data',{})
            if (db.get('push_devices',id) or {}).get('token')!=device['token']:continue
            if ticket.get('details',{}).get('error')=='DeviceNotRegistered':self.remove(id);continue
            if ticket.get('status')=='ok' and ticket.get('id'):
                db.put('push_devices',id,{**device,'cursor':pending['cursor'],'seen':pending['seen']})
                db.put('push_receipts',ticket['id'],{'id':ticket['id'],'device':id,'token':device['token'],'created':clock,'next':clock+900})
                db.conn.execute("DELETE FROM objects WHERE kind='push_outbox' AND id=?",(id,))
            else:
                attempts=pending.get('attempts',0)+1
                db.put('push_outbox',id,{**pending,'attempts':attempts,'next':clock+min(900,15*2**attempts)})
    async def send(self,path,body):
        headers={}
        if os.getenv('EXPO_ACCESS_TOKEN'):headers['Authorization']='Bearer '+os.environ['EXPO_ACCESS_TOKEN']
        try:
            if self.client:response=await self.client.post('https://exp.host/--/api/v2/push'+path,json=body,headers=headers)
            else:
                async with httpx.AsyncClient(timeout=15) as client:response=await client.post('https://exp.host/--/api/v2/push'+path,json=body,headers=headers)
            response.raise_for_status();return response.json()
        except (httpx.HTTPError,ValueError):return None
    async def monitor(self):
        while True:
            try:await self.tick()
            except Exception:pass # keep the scheduler alive; tokens never enter logs
            await asyncio.sleep(5)

def register(app,db,auth,service):
    @app.get('/notifications',dependencies=[Depends(auth)])
    async def status():return {'enabled':enabled(),'provider':'expo','devices':len(db.all('push_devices'))}
    @app.post('/notifications/devices',dependencies=[Depends(auth)])
    async def device(body:Device):
        if not enabled():raise HTTPException(409,'Enable CURDR_PUSH_ENABLED on the gateway after configuring Android push credentials.')
        if not TOKEN.fullmatch(body.token):raise HTTPException(422,'Invalid Expo push token.')
        old=db.get('push_devices',body.id) or {};_,seq=db.snapshot()
        # A changed token starts from now; never send an old owner's backlog.
        same=old.get('token')==body.token
        if not same:service.remove(body.id)
        for other in db.all('push_devices'):
            if other['id']!=body.id and other['token']==body.token:service.remove(other['id'])
        db.put('push_devices',body.id,{'id':body.id,'token':body.token,'cursor':old.get('cursor',seq) if same else seq,'seen':old.get('seen',[]) if same else [],'activeUntil':time.time()+60 if body.active else 0,'updated':time.time()})
        return {'ok':True}
    @app.post('/notifications/devices/{id}/presence',dependencies=[Depends(auth)])
    async def presence(id:str,body:Presence):
        old=db.get('push_devices',id)
        if not old:raise HTTPException(404,'Device is not registered.')
        db.put('push_devices',id,{**old,'activeUntil':time.time()+60 if body.active else 0,'updated':time.time()});return {'ok':True}
    @app.post('/notifications/devices/{id}/remove',dependencies=[Depends(auth)])
    async def remove(id:str):service.remove(id);return {'ok':True}
