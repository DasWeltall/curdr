import json
from pathlib import Path
import pytest
from fastapi.testclient import TestClient
from app.main import create_app
from app.founder import chunks,instructions
from app.channels import workspace_context

@pytest.fixture
def owner(tmp_path,monkeypatch):
    monkeypatch.setenv('CURDR_AGENT_MODE','mock');monkeypatch.setenv('CURDR_TOKEN','test-token-abcdefghijklmnopqrstuvwxyz');monkeypatch.setenv('CURDR_WORKSPACE_DIR',str(tmp_path/'workspace'))
    app=create_app(str(tmp_path/'state.db'))
    with TestClient(app,headers={'Authorization':'Bearer test-token-abcdefghijklmnopqrstuvwxyz'}) as client:yield client,app,tmp_path

def test_routine_editing_arbitrary_time_and_intervals(owner):
    client,app,_=owner
    for interval in (30,60,180,300):
        result=client.put('/routines/local-checks',json={'interval':interval,'enabled':True,'prompt':'Only changed blockers.'})
        assert result.status_code==200 and result.json()['interval']==interval
    assert client.put('/routines/local-checks',json={'interval':15}).status_code==422
    assert client.put('/routines/local-morning',json={'time':'07:35','prompt':'Three priorities and what to ignore.'}).json()['time']=='07:35'
    assert client.put('/routines/local-morning',json={'time':'25:99'}).status_code==422
    before=client.get('/routines/local-morning').json()
    assert client.post('/routines/local-morning/test').status_code==200
    assert client.get('/routines/local-morning').json()==before

def test_profile_memory_scoping_edit_and_forget(owner):
    client,app,_=owner
    assert client.put('/settings',json={'founderProfile':{'project':'curdr','goal':'5 useful interviews'},'founderInterviewDone':True}).status_code==200
    assert client.put('/settings',json={'founderProfile':{'unknown':'bad'}}).status_code==422
    one=client.put('/founder/memory/new',json={'text':'Launch budget is 20 EUR.','scope':'launch'}).json()
    client.put('/founder/memory/new',json={'text':'Prefer evidence over hype.','scope':'shared'})
    assert 'Launch budget' in workspace_context(app.state.db,'launch')
    assert 'Launch budget' not in workspace_context(app.state.db,'research')
    assert 'Prefer evidence' in workspace_context(app.state.db,'research')
    assert client.post('/founder/memory/'+one['id']+'/forget').status_code==200
    assert 'Launch budget' not in workspace_context(app.state.db,'launch')

def test_skill_edit_conflicts_custom_catalog_and_host_gate(owner):
    client,app,_=owner
    original=client.get('/library/skills/curdr-cofounder').json()
    assert client.put('/library/skills/curdr-cofounder',json={'content':'Be candid, with evidence.','revision':original['revision']}).status_code==200
    assert client.put('/library/skills/curdr-cofounder',json={'content':'stale','revision':original['revision']}).status_code==409
    assert client.put('/library/skills/curdr-customer-notes',json={'content':'Summarize customer evidence.','revision':None}).status_code==200
    assert any(s['id']=='curdr-customer-notes' for s in client.get('/library/skills').json()['items'])
    assert client.post('/library/skills/install',json={'slug':'official/research/arxiv'}).status_code==409
    assert client.get('/library/skills/hermes:external').status_code==409

def test_filesystem_browse_boundaries_and_visual_detection(owner):
    client,app,folder=owner;root=folder/'workspace';(root/'reports').mkdir();(root/'reports'/'result.curdr.json').write_text(json.dumps({'title':'Priorities','blocks':[{'type':'checklist','items':[{'text':'Interview one user'}]}]}));(folder/'secret.txt').write_text('secret');(root/'escape').symlink_to(folder,target_is_directory=True)
    assert client.get('/workspace',params={'path':'../'}).status_code==422
    assert client.get('/workspace',params={'path':str(folder)}).status_code==422
    assert client.get('/workspace',params={'path':'escape'}).status_code==422
    assert not any(e['name']=='escape' for e in client.get('/workspace').json()['entries'])
    file=client.get('/workspace/file',params={'path':'reports/result.curdr.json'}).json()
    assert file['mime']=='application/vnd.curdr.visual+json'
    assert app.state.db.get('files',file['id'])['content']

def test_commands_do_not_forward_unknown_cli_as_model_text(owner):
    client,app,_=owner
    assert client.post('/message',json={'text':'/unknown-cli-command'}).status_code==422
    assert client.get('/snapshot').json()['messages']==[]
    assert client.post('/message',json={'text':'/remember The current goal is 5 interviews.'}).status_code==200
    assert client.get('/founder/memory').json()[0]['text'].startswith('The current goal')
    assert client.post('/message',json={'text':'/help'}).status_code==200
    assert any(c['name']=='/reality-check' for c in client.get('/commands').json())

def test_captures_preserve_original_and_parking_is_not_a_task(owner):
    client,app,_=owner
    result=client.post('/braindump',json={'text':'Try a new idea #ideas'}).json()
    draft=result['tasks'][0]
    assert client.get('/captures').json()[0]['text']=='Try a new idea #ideas'
    assert client.post('/captures/drafts/'+draft['id']+'/park').status_code==200
    assert client.get('/captures/parked').json()[0]['id']==draft['id']
    assert client.get('/tasks').json()==[]

def test_chat_chunks_preserve_markdown_code_and_content():
    text='One. Two. Three. Four.\n\n```python\na=1\nb=2\n```'
    result=chunks(text)
    assert result==[text]  # preserve useful complete answers; never manufacture chat beats
    assert chunks('  ')==[]
    assert 'Never agree merely' in instructions({'founderProfile':{'goal':'ship'}})

def test_new_routes_require_authentication(owner):
    client,app,_=owner
    for path in ('/routines','/commands','/founder/memory','/workspace','/library/skills','/captures'):
        assert client.get(path,headers={'Authorization':'Bearer wrong'}).status_code==401
