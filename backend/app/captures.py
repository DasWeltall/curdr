"""Durable brain-dump jobs, owned by the gateway rather than an open screen."""
import asyncio
import base64
import json
import time
from .db import now,uid
from .errors import public_text,upstream_http_error
from .channels import workspace_context
import httpx

ACTIVE={'queued','transcribing','planning'}

class CapturePlanner:
    def __init__(self,db,runtime,runner,queue):
        self.db,self.runtime,self.runner=db,runtime,runner
        self.queue=asyncio.Semaphore(1)
        self.workers={}

    def publish(self,id,**patch):
        value={**self.db.get('brain_dumps',id),**patch,'updatedAt':now()}
        self.db.event('capture',value)
        return value

    def create(self,text='',audio=None,identity=None):
        id=identity or uid();existing=self.db.get('brain_dumps',id)
        if existing:
            if existing.get('inputText',existing.get('text',''))!=text or existing.get('audioFileId')!=(audio or {}).get('id'):
                raise ValueError('This capture identity was already used for different content.')
            return existing
        value=dict(id=id,text=text,inputText=text,status='queued',phase='Waiting for Hermes',createdAt=now(),updatedAt=now(),drafts=[],activities=[],dismissed=False)
        if audio:
            self.db.event('file_added',audio);value['audioFileId']=audio['id']
        self.db.event('capture',value)
        self.launch(id)
        return value

    def saved(self,capture_id,draft_id):
        capture=self.db.get('brain_dumps',capture_id) if capture_id else None
        if capture and draft_id not in capture.get('saved',[]):self.publish(capture_id,saved=[*capture.get('saved',[]),draft_id])

    def launch(self,id):
        if id not in self.workers:
            task=asyncio.create_task(self.work(id));self.workers[id]=task
            task.add_done_callback(lambda task:self.workers.pop(id,None))

    async def progress(self,id,event):
        kind=event.get('event','');patch={}
        if event.get('run_id') and event['run_id']!=(self.db.get('brain_dumps',id) or {}).get('runId'):patch['runId']=event['run_id']
        if kind=='run.created':patch['phase']='Queued in Hermes'
        elif kind in ('run.running','run.started'):patch['phase']='Planning your next steps'
        elif kind.startswith('tool.'):
            name=public_text(event.get('tool') or event.get('tool_name') or 'Tool',100).replace('_',' ')
            patch['phase']=name.capitalize() if kind=='tool.started' else 'Planning your next steps'
            entries=list((self.db.get('brain_dumps',id) or {}).get('activities',[]))
            entries.append(dict(id=uid(),title=name.capitalize(),detail=public_text(event.get('preview',''),400),state=kind,at=now()))
            patch['activities']=entries[-20:]
        elif kind in ('approval.request','clarify.request'):patch['phase']='Waiting for your input'
        elif kind in ('approval.responded','approval.settled','clarify.settled'):patch['phase']='Planning your next steps'
        # Never expose hidden reasoning or a fake progress percentage.
        if patch:self.publish(id,**patch)

    async def work(self,id):
        try:
            async with self.queue:
                capture=self.db.get('brain_dumps',id);text=capture['text']
                if self.db.get('settings','main').get('sleeping'):raise ValueError('Your assistant is resting. This brain dump is saved; wake it before trying again.')
                if capture.get('audioFileId') and not capture.get('transcribed'):
                    self.publish(id,status='transcribing',phase='Transcribing your recording')
                    file=self.db.get('files',capture['audioFileId'])
                    transcript=await self.runner.transcribe(base64.b64decode(file['base64']),file['name'])
                    text='\n'.join(part for part in (capture.get('inputText',''),transcript) if part)
                    self.publish(id,text=text,transcribed=True)
                if self.db.get('settings','main').get('sleeping'):raise ValueError('Your assistant is resting. The transcript is saved; wake it before making the plan.')
                self.publish(id,status='planning',phase='Connecting to Hermes')
                channel='capture-'+id[:24]
                output=await self.runtime.ask(text,self.db.get('settings','main'),purpose='braindump',channel=channel,workspace=workspace_context(self.db,'main'),capture_id=id,on_progress=lambda event:self.progress(id,event))
                from .runner import parse_drafts
                drafts=[{**draft,'captureId':id} for draft in parse_drafts(output)]
                with self.db.lock:
                    for draft in drafts:self.db.conn.execute('INSERT OR IGNORE INTO drafts VALUES(?,?,?,NULL)',(draft['id'],json.dumps(draft),time.time()))
                self.publish(id,status='ready',phase='Ready to review',drafts=drafts,error=None)
        except asyncio.CancelledError:
            # An admitted Hermes run is not replayed automatically after interruption.
            self.publish(id,status='interrupted',phase='Planning interrupted',error='The gateway restarted. Inspect the previous run before trying again.')
            raise
        except Exception as error:
            detail=upstream_http_error(error).detail if isinstance(error,httpx.HTTPStatusError) else {'message':public_text(error),'code':getattr(error,'code','capture_failed')}
            self.publish(id,status='failed',phase='Needs attention',error=detail['message'],errorCode=detail['code'])

    def recover(self):
        for capture in self.db.all('brain_dumps'):
            if capture.get('status')=='queued':self.launch(capture['id'])
            elif capture.get('status') in ACTIVE:
                self.publish(capture['id'],status='interrupted',phase='Planning interrupted',error='The gateway restarted. The last run was not automatically replayed.')

    async def close(self):
        tasks=list(self.workers.values())
        for task in tasks:task.cancel()
        await asyncio.gather(*tasks,return_exceptions=True)
