"""Translate actual Hermes runs into durable curdr UI state. No simulated progress."""
import asyncio
import base64
import hashlib
import json
import mimetypes
import os
from pathlib import Path
import re
import time
from datetime import datetime,timedelta,timezone
import httpx
from itertools import islice
from .db import uid,now
from .visuals import store_response,extract_visual

TERMINAL={'completed','failed','cancelled','interrupted','unknown','partial'}

def safe_text(value,limit=3000):
    text=str(value or '')
    text=re.sub(r'(?i)(bearer\s+)[a-z0-9._~+/=-]+',r'\1[redacted]',text)
    text=re.sub(r'(?i)((?:api[_-]?key|access[_-]?token|password|secret)\s*[=:]\s*)[^\s,;]+',r'\1[redacted]',text)
    return text[:limit]+('… [truncated]' if len(text)>limit else '')

class LiveRuntime:
    def __init__(self,db,runner):
        self.db,self.runner=db,runner
        self.adapter=getattr(runner,'existing',None)
        self.closing=False;self.active_run={};self.partial={};self.text={};self.last_flush={};self.watchers={}
        self.root=Path(os.environ['CURDR_WORKSPACE_DIR']).expanduser().resolve() if os.getenv('CURDR_WORKSPACE_DIR') else None
        if self.root:self.root.mkdir(parents=True,exist_ok=True)

    async def refresh(self):
        if not self.adapter:return None
        try:
            info=await self.adapter.discover()
            skills=info.pop('skills',[])
            mapped=[dict(id='hermes:'+str(s.get('name','')),title=str(s.get('name','Skill')),description=safe_text(s.get('description',''),2000),category=str(s.get('category','')),source='Hermes',enabled=s.get('enabled',not s.get('disabled',False)),readOnly=True) for s in skills]
            self.db.event('skills',mapped)
            if self.root:info['workspace']=str(self.root)
            self.db.event('hermes',info)
            self.scan_files()
            return info
        except (httpx.HTTPError,ValueError,OSError) as error:
            from .errors import upstream_http_error,public_text
            diagnostic=upstream_http_error(error).detail if isinstance(error,httpx.HTTPStatusError) else {'code':'hermes_unreachable','message':public_text(str(error)) or 'Could not refresh Hermes.'}
            old=self.db.get('meta','hermes') or {}
            info={**old,'connected':False,'error':diagnostic['message']+' ('+diagnostic['code']+')'}
            self.db.event('hermes',info);return info

    def scan_files(self,channel='main'):
        if not self.root:return
        allowed={'.png','.jpg','.jpeg','.webp','.gif','.pdf','.txt','.md','.csv','.json','.html','.svg','.zip','.pptx','.xlsx','.docx'}
        for path in islice(self.root.rglob('*'),500):
            try:
                if path.is_symlink() or not path.is_file() or path.suffix.lower() not in allowed:continue
                resolved=path.resolve()
                if self.root not in resolved.parents or any(p.startswith('.') for p in path.relative_to(self.root).parts) or path.relative_to(self.root).parts[0]=='uploads':continue
                size=path.stat().st_size
                if size>10*1024*1024:continue
                relative=path.relative_to(self.root).as_posix()
                id='workspace-'+hashlib.sha256(relative.encode()).hexdigest()[:24]
                modified=path.stat().st_mtime_ns
                old=self.db.get('meta','file:'+id)
                if old and old.get('modified')==modified:continue
                data=path.read_bytes();mime=mimetypes.guess_type(path.name)[0] or 'application/octet-stream'
                file=dict(id=id,name=relative,channel=(old or {}).get('channel',channel),updatedAt=now(),mime=mime,size=len(data),base64=base64.b64encode(data).decode(),origin='hermes')
                if mime.startswith('text/') or path.suffix in ('.md','.json','.csv'):file['content']=data.decode('utf-8',errors='replace')
                self.db.event('file_added',file)
                self.db.put('meta','file:'+id,{'modified':modified,'channel':file['channel']})
            except OSError:continue

    def flush(self,channel,failed=None,complete=False):
        id=self.partial.get(channel);text=self.text.get(channel,'')
        if not id or not text:return
        previous=self.db.get('messages',id) or {}
        self.db.event('message',dict(id=id,role='agent',kind='text',text=text,channel=channel,createdAt=previous.get('createdAt',now()),runId=self.active_run.get(channel),streaming=not complete,**({'failed':failed} if failed else {})))
        self.last_flush[channel]=time.monotonic()

    async def event(self,event,channel='main',task_id=None):
        kind=event.get('event','');id=event.get('run_id')
        if not isinstance(id,str):return
        run=self.db.get('runs',id) or dict(id=id,channel=channel,status='queued',detail='Queued',startedAt=now(),updatedAt=now(),activities=[],taskId=task_id,title=event.get('input_preview') or 'Hermes request')
        sequence=event.get('seq',event.get('_id'))
        if sequence is not None:
            try:
                sequence=int(sequence)
                if sequence<=run.get('lastSeq',-1):return
                run['lastSeq']=sequence
            except (ValueError,TypeError):pass
        if kind=='run.created':self.active_run[channel]=id
        if event.get('session_id'):
            run['sessionId']=event['session_id'];self.db.put('meta','session:'+channel,{'id':event['session_id']})
        if kind in ('message.delta','assistant.delta'):
            if self.active_run.get(channel) not in (None,id):return
            self.active_run[channel]=id
            self.partial.setdefault(channel,uid());self.text[channel]=self.text.get(channel,'')+str(event.get('delta',''))
            self.flush(channel)
            if run['status']!='responding':run.update(status='responding',detail='Writing a reply')
        elif kind in ('subagent.start','subagent.complete'):
            child=event.get('child_session_id') or event.get('subagent_id')
            if child:
                child_id='hermes-'+str(child)
                existing=self.db.get('tasks',child_id) or {}
                done=kind=='subagent.complete'
                failed=event.get('status') in ('failed','cancelled','error')
                task=dict(id=child_id,title=safe_text(event.get('goal') or existing.get('title') or 'Hermes subagent',160),sub=safe_text(event.get('summary') or existing.get('sub','')),channel=channel,status='need' if failed else 'review' if done else 'run',source='chat',summary=safe_text(event.get('summary') or ('Ready for review' if done else 'Working in Hermes'),300),updatedAt=now(),external=True,hermesRunId=id)
                self.db.event('task_update',task)
                run['activities'].append(dict(id=child_id,type=kind,title=task['title'],detail=task['summary'],at=now(),failed=failed))
                run['activities']=run['activities'][-80:]
        elif kind in ('message.interim','assistant.commentary'):
            if event.get('already_streamed'):return
            text=safe_text(event.get('text'),10000)
            if text:
                run['activities'].append(dict(id=uid(),type='agent.update',title='Agent update',detail=text,at=now()))
                run['activities']=run['activities'][-80:]
        elif kind.startswith('tool.'):
            tool=safe_text(event.get('tool') or event.get('tool_name') or 'Tool',120)
            preview=safe_text(event.get('preview') or event.get('delta'))
            label=tool.replace('_',' ').strip().capitalize()
            if kind=='tool.started':run.update(status='working',detail=label)
            failed=kind=='tool.failed' or event.get('error') is True
            activity_id=str(event.get('tool_call_id') or event.get('seq') or uid())
            activities=run['activities']
            item=dict(id=activity_id,type=kind,title=label,detail=preview,at=now(),failed=failed)
            existing=next((i for i,a in enumerate(activities) if a['id']==activity_id),None)
            if existing is not None:item['detail']=preview or activities[existing].get('detail','');activities[existing]=item
            else:activities.append(item)
            run['activities']=activities[-80:]
            if kind in ('tool.completed','tool.failed'):self.scan_files(channel)
        elif kind in ('approval.request','clarify.request'):
            await self.prompt(id,event,channel,task_id)
            run.update(status='waiting',detail='Needs your approval' if kind=='approval.request' else 'Needs your answer')
        elif kind in ('approval.responded','approval.settled','clarify.settled'):
            request=event.get('prompt_id') or event.get('request_id')
            for approval in self.db.all('approvals'):
                if approval.get('runId')==id and approval.get('requestId')==request and approval.get('state')=='pending':self.db.event('approval',{**approval,'state':'deferred'})
            run.update(status='running',detail='Continuing')
            self.resume_task(task_id)
        elif kind=='transport.failed':
            run.update(status='unknown',detail='Connection lost · inspect before retrying',error='The execution outcome is unknown. curdr will not resend it automatically.')
        elif kind=='run.snapshot':
            status=event.get('status','running')
            if run['status'] in TERMINAL and status not in TERMINAL:return
            pending=event.get('pending_controls') or []
            if isinstance(pending,dict):pending=list(pending.values())
            if event.get('approval'):pending=[*pending,event['approval']]
            active=[]
            for prompt in pending:
                if isinstance(prompt,dict):
                    await self.prompt(id,prompt,channel,task_id);active.append(prompt.get('prompt_id') or prompt.get('request_id'))
            # Canonical polling is authoritative for controls resolved in another client.
            if 'pending_controls' in event:
                for approval in self.db.all('approvals'):
                    if approval.get('runId')==id and approval.get('state')=='pending' and approval.get('requestId') not in active:self.db.event('approval',{**approval,'state':'deferred'})
            if status in TERMINAL:
                run.update(status=status,detail='Completed' if status=='completed' else status.capitalize())
                if status=='unknown':run.update(detail='Outcome unknown · inspect in Hermes',error='Hermes cannot confirm how this execution ended. Inspect it on your host before retrying; curdr will not replay it.')
            elif pending:run.update(status='waiting',detail='Needs your input')
            elif status in ('queued','stopping'):run.update(status=status,detail=status.capitalize())
            elif run['status'] in ('queued','waiting','stopping'):run.update(status='running',detail='Working');self.resume_task(task_id)
        elif kind.startswith('run.'):
            status=kind[4:]
            if status=='created':status=event.get('status','queued')
            if status in TERMINAL or status in ('queued','running','stopping'):run.update(status=status,detail=status.capitalize())
        if run['status'] in TERMINAL:
            self.scan_files(channel)
            for approval in self.db.all('approvals'):
                if approval.get('runId')==id and approval.get('state')=='pending':self.db.event('approval',{**approval,'state':'expired'})
        old=self.db.get('runs',id)
        comparable={k:v for k,v in run.items() if k!='updatedAt'}
        if old and comparable=={k:v for k,v in old.items() if k!='updatedAt'}:return
        run['updatedAt']=now();self.db.event('run',run)
        self.db.event('activity',{'channel':channel,'state':'need' if run['status']=='waiting' else 'work' if run['status'] in ('working','running','responding') else 'think' if run['status']=='queued' else 'idle'})

    def resume_task(self,task_id):
        task=self.db.get('tasks',task_id) if task_id else None
        if task and task['status']=='need' and task.get('waitingRun'):self.db.event('task_update',{**task,'status':'run','summary':'Continuing','waitingRun':False})

    async def prompt(self,run_id,prompt,channel,task_id):
        request=prompt.get('prompt_id') or prompt.get('request_id')
        if not isinstance(request,str) or not request:return
        generation=prompt.get('execution_generation')
        identity=hashlib.sha256(f'{run_id}:{request}:{generation}'.encode()).hexdigest()[:32]
        if self.db.get('approvals',identity):return
        clarify=prompt.get('kind')=='clarify' or prompt.get('event')=='clarify.request'
        seconds=prompt.get('timeout_s')
        expiry=(datetime.now(timezone.utc)+timedelta(seconds=seconds)).isoformat() if isinstance(seconds,(int,float)) and 0<seconds<86400 else ''
        value=dict(id=identity,taskId=task_id or '',runId=run_id,requestId=request,channel=channel,kind='clarify' if clarify else 'tool',title='Your input is needed' if clarify else 'Review this action',body=safe_text(prompt.get('question') or prompt.get('description') or 'Hermes is waiting for your decision.',10000),command=safe_text(prompt.get('command',''),20000),choices=[safe_text(s,100) for s in prompt.get('choices',[]) if isinstance(s,str)][:12],expiresAt=expiry,state='pending')
        if not clarify:value['allowedChoices']=[s for s in prompt.get('choices', ['once','deny']) if s in ('once','session','always','deny')]
        if generation is not None:value['executionGeneration']=generation
        if prompt.get('edit'):value['body']+='\n'+safe_text(json.dumps(prompt['edit'],ensure_ascii=False,indent=2),10000)
        self.db.event('approval',value)
        self.db.event('message',dict(id='approval-'+identity,role='agent',kind='approval',approvalId=identity,channel=channel,createdAt=now()))
        task=self.db.get('tasks',task_id) if task_id else None
        if task:self.db.event('task_update',{**task,'status':'need','summary':'Waiting for your input','waitingRun':True})

    async def decide(self,approval,decision,answer=None):
        if not self.adapter:raise ValueError('Connect an existing Hermes gateway.')
        body={'request_id':approval['requestId']}
        if approval.get('executionGeneration') is not None:body['execution_generation']=approval['executionGeneration']
        if approval['kind']=='clarify':body['answer']=answer or '';endpoint='clarify'
        else:
            choice={'approve':'once','later':'deny','session':'session','always':'always'}.get(decision)
            if choice not in approval.get('allowedChoices',['once','deny']):raise ValueError('Hermes does not allow this permission scope for this action.')
            body['choice']=choice;endpoint='approval'
        # Identity and generation always refer to this exact pending prompt.
        await self.adapter.request('/v1/runs/'+approval['runId']+'/'+endpoint,'POST',body)
        self.db.event('approval',{**approval,'state':'approved' if decision in ('approve','session','always') else 'denied','decision':decision})
        self.resume_task(approval.get('taskId'))

    async def ask(self,text,settings,history=None,purpose='chat',skills=None,channel='main',workspace='',task_id=None):
        settings={**settings,'_cofounder':(self.db.get('skill_sources','curdr-cofounder') or {}).get('content',''),'_chat_style':(self.db.get('skill_sources','curdr-chat') or {}).get('content','')}
        if not self.adapter:return await self.runner.ask(text,settings,history,purpose=purpose,skills=skills,channel=channel,workspace=workspace)
        if not settings['sbx']:raise ValueError('Hermes is paused in Settings.')
        self.partial.pop(channel,None);self.text[channel]='';self.active_run.pop(channel,None)
        settings={**settings,'_cofounder':(self.db.get('skill_sources','curdr-cofounder') or {}).get('content','')}
        session=self.db.get('meta','session:'+channel)
        if self.root:workspace+='\nSave files and screenshots for the user in this shared workspace directory: '+str(self.root)+'. Include useful outputs there so curdr can show them. Do not access other curdr configuration or credential files.'
        async def callback(event):
            if purpose in ('proactive','briefing','channel') and event.get('event') in ('message.delta','assistant.delta','message.interim','assistant.commentary'):return
            await self.event(event,channel,task_id)
        try:
            output=await self.adapter.ask(text,settings,None if session else history,purpose,skills,channel,workspace,on_event=callback,session_id=session.get('id') if session else None)
            self.flush(channel,complete=True);return output
        except BaseException as error:
            from .errors import upstream_http_error
            diagnostic=upstream_http_error(error).detail if isinstance(error,httpx.HTTPStatusError) else None
            failure=diagnostic['message']+' ('+diagnostic['code']+')' if diagnostic else safe_text(error)
            self.flush(channel,failed='Interrupted' if isinstance(error,asyncio.CancelledError) else failure,complete=True)
            recent=[r for r in self.db.all('runs') if r['channel']==channel and r['status'] not in TERMINAL]
            if recent:
                current=recent[-1]
                if isinstance(error,asyncio.CancelledError):
                    if not self.closing:self.watchers[current['id']]=asyncio.create_task(self.recover(current))
                else:self.db.event('run',{**current,'status':'failed','detail':'Run failed','error':failure,**({'errorCode':diagnostic['code'],'httpStatus':diagnostic['status']} if diagnostic else {}),'updatedAt':now()})
            raise

    def finish(self,response,channel,artifact=None,run_id=None):
        if run_id and self.active_run.get(channel) not in (None,run_id):return store_response(self.db,response,channel)
        identity=self.partial.pop(channel,None);self.text.pop(channel,None)
        if artifact:
            plain,_=extract_visual(response)
            from .founder import chunks
            if plain:
                for index,part in enumerate(chunks(plain)):self.db.event('message',dict(id=identity if index==0 and identity else uid(),role='agent',kind='text',text=part,channel=channel,createdAt=now(),streaming=False))
            self.db.event('message',dict(id=uid() if plain else identity or uid(),role='agent',kind='artifact',fileId=artifact['id'],title=artifact['name'],channel=channel,createdAt=now()))
            return plain,artifact
        run=self.db.get('runs',self.active_run.get(channel,''))
        if run:self.db.event('run',{**run,'resultPreview':safe_text(response.split('```')[0],180),'updatedAt':now()})
        return store_response(self.db,response,channel,message_id=identity)

    async def stop(self,run_id):
        run=self.db.get('runs',run_id)
        if not run or not self.adapter or run_id.startswith('compat-'):raise ValueError('This run cannot be stopped through the API.')
        await self.adapter.request('/v1/runs/'+run_id+'/stop','POST',{})
        self.db.event('run',{**run,'status':'stopping','detail':'Stopping at the next safe point','updatedAt':now()})

    async def recover(self,run):
        if not self.active_run.get(run['channel']):self.active_run[run['channel']]=run['id']
        task=self.db.get('tasks',run.get('taskId')) if run.get('taskId') else None
        if task and task.get('summary','').startswith('Server restarted'):self.db.event('task_update',{**task,'status':'run','summary':'Reconnected to Hermes'})
        try:
            result=await self.adapter.watch_run(run['id'],lambda event:self.event(event,run['channel'],run.get('taskId')),after_sequence=run.get('lastSeq',-1))
            self.finish(result,run['channel'],run_id=run['id'])
            task=self.db.get('tasks',run.get('taskId')) if run.get('taskId') else None
            if task:
                file=dict(id=uid(),name=task['title'][:60].replace('/','-')+'.md',channel=run['channel'],content=result,mime='text/markdown',updatedAt=now())
                self.db.event('file_added',file)
                self.db.event('task_update',{**task,'status':'review','summary':'Result recovered from Hermes','updatedAt':now()})
        except Exception:
            # event projection retains failed/unknown status, never starts the work again.
            if self.active_run.get(run['channel'])!=run['id']:return
            self.flush(run['channel'],failed='Could not recover this run. Inspect it before retrying.',complete=True)

    async def monitor(self):
        if not self.adapter:return
        # Restore incomplete text identity as well as run/approval identities after restart.
        for message in self.db.all('messages'):
            if message.get('streaming'):
                if message.get('runId'):self.active_run[message.get('channel','main')]=message['runId']
                self.partial[message.get('channel','main')]=message['id'];self.text[message.get('channel','main')]=message.get('text','')
        for run in self.db.all('runs'):
            if run.get('status') not in TERMINAL and run['id'].startswith('compat-'):
                self.db.event('run',{**run,'status':'interrupted','detail':'Gateway restarted · inspect before retrying','updatedAt':now()})
                self.flush(run['channel'],failed='Stream interrupted by gateway restart.',complete=True)
            elif run.get('status') not in TERMINAL:
                self.watchers[run['id']]=asyncio.create_task(self.recover(run))
        try:
            while True:
                await self.refresh();await asyncio.sleep(30)
        finally:
            for watcher in self.watchers.values():watcher.cancel()
            await asyncio.gather(*self.watchers.values(),return_exceptions=True)
