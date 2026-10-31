import asyncio
import json
import httpx
import pytest
from app.db import Database,DEFAULTS
from app.existing_hermes import ExistingHermes
from app.live import LiveRuntime
from app.runner import Runner

class SSE(httpx.AsyncByteStream):
    def __init__(self,events,gate=None,after=None):self.events,self.gate,self.after=events,gate,after
    async def __aiter__(self):
        yield b': open\n\n'
        for i,event in enumerate(self.events):yield f'id: {i}\ndata: {json.dumps({**event,"seq":i})}\n\n'.encode()
        if self.gate:
            await self.gate.wait()
            for j,event in enumerate(self.after or [],len(self.events)):yield f'id: {j}\ndata: {json.dumps({**event,"seq":j})}\n\n'.encode()

def test_real_run_stream_exact_approval_and_final_message_replace(tmp_path,monkeypatch):
    monkeypatch.setenv('CURDR_WORKSPACE_DIR',str(tmp_path/'workspace'))
    async def scenario():
        gate=asyncio.Event();calls=[];status={'value':'running'}
        prompt={'prompt_id':'prompt-7','execution_generation':7,'kind':'approval','command':'write report.md','description':'Create the reviewed report','choices':['once','deny','always']}
        async def handle(request):
            calls.append(request)
            if request.url.path=='/v1/runs' and request.method=='POST':
                body=json.loads(request.content);assert body['input']=='Make a report';assert 'concise English' not in body['instructions'];assert request.headers['X-Hermes-Session-Key'].endswith(':launch')
                return httpx.Response(202,json={'run_id':'run_real','status':'started'})
            if request.url.path.endswith('/approval'):
                assert json.loads(request.content)=={'request_id':'prompt-7','execution_generation':7,'choice':'once'}
                status['value']='completed';gate.set();return httpx.Response(200,json={'status':'resolved'})
            if request.url.path.endswith('/events'):
                status['value']='waiting_for_approval'
                return httpx.Response(200,headers={'content-type':'text/event-stream'},stream=SSE([
                    {'event':'message.delta','run_id':'run_real','delta':'I am making the report.'},
                    {'event':'tool.started','run_id':'run_real','tool':'write_file','preview':'report.md','tool_call_id':'call-1'},
                    {'event':'approval.request','run_id':'run_real',**prompt}],gate,[
                    {'event':'tool.completed','run_id':'run_real','tool':'write_file','tool_call_id':'call-1'},
                    {'event':'run.completed','run_id':'run_real','output':'**Done.** Your report is ready.'}]))
            if request.url.path=='/v1/runs/run_real':return httpx.Response(200,json={'run_id':'run_real','status':status['value'],'session_id':'session-launch','pending_controls':[prompt] if status['value']=='waiting_for_approval' else [],'output':'**Done.** Your report is ready.' if status['value']=='completed' else ''})
            raise AssertionError(str(request.url))
        adapter=ExistingHermes('http://hermes:8642',key='private',transport=httpx.MockTransport(handle));adapter.capabilities={'features':{'run_submission':True}};adapter.poll_interval=.01
        runner=Runner();runner.existing=adapter
        db=Database(tmp_path/'state.db');db.event('task_update',{'id':'task1','title':'Report','status':'run','channel':'launch'})
        runtime=LiveRuntime(db,runner);waiting=asyncio.create_task(runtime.ask('Make a report',DEFAULTS,channel='launch',task_id='task1'))
        async with asyncio.timeout(3):
            while not db.all('approvals'):await asyncio.sleep(.005)
        approval=db.all('approvals')[0]
        assert approval['state']=='pending' and approval['executionGeneration']==7
        assert db.get('tasks','task1')['status']=='need'
        partial=[m for m in db.all('messages') if m['kind']=='text'][0]
        assert partial['streaming'] is True
        await runtime.decide(approval,'approve')
        result=await asyncio.wait_for(waiting,3);runtime.finish(result,'launch')
        texts=[m for m in db.all('messages') if m['kind']=='text']
        assert len(texts)==1 and texts[0]['id']==partial['id'] and texts[0]['streaming'] is False
        assert texts[0]['text']=='**Done.** Your report is ready.'
        assert db.get('meta','session:launch')['id']=='session-launch'
        assert db.all('runs')[0]['status']=='completed'
        assert len([r for r in calls if r.method=='POST' and r.url.path=='/v1/runs'])==1
        db.conn.close()
    asyncio.run(scenario())

@pytest.mark.parametrize('status',['failed','cancelled','unknown'])
def test_terminal_failures_do_not_become_success_or_resubmit(tmp_path,status):
    async def scenario():
        calls=[]
        async def handle(request):
            calls.append(request)
            if request.method=='POST':return httpx.Response(202,json={'run_id':'run_fail'})
            if request.url.path.endswith('/events'):return httpx.Response(200,stream=SSE([{'event':'run.'+status,'run_id':'run_fail','output':'Only a diagnostic'}]))
            return httpx.Response(200,json={'status':status,'run_id':'run_fail','output':'Only a diagnostic'})
        agent=ExistingHermes('http://hermes:8642',key='test',transport=httpx.MockTransport(handle));agent.capabilities={'features':{'run_submission':True}}
        runner=Runner();runner.existing=agent;db=Database(tmp_path/'state.db');runtime=LiveRuntime(db,runner)
        with pytest.raises(ValueError):await runtime.ask('Do work',DEFAULTS)
        assert not any(m.get('text')=='Only a diagnostic' for m in db.all('messages'))
        assert len([r for r in calls if r.method=='POST'])==1
        db.conn.close()
    asyncio.run(scenario())

def test_workspace_files_and_authoritative_skill_removal(tmp_path,monkeypatch):
    folder=tmp_path/'workspace';folder.mkdir();(folder/'report.md').write_text('Actual report')
    (tmp_path/'secret.txt').write_text('private');(folder/'link.txt').symlink_to(tmp_path/'secret.txt');(folder/'.hidden.txt').write_text('private')
    monkeypatch.setenv('CURDR_WORKSPACE_DIR',str(folder))
    db=Database(tmp_path/'state.db');runtime=LiveRuntime(db,Runner());runtime.scan_files('launch')
    files=db.all('files');assert len(files)==1 and files[0]['content']=='Actual report' and files[0]['channel']=='launch'
    runtime.scan_files();assert len(db.all('files'))==1
    db.event('skills',[{'id':'one','title':'One'}]);db.event('skills',[]);assert db.snapshot()[0]['skills']==[]
    db.conn.close()

def test_sse_reconnect_deduplicates_sequences_and_restores_cursor():
    async def scenario():
        event_calls=[];deltas=[]
        async def handle(request):
            if request.url.path.endswith('/events'):
                cursor=request.headers.get('Last-Event-ID');event_calls.append(cursor)
                if len(event_calls)==1:
                    return httpx.Response(200,stream=SSE([{'event':'message.delta','run_id':'run1','delta':'A'}]))
                # Replay the same event and then add a new one: A must appear only once.
                return httpx.Response(200,stream=SSE([{'event':'message.delta','run_id':'run1','delta':'A'},{'event':'message.delta','run_id':'run1','delta':'B'},{'event':'run.completed','run_id':'run1','output':'AB'}]))
            return httpx.Response(200,json={'status':'running','run_id':'run1'})
        agent=ExistingHermes('http://hermes:8642',key='test',transport=httpx.MockTransport(handle))
        async def callback(event):
            if event.get('event')=='message.delta':deltas.append(event['delta'])
        assert await asyncio.wait_for(agent.watch_run('run1',callback),4)=='AB'
        assert deltas==['A','B'] and event_calls==[None,'0']
        deltas.clear();event_calls.clear()
        # A persisted cursor from before a gateway restart skips already stored text.
        assert await asyncio.wait_for(agent.watch_run('run1',callback,after_sequence=0),4)=='AB'
        assert deltas==['B'] and event_calls==['0','0']
    asyncio.run(scenario())


def test_stale_approval_is_never_recorded_as_approved(tmp_path):
    async def scenario():
        def handle(request):return httpx.Response(409,json={'detail':'execution_generation changed'})
        agent=ExistingHermes('http://hermes:8642',key='test',transport=httpx.MockTransport(handle))
        runner=Runner();runner.existing=agent;db=Database(tmp_path/'state.db');runtime=LiveRuntime(db,runner)
        approval=dict(id='old',runId='run1',requestId='p1',executionGeneration=2,kind='tool',state='pending')
        db.event('approval',approval)
        with pytest.raises(httpx.HTTPStatusError):await runtime.decide(approval,'approve')
        assert db.get('approvals','old')['state']=='pending'
        db.conn.close()
    asyncio.run(scenario())


def test_recovered_old_run_cannot_replace_new_channel_partial(tmp_path):
    db=Database(tmp_path/'state.db');runtime=LiveRuntime(db,Runner())
    runtime.active_run['main']='new';runtime.partial['main']='new-message';runtime.text['main']='New work'
    runtime.flush('main')
    runtime.finish('Old result','main',run_id='old')
    assert db.get('messages','new-message')['text']=='New work'
    assert runtime.partial['main']=='new-message'
    assert any(m.get('text')=='Old result' for m in db.all('messages'))
    db.conn.close()


def test_live_image_and_binary_upload_reach_existing_hermes(tmp_path,monkeypatch):
    monkeypatch.setenv('CURDR_WORKSPACE_DIR',str(tmp_path/'workspace'))
    monkeypatch.setenv('CURDR_TOKEN','test-token-abcdefghijklmnopqrstuvwxyz')
    monkeypatch.setenv('CURDR_AGENT_MODE','mock')
    from app.main import create_app
    async def scenario():
        submitted=[]
        async def handle(request):
            if request.method=='POST':
                body=json.loads(request.content);raw=body['input'];user=raw[-1].get('content','') if isinstance(raw,list) else raw
                if not user:return httpx.Response(400,json={'error':{'message':'No user message found in input','type':'invalid_request_error'}})
                submitted.append(body);return httpx.Response(202,json={'run_id':'vision1'})
            if request.url.path.endswith('/events'):return httpx.Response(200,stream=SSE([{'event':'run.completed','run_id':'vision1','output':'Received actual attachments'}]))
            return httpx.Response(200,json={'status':'completed','output':'Received actual attachments'})
        adapter=ExistingHermes('http://hermes:8642',key='private',transport=httpx.MockTransport(handle));adapter.capabilities={'features':{'run_submission':True}}
        runner=Runner();runner.existing=adapter
        app=create_app(str(tmp_path/'state.db'),runner)
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app),base_url='http://test',headers={'Authorization':'Bearer test-token-abcdefghijklmnopqrstuvwxyz'}) as client:
            image=(await client.post('/files',files={'file':('photo.png',b'image-data','image/png')})).json()
            binary=(await client.post('/files',files={'file':('../../report.pdf',b'pdf-data','application/pdf')})).json()
            from pathlib import Path
            assert Path(binary['hostPath']).read_bytes()==b'pdf-data'
            assert Path(binary['hostPath']).is_relative_to(tmp_path/'workspace'/'uploads')
            result=await client.post('/message',json={'text':'Look at these','attachments':[image['id'],binary['id']]})
            assert result.status_code==200,result.text
            assert submitted[0]['input'][0]['role']=='user'
            content=submitted[0]['input'][0]['content']
            assert content[1]['type']=='image_url' and content[1]['image_url']['url'].startswith('data:image/png;base64,')
            assert binary['hostPath'] in content[0]['text']
        app.state.db.conn.close()
    asyncio.run(scenario())
