import json
from fastapi.testclient import TestClient
from app.main import create_app
from app.runner import Runner
from app.visuals import extract_visual

VISUAL={'title':'Real data','description':'Interactive comparison','blocks':[{'type':'chart','kind':'bar','labels':['A','B'],'series':[{'name':'Value','values':[3,9]}]},{'type':'calculator','label':'Units','min':0,'max':10,'value':2,'step':1,'multiplier':5,'offset':0,'resultLabel':'Total','unit':'$'}]}
class Agent(Runner):
    def __init__(self):self.mode='hermes'
    async def health(self):return True
    async def ask(self,*args,**kwargs):return 'Here is your comparison.\n```curdr\n'+json.dumps(VISUAL)+'\n```'
    async def transcribe(self,data,filename):return 'Prepare the meeting. #launch'

def test_visual_protocol_rejects_code_and_bad_dimensions():
    original='```curdr\n'+json.dumps({'title':'Bad','blocks':[{'type':'html','html':'<script>x</script>'}]})+'\n```'
    assert extract_visual(original)==(original,None)
    bad={**VISUAL,'blocks':[{'type':'chart','kind':'line','labels':['A','B'],'series':[{'name':'Value','values':[1]}]}]}
    assert extract_visual('```curdr\n'+json.dumps(bad)+'\n```')[1] is None

def test_generated_visual_is_persisted_scoped_and_available_after_reconnect(tmp_path,monkeypatch):
    monkeypatch.setenv('CURDR_TOKEN','test-token-abcdefghijklmnopqrstuvwxyz')
    app=create_app(str(tmp_path/'state.db'),Agent())
    with TestClient(app,headers={'Authorization':'Bearer test-token-abcdefghijklmnopqrstuvwxyz'}) as client:
        assert client.post('/message',json={'text':'Compare A=3 and B=9','channel':'research'}).status_code==200
        snap=client.get('/snapshot').json()
        card=next(m for m in snap['messages'] if m['kind']=='artifact')
        file=next(f for f in snap['files'] if f['id']==card['fileId'])
        assert card['channel']==file['channel']=='research'
        assert json.loads(file['content'])['blocks'][0]['series'][0]['values']==[3,9]
        assert client.get('/files/'+file['id']+'/download').status_code==200
        assert all('```curdr' not in m.get('text','') for m in snap['messages'])
        changed=client.put('/visuals/'+file['id'],json={'block':1,'value':7})
        assert changed.status_code==200
        assert json.loads(client.get('/files').json()[0]['content'])['blocks'][1]['value']==7
        assert client.put('/visuals/'+file['id'],json={'block':1,'value':999}).status_code==422
        assert client.put('/visuals/'+file['id'],json={'block':0,'html':'<script>x</script>'}).status_code==422

def test_sleep_blocks_new_turns_and_preserves_name_and_fixed_preferences(tmp_path,monkeypatch):
    monkeypatch.setenv('CURDR_TOKEN','test-token-abcdefghijklmnopqrstuvwxyz')
    app=create_app(str(tmp_path/'state.db'),Agent())
    with TestClient(app,headers={'Authorization':'Bearer test-token-abcdefghijklmnopqrstuvwxyz'}) as client:
        saved=client.put('/settings',json={'name':'Alex','fs':1.1,'ton':'lang','sleeping':True}).json()
        assert saved['name']=='Alex' and saved['fs']==1 and saved['ton']=='kurz'
        assert client.post('/message',json={'text':'Hello'}).status_code==409
        assert client.put('/settings',json={'sleeping':False}).status_code==200
        assert client.post('/message',json={'text':'Hello'}).status_code==200
        assert client.get('/settings').json()['name']=='Alex'

def test_transcription_only_never_sends_a_chat_message(tmp_path,monkeypatch):
    monkeypatch.setenv('CURDR_TOKEN','test-token-abcdefghijklmnopqrstuvwxyz')
    app=create_app(str(tmp_path/'state.db'),Agent())
    with TestClient(app,headers={'Authorization':'Bearer test-token-abcdefghijklmnopqrstuvwxyz'}) as client:
        result=client.post('/transcribe',files={'file':('voice.webm',b'fixture','audio/webm')},data={'duration':'2'})
        assert result.status_code==200 and result.json()['text']=='Prepare the meeting. #launch'
        assert client.get('/snapshot').json()['messages']==[]
        assert client.post('/transcribe',files={'file':('voice.txt',b'fixture','text/plain')},data={'duration':'2'}).status_code==415


def test_reviewed_task_edits_are_committed_once(tmp_path,monkeypatch):
    monkeypatch.setenv('CURDR_TOKEN','test-token-abcdefghijklmnopqrstuvwxyz')
    runner=Runner();runner.mode='mock'
    app=create_app(str(tmp_path/'state.db'),runner)
    with TestClient(app,headers={'Authorization':'Bearer test-token-abcdefghijklmnopqrstuvwxyz'}) as client:
        draft=client.post('/braindump',json={'text':'Prepare launch #launch'}).json()['tasks'][0]
        response=client.post('/tasks',json={'draft_id':draft['id'],'title':'Review launch copy','sub':'No paid ads','channel':'copy','start':False})
        assert response.status_code==200
        assert response.json()['title']=='Review launch copy' and response.json()['channel']=='copy'
        assert client.post('/tasks',json={'draft_id':draft['id'],'title':'Duplicate','start':False}).json()['title']=='Review launch copy'
        assert len(client.get('/tasks').json())==1


def test_sleep_pauses_and_wakes_queued_work(tmp_path,monkeypatch):
    import asyncio
    class Waiting(Agent):
        async def ask(self,*args,**kwargs):
            await asyncio.sleep(30)
            return 'Finished'
    monkeypatch.setenv('CURDR_TOKEN','test-token-abcdefghijklmnopqrstuvwxyz')
    app=create_app(str(tmp_path/'state.db'),Waiting())
    with TestClient(app,headers={'Authorization':'Bearer test-token-abcdefghijklmnopqrstuvwxyz'}) as client:
        app.state.db.event('task_update',dict(id='queued',title='Task',channel='launch',status='up'))
        assert client.post('/task/queued/start',json={}).status_code==200
        assert client.put('/settings',json={'sleeping':True}).status_code==200
        assert client.get('/tasks').json()[0]['status']=='up'
        assert client.post('/task/queued/start',json={}).status_code==409
        assert client.put('/settings',json={'sleeping':False}).status_code==200
        assert client.get('/tasks').json()[0]['status']=='run'
