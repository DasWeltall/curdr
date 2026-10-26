"""Adapter for an existing Hermes API server; provider keys stay on that host."""
import asyncio
import importlib.util
import json
import os
from pathlib import Path
import sys
import tempfile
from urllib.parse import urlsplit
import httpx
from .db import uid

VISUAL = '''Use native visualizations proactively, without waiting for the user to request a visualization. When planning or prioritizing, default to a checklist of at most three next actions; for choosing between options use a small table; for verified progress use metrics; for a what-if calculation use a calculator; for an actual numeric trend use a chart. Pick one compact card with one or two blocks and at most five visible items. The visual replaces the long explanation: use at most one short lead sentence and do not repeat its contents as prose. Plain conversation, a simple fact or a quick clarification needs no card. Never invent numbers, results or completed tasks to make a visual. User requests for code or a full document still get the requested artifact. Emit one fenced curdr JSON block after a short explanation. Schema: {"title":"Title","description":"Description","blocks":[...]}. For verified completion ratios use {"type":"progress","label":"Release","value":2,"total":5,"unit":"tasks"}, only with actual known values. Allowed blocks: {"type":"metrics","items":[{"label":"Name","value":"Value"}]}; {"type":"chart","kind":"bar","title":"Title","labels":["A","B"],"series":[{"name":"Series","values":[1,2]}]}; {"type":"table","columns":["Name","Value"],"rows":[["A",1]]}; {"type":"checklist","items":[{"text":"Task","done":false}]}; {"type":"calculator","label":"Quantity","min":0,"max":100,"step":1,"value":10,"multiplier":5,"offset":0,"unit":"$","resultLabel":"Total"}; {"type":"text","text":"Note"}. Use 1-8 blocks, at most 24 chart points, four series and 30 table rows. No executable HTML, scripts or invented data.'''

class ExistingHermes:
    def __init__(self, url=None, key=None, transport=None):
        self.url = (url or os.environ['CURDR_HERMES_API_URL']).rstrip('/')
        if self.url.endswith('/v1'): self.url = self.url[:-3]
        parsed = urlsplit(self.url)
        if parsed.scheme not in ('http','https') or not parsed.hostname or parsed.username or parsed.password or parsed.query or parsed.fragment:
            raise ValueError('Use a complete Hermes API URL without credentials or query parameters.')
        self.key = key if key is not None else Path(os.environ['CURDR_HERMES_API_KEY_FILE']).read_text().strip()
        if not self.key: raise ValueError('The Hermes API key is missing.')
        self.model = os.getenv('CURDR_HERMES_MODEL', 'hermes-agent')
        self.capabilities = {}
        self.poll_interval = 2
        self.detaching = False
        self.transport = transport
        self.prefix = os.getenv('CURDR_HERMES_SESSION_PREFIX', 'curdr')

    def headers(self, channel=None):
        headers = {'Authorization': 'Bearer '+self.key}
        if channel: headers['X-Hermes-Session-Key'] = self.prefix+':'+channel
        return headers

    async def health(self):
        try:
            async with httpx.AsyncClient(timeout=12, transport=self.transport) as client:
                models = await client.get(self.url+'/v1/models', headers=self.headers())
                models.raise_for_status()
                ids = [item['id'] for item in models.json().get('data',[]) if isinstance(item,dict) and isinstance(item.get('id'),str)]
                if not ids: return False
                if self.model not in ids: self.model = ids[0]
                result = await client.get(self.url+'/health/detailed', headers=self.headers())
                caps=await client.get(self.url+'/v1/capabilities',headers=self.headers())
                if caps.status_code==200:self.capabilities=caps.json()
                if result.status_code == 404: return True  # Older APIs expose only /health.
                result.raise_for_status()
                return result.json().get('status') in ('ok','ready','healthy')
        except (httpx.HTTPError,ValueError,KeyError,TypeError):
            return False

    @property
    def audio_ready(self):
        import shutil
        return bool(shutil.which('ffmpeg') and importlib.util.find_spec('faster_whisper') and (Path(os.getenv('CURDR_STT_MODEL','/opt/curdr-stt'))/'model.bin').is_file())

    async def ask(self, text, settings, history=None, purpose='chat', skills=None, channel='main', workspace='', on_event=None, session_id=None):
        language={'en':'Reply in English.','de':'Reply in German.'}.get(settings.get('replyLanguage'),'Reply in the user’s language, unless they ask otherwise.')
        from .founder import instructions
        system = instructions(settings)+'\n'+language+' Never invent results. Existing Hermes server permissions and approval rules apply.\n'
        system += 'User name: '+(settings.get('name') or 'not provided')+'\n'+workspace+'\n'
        system += 'Brain dump review: preserve obligations, identify ideas requiring validation, deduplicate and prioritize against the founder goal. Return ONLY a JSON array (no prose and no curdr block; the app renders these drafts as a plan), with at most 12 reviewed items with title, sub (why/next step), channel (without #), and kind (task, idea, or note). Recommend only a few immediate actions; do not treat every idea as a commitment.' if purpose=='braindump' else 'Channel setup: return only the requested JSON proposal or one question as JSON. Do not emit a curdr visualization or take external actions.' if purpose=='channel' else VISUAL
        if on_event is not None:
            return await self.stream_run(text,system,settings,history,channel,on_event,session_id)
        messages = [{'role':'system','content':system}, *(history or []), {'role':'user','content':text}]
        async with httpx.AsyncClient(timeout=300,transport=self.transport) as client:
            response = await client.post(self.url+'/v1/chat/completions',headers={**self.headers(channel),'Idempotency-Key':uid()},json={'model':self.model,'messages':messages,'stream':False})
            response.raise_for_status()
            choice = response.json()['choices'][0]
            if choice.get('finish_reason') in ('error','cancelled'): raise ValueError('Hermes did not complete this turn.')
            content = choice.get('message',{}).get('content')
            if not isinstance(content,str) or not content.strip(): raise ValueError('Hermes returned no reply.')
            return content+('\n\nThis result is partial: Hermes reached its turn limit.' if choice.get('finish_reason')=='length' else '')

    async def transcribe(self, data, filename):
        if not self.audio_ready: raise ValueError('Run curdr-gateway voice-setup on the gateway host.')
        with tempfile.TemporaryDirectory(prefix='curdr-voice-') as directory:
            source=Path(directory)/Path(filename).name
            source.write_bytes(data)
            process=await asyncio.create_subprocess_exec(sys.executable,'-m','app.stt_worker',str(source),stdout=asyncio.subprocess.PIPE,stderr=asyncio.subprocess.DEVNULL)
            try: output,_=await asyncio.wait_for(process.communicate(),180)
            except BaseException:
                if process.returncode is None: process.kill()
                await process.wait()
                raise
            if process.returncode: raise ValueError('Speech recognition failed.')
            text=json.loads(output).get('text','').strip()
            if not text: raise ValueError('No speech detected.')
            return text

    async def request(self,path,method='GET',body=None):
        async with httpx.AsyncClient(timeout=20,transport=self.transport) as client:
            response=await client.request(method,self.url+path,headers=self.headers(),json=body)
            response.raise_for_status()
            return response.json()

    async def discover(self):
        if not await self.health():raise ValueError("Hermes is unavailable.")
        async def optional(path,default):
            try:return await self.request(path)
            except (httpx.HTTPError,ValueError):return default
        caps,skills,tools,options,jobs=await asyncio.gather(optional('/v1/capabilities',{}),optional('/v1/skills',{}),optional('/v1/toolsets',{}),optional('/api/model/options?include_unconfigured=false',{}),optional('/api/jobs?include_disabled=true',{}))
        self.capabilities=caps
        def rows(value,key='data'):
            value=value.get(key,[]) if isinstance(value,dict) else value
            return [v for v in value if isinstance(v,dict)] if isinstance(value,list) else []
        models=[]
        for provider in rows(options,'providers'):
            if provider.get('authenticated') is False:continue
            slug=provider.get('id') or provider.get('provider') or provider.get('slug') or ''
            for model in provider.get('models',[]):
                name=model if isinstance(model,str) else (model.get('id') or model.get('model') or '') if isinstance(model,dict) else ''
                if isinstance(name,str) and name and isinstance(slug,str) and slug:models.append({'model':name,'provider':slug})
        features=caps.get('features',{})
        return dict(connected=True,streaming=bool(features.get('run_events_sse') or features.get('chat_completions_streaming')),approvals=bool(features.get('run_approval_response') or features.get('run_approval')),model=options.get('model',self.model),provider=options.get('provider',''),models=models[:250],toolsets=rows(tools),jobs=rows(jobs,'jobs'),skills=rows(skills))

    async def stream_run(self,text,system,settings,history,channel,on_event,session_id):
        if not self.capabilities.get('features',{}).get('run_submission'):
            return await self.stream_compat(text,system,settings,history,channel,on_event)
        body={'input':text,'instructions':system}
        if history:body['conversation_history']=history
        if session_id:body['session_id']=session_id
        if settings.get('hermesModel') and settings.get('hermesProvider'):
            body.update(model=settings['hermesModel'],provider=settings['hermesProvider'])
        headers={**self.headers(channel),'Idempotency-Key':uid()}
        async with httpx.AsyncClient(timeout=20,transport=self.transport) as client:
            response=await client.post(self.url+'/v1/runs',headers=headers,json=body)
            response.raise_for_status();accepted=response.json()
        run_id=accepted.get('run_id')
        if not isinstance(run_id,str):raise ValueError('Hermes returned no run identity.')
        await on_event({'event':'run.created','run_id':run_id,'status':'queued','input_preview':(text if isinstance(text,str) else next((p.get('text','') for p in text if p.get('type')=='text'),''))[:160]})
        try:return await self.watch_run(run_id,on_event)
        except asyncio.CancelledError:
            # Stop the actual remote execution as well as its local waiter.
            if self.detaching:raise
            try:await asyncio.shield(self.request('/v1/runs/'+run_id+'/stop','POST',{}))
            except (httpx.HTTPError,ValueError):pass
            await on_event({'event':'run.stopping','run_id':run_id})
            raise

    async def watch_run(self,run_id,on_event,after_sequence=-1):
        from .sse import events
        queue=asyncio.Queue(maxsize=256);last=after_sequence
        async def stream():
            nonlocal last
            while True:
                try:
                    headers=self.headers()
                    if last>=0:headers['Last-Event-ID']=str(last)
                    async with httpx.AsyncClient(timeout=httpx.Timeout(20,read=25),transport=self.transport) as client:
                        async with client.stream('GET',self.url+'/v1/runs/'+run_id+'/events',headers=headers) as response:
                            response.raise_for_status()
                            async for event in events(response.aiter_lines()):
                                seq=event.get('seq',event.get('_id'))
                                if seq is not None:
                                    try:seq=int(seq)
                                    except (ValueError,TypeError):seq=None
                                if seq is not None:
                                    if seq<=last:continue
                                    last=seq
                                await queue.put(event)
                    await asyncio.sleep(1)
                except (httpx.HTTPError,ValueError):await asyncio.sleep(2)
        async def poll():
            failures=0
            while True:
                try:
                    status=await self.request('/v1/runs/'+run_id)
                    await queue.put({**status,'event':'run.snapshot','run_id':run_id})
                    failures=0
                except (httpx.HTTPError,ValueError):
                    failures+=1
                    if failures>=8:
                        await queue.put({'event':'transport.failed','run_id':run_id});return
                await asyncio.sleep(self.poll_interval)
        workers=[asyncio.create_task(stream()),asyncio.create_task(poll())]
        try:
            while True:
                event=await queue.get();kind=event.get('event','')
                await on_event(event)
                status=event.get('status') if kind=='run.snapshot' else kind.removeprefix('run.')
                if status in ('completed','partial'):
                    output=event.get('output','')
                    if not isinstance(output,str):output=''
                    if not output:
                        receipt=await self.request('/v1/runs/'+run_id);output=receipt.get('output','')
                    if not output.strip():raise ValueError('Hermes completed without a response.')
                    return output+('\n\nThis result is partial: Hermes reached its turn limit.' if event.get('partial') else '')
                if status in ('failed','cancelled','interrupted','unknown') or kind=='transport.failed':
                    reason='Hermes lost track of this execution. Inspect it before retrying.' if status=='unknown' or kind=='transport.failed' else 'Hermes '+status+' this run.'
                    raise ValueError(reason)
        finally:
            for worker in workers:worker.cancel()
            await asyncio.gather(*workers,return_exceptions=True)

    async def stream_compat(self,text,system,settings,history,channel,on_event):
        from .sse import events
        run_id='compat-'+uid();chunks=[];finish=None
        await on_event({'event':'run.created','run_id':run_id,'status':'running'})
        body={'model':self.model,'messages':[{'role':'system','content':system},*(history or []),{'role':'user','content':text}],'stream':True}
        if settings.get('hermesModel') and settings.get('hermesProvider'):body.update(model=settings['hermesModel'],provider=settings['hermesProvider'])
        async with httpx.AsyncClient(timeout=httpx.Timeout(20,read=30),transport=self.transport) as client:
            async with client.stream('POST',self.url+'/v1/chat/completions',headers=self.headers(channel),json=body) as response:
                response.raise_for_status()
                if 'text/event-stream' not in response.headers.get('content-type',''):
                    result=json.loads(await response.aread());choice=result['choices'][0];finish=choice.get('finish_reason');chunks=[choice.get('message',{}).get('content','')]
                else:
                    async for event in events(response.aiter_lines()):
                        if event.get('event')=='hermes.tool.progress':
                            await on_event({**event,'event':'tool.started','run_id':run_id,'tool':event.get('tool_name',event.get('tool','Tool'))});continue
                        choices=event.get('choices') or []
                        if not choices:continue
                        delta=choices[0].get('delta',{}).get('content','')
                        if isinstance(delta,str) and delta:
                            chunks.append(delta);await on_event({'event':'message.delta','run_id':run_id,'delta':delta})
                        if choices[0].get('finish_reason'):finish=choices[0]['finish_reason']
        if finish in (None,'error','cancelled'):raise ValueError('The Hermes stream did not complete. Upgrade Hermes for durable run recovery and approvals.')
        output=''.join(chunks)
        await on_event({'event':'run.completed','run_id':run_id,'output':output})
        return output+('\n\nThis result is partial.' if finish=='length' else '')
