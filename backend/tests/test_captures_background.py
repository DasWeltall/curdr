import asyncio,json,time
import httpx
from app.main import create_app
from app.runner import Runner
from app.db import Database

class PlanningRunner(Runner):
    def __init__(self):self.mode='hermes';self.calls=[];self.gate=asyncio.Event()
    async def health(self):return True
    async def transcribe(self,data,name):return 'Find a useful next step.'
    async def ask(self,text,settings,history=None,**kwargs):
        self.calls.append((text,kwargs))
        if kwargs.get('purpose')=='braindump':
            await self.gate.wait()
            return json.dumps([{'title':'Review the menu','sub':'Compare suitable dishes','channel':'food'}])
        return 'A useful chat reply.'


def test_planning_survives_leaving_client_and_does_not_block_chat(tmp_path,monkeypatch):
    monkeypatch.setenv('CURDR_TOKEN','test-token-abcdefghijklmnopqrstuvwxyz')
    async def scenario():
        runner=PlanningRunner();app=create_app(str(tmp_path/'capture.db'),runner)
        headers={'Authorization':'Bearer test-token-abcdefghijklmnopqrstuvwxyz'}
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app),base_url='http://test',headers=headers) as first:
            accepted=await first.post('/captures',json={'text':'I need to decide what to eat.','client_id':'c-123456789'})
            assert accepted.status_code==202
            identity=accepted.json()['id']
        # The submitting client/screen no longer exists; the gateway still owns this work.
        await asyncio.sleep(.01)
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app),base_url='http://test',headers=headers) as other:
            assert (await other.get('/captures/'+identity)).json()['status']=='planning'
            assert (await asyncio.wait_for(other.post('/message',json={'text':'Can I use the rest of the app?'}),1)).status_code==200
            assert (await other.post('/captures',json={'text':'I need to decide what to eat.','client_id':identity})).status_code==202
            assert len([c for c in runner.calls if c[1].get('purpose')=='braindump'])==1
            runner.gate.set()
            for _ in range(100):
                result=(await other.get('/captures/'+identity)).json()
                if result['status']=='ready':break
                await asyncio.sleep(.01)
            assert result['status']=='ready' and result['drafts'][0]['title']=='Review the menu'
            assert (await other.get('/snapshot')).json()['captures'][0]['id']==identity
            # Ready plans remain reviewable after the old one-hour draft expiry.
            draft=result['drafts'][0];app.state.db.conn.execute('UPDATE drafts SET created=? WHERE id=?',(time.time()-90000,draft['id']))
            committed=await other.post('/tasks',json={'draft_id':draft['id'],'start':False})
            assert committed.status_code==200
            assert (await other.post('/captures/'+identity+'/dismiss')).json()['dismissed'] is True
        await app.state.planner.close();app.state.db.conn.close()
    asyncio.run(scenario())


def test_recording_is_uploaded_before_background_transcription_and_plan(tmp_path,monkeypatch):
    monkeypatch.setenv('CURDR_TOKEN','test-token-abcdefghijklmnopqrstuvwxyz')
    async def scenario():
        runner=PlanningRunner();app=create_app(str(tmp_path/'voice.db'),runner)
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app),base_url='http://test',headers={'Authorization':'Bearer test-token-abcdefghijklmnopqrstuvwxyz'}) as client:
            first=await client.post('/captures/audio',files={'file':('brain.m4a',b'actual-saved-recording','audio/mp4')},data={'duration':'2','client_id':'c-voice123456'})
            assert first.status_code==202
            for _ in range(40):
                value=(await client.get('/captures/'+first.json()['id'])).json()
                if value.get('transcribed'):break
                await asyncio.sleep(.01)
            assert value['text']=='Find a useful next step.' and value['transcribed']
            assert (await client.get('/files/'+value['audioFileId']+'/download')).content==b'actual-saved-recording'
            retry=await client.post('/captures/audio',files={'file':('brain.m4a',b'actual-saved-recording','audio/mp4')},data={'duration':'2','client_id':'c-voice123456'})
            assert retry.json()['id']==value['id']
            runner.gate.set()
            await asyncio.gather(*list(app.state.planner.workers.values()))
            assert (await client.get('/captures/'+value['id'])).json()['status']=='ready'
        app.state.db.conn.close()
    asyncio.run(scenario())


def test_gateway_restart_marks_inflight_capture_without_replaying_paid_work(tmp_path,monkeypatch):
    monkeypatch.setenv('CURDR_TOKEN','test-token-abcdefghijklmnopqrstuvwxyz')
    db=Database(tmp_path/'restart.db');db.put('brain_dumps','capture1',{'id':'capture1','text':'A saved thought','status':'planning','createdAt':'2026-10-31T10:00:00+00:00','drafts':[]});db.conn.close()
    async def scenario():
        runner=PlanningRunner();app=create_app(str(tmp_path/'restart.db'),runner)
        app.state.planner.recover()
        assert app.state.db.get('brain_dumps','capture1')['status']=='interrupted'
        assert runner.calls==[]
        app.state.db.conn.close()
    asyncio.run(scenario())

def test_native_hermes_steps_are_visible_but_plan_json_and_reasoning_stay_out_of_chat(tmp_path,monkeypatch):
    from app.existing_hermes import ExistingHermes
    monkeypatch.setenv('CURDR_TOKEN','test-token-abcdefghijklmnopqrstuvwxyz')
    async def scenario():
        gate=asyncio.Event();output=json.dumps([{'title':'One next step','channel':'food','sub':'A short reason'}])
        class Events(httpx.AsyncByteStream):
            async def __aiter__(self):
                for event in ({'event':'run.running','run_id':'plan1'},{'event':'tool.started','run_id':'plan1','tool':'browser_exec','preview':'Inspecting the menu'},{'event':'message.delta','run_id':'plan1','delta':'[private plan JSON chunk]'}):yield ('data: '+json.dumps(event)+'\n\n').encode()
                await gate.wait()
                yield ('data: '+json.dumps({'event':'run.completed','run_id':'plan1','output':output})+'\n\n').encode()
        async def handle(request):
            if request.method=='POST':
                body=json.loads(request.content);assert 'Do not start tasks' in body['instructions']
                return httpx.Response(202,json={'run_id':'plan1'})
            if request.url.path.endswith('/events'):return httpx.Response(200,stream=Events())
            return httpx.Response(200,json={'run_id':'plan1','status':'completed' if gate.is_set() else 'running','output':output if gate.is_set() else ''})
        adapter=ExistingHermes('http://hermes:8642',key='fixture-key',transport=httpx.MockTransport(handle));adapter.capabilities={'features':{'run_submission':True}}
        runner=Runner();runner.existing=adapter
        app=create_app(str(tmp_path/'native-plan.db'),runner)
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app),base_url='http://test',headers={'Authorization':'Bearer test-token-abcdefghijklmnopqrstuvwxyz'}) as client:
            accepted=await client.post('/captures',json={'text':'Please help me choose a next step.'});identity=accepted.json()['id']
            for _ in range(100):
                capture=(await client.get('/captures/'+identity)).json()
                if capture.get('activities'):break
                await asyncio.sleep(.01)
            assert capture['activities'][0]['title']=='Browser exec'
            assert 'Inspecting the menu' in capture['activities'][0]['detail']
            assert app.state.db.all('messages')==[]
            gate.set();await asyncio.gather(*list(app.state.planner.workers.values()))
            assert (await client.get('/captures/'+identity)).json()['status']=='ready'
            assert app.state.db.get('runs','plan1')['captureId']==identity
            assert app.state.db.all('messages')==[]
        app.state.db.conn.close()
    asyncio.run(scenario())
