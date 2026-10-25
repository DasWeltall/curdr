import json
import httpx
import pytest
from fastapi.testclient import TestClient
from app.proxy import create_proxy


@pytest.fixture
def proxy(tmp_path,monkeypatch):
    key=tmp_path/'key'
    key.write_text('provider-secret-never-exposed')
    monkeypatch.setenv('CURDR_PROVIDER_KEY_FILE',str(key))
    monkeypatch.setenv('CURDR_MODEL_PRICES',json.dumps({'openai/gpt-4.1-mini':dict(input=1,output=5)}))
    monkeypatch.setenv('CURDR_MIN_INTERVAL','0')
    calls=[]
    def handler(request):
        calls.append(request)
        assert request.headers['Authorization']=='Bearer provider-secret-never-exposed'
        assert 'provider-secret' not in request.content.decode()
        return httpx.Response(200,json={'choices':[{'message':{'content':'Hello'}}],'usage':{'total_tokens':4}})
    app=create_proxy(str(tmp_path/'state.db'),httpx.MockTransport(handler))
    with TestClient(app) as c:
        yield c,app,calls


def test_budget_reserved_before_upstream_and_persisted(proxy):
    c,app,calls=proxy
    db=app.state.db
    settings=db.get('settings','main');settings['budget']=.001
    db.event('settings',settings)
    body={'model':'openai/gpt-4.1-mini','messages':[{'role':'user','content':'hello'}]}
    assert c.post('/v1/chat/completions',json=body).status_code==402
    assert calls==[]
    settings['budget']=1;db.event('settings',settings)
    assert c.post('/v1/chat/completions',json=body).status_code==200
    assert db.get('settings','main')['used']>0
    assert db.conn.execute('SELECT reserved FROM spend').fetchone()[0]>0


def test_proxy_rejects_unpriced_tools_streams_and_unbounded_outputs(proxy):
    c,app,calls=proxy
    body={'model':'openai/gpt-4.1-mini','messages':[{'role':'user','content':'hello'}]}
    for patch in [{'model':'unpriced'},{'stream':True},{'tools':[{'x':1}]},{'max_tokens':999999},{'n':2}]:
        assert c.post('/v1/chat/completions',json={**body,**patch}).status_code in (403,422)
    assert calls==[]


def test_poll_interval_is_server_enforced(proxy,monkeypatch):
    c,app,calls=proxy
    monkeypatch.setenv('CURDR_MIN_INTERVAL','60')
    body={'model':'openai/gpt-4.1-mini','messages':[{'role':'user','content':'hello'}]}
    assert c.post('/v1/chat/completions',json=body).status_code==200
    assert c.post('/v1/chat/completions',json=body).status_code==429
    assert len(calls)==1


def test_memory_tool_roundtrip_and_cost_includes_schema(proxy):
    c, app, calls = proxy
    tool = {'type':'function','function':{'name':'memory','parameters':{'type':'object','description':'x'*10000}}}
    body = {'model':'openai/gpt-4.1-mini','tools':[tool],'messages':[
        {'role':'user','content':'Remember my preference'},
        {'role':'assistant','content':None,'tool_calls':[{'id':'call1','type':'function','function':{'name':'memory','arguments':'{}'}}]},
        {'role':'tool','tool_call_id':'call1','content':'Stored'},
    ]}
    assert c.post('/v1/chat/completions',json=body).status_code == 200
    sent = json.loads(calls[0].content)
    assert sent['tools'] == [tool]
    assert sent['messages'] == body['messages']
    assert app.state.db.get('settings','main')['used'] > .01
    body['tools'][0]['function']['name'] = 'terminal'
    assert c.post('/v1/chat/completions',json=body).status_code == 422
    assert len(calls) == 1
