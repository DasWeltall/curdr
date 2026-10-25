import asyncio
import json
import httpx
import pytest
from app.existing_hermes import ExistingHermes

def test_existing_api_auth_history_channel_and_partial_response():
    calls=[]
    def handle(request):
        calls.append(request)
        assert request.headers['Authorization']=='Bearer private-host-key'
        if request.url.path=='/v1/models':return httpx.Response(200,json={'data':[{'id':'configured-agent'}]})
        if request.url.path=='/health/detailed':return httpx.Response(200,json={'status':'ok'})
        return httpx.Response(200,json={'choices':[{'finish_reason':'length','message':{'content':'A partial result'}}]})
    agent=ExistingHermes('http://127.0.0.1:8642/v1',key='private-host-key',transport=httpx.MockTransport(handle))
    assert asyncio.run(agent.health())
    reply=asyncio.run(agent.ask('Next',{'name':'Sam'},history=[{'role':'user','content':'Earlier note'}],channel='launch',workspace='Launch context'))
    request=calls[-1];body=json.loads(request.content)
    assert request.headers['X-Hermes-Session-Key'].endswith(':launch')
    assert request.headers['Idempotency-Key']
    assert body['model']=='configured-agent'
    assert body['messages'][1:]==[{'role':'user','content':'Earlier note'},{'role':'user','content':'Next'}]
    assert 'Launch context' in body['messages'][0]['content']
    assert 'partial' in reply and 'private-host-key' not in reply

@pytest.mark.parametrize('reason',['error','cancelled'])
def test_terminal_failures_are_not_reported_as_success(reason):
    def handle(request):return httpx.Response(200,json={'choices':[{'finish_reason':reason,'message':{'content':'Diagnostic only'}}]})
    agent=ExistingHermes('http://localhost:8642',key='test',transport=httpx.MockTransport(handle))
    with pytest.raises(ValueError):asyncio.run(agent.ask('Hi',{}))

def test_degraded_readiness_is_not_accepted():
    def handle(request):return httpx.Response(200,json={'data':[{'id':'hermes-agent'}]} if request.url.path=='/v1/models' else {'status':'degraded'})
    agent=ExistingHermes('http://localhost:8642',key='test',transport=httpx.MockTransport(handle))
    assert asyncio.run(agent.health()) is False


def test_discovery_loads_actual_skills_and_only_configured_model_options():
    def handle(request):
        path=request.url.path
        values={
            '/v1/models':{'data':[{'id':'hermes-agent'}]},
            '/health/detailed':{'status':'ok'},
            '/v1/capabilities':{'features':{'run_submission':True,'run_events_sse':True,'run_approval':True}},
            '/v1/skills':{'data':[{'name':'reports','description':'Generate reports','category':'work'}]},
            '/v1/toolsets':{'data':[{'name':'files','enabled':True,'configured':True,'tools':['read_file']}]},
            '/api/model/options':{'model':'default-model','provider':'configured','providers':[{'id':'configured','authenticated':True,'models':['model-a',{'id':'model-b'},None]},{'id':'missing-key','authenticated':False,'models':['no-access']}]},
            '/api/jobs':{'jobs':[{'id':'brief1','name':'Daily brief','enabled':True}]}}
        return httpx.Response(200,json=values[path])
    adapter=ExistingHermes('http://localhost:8642',key='test',transport=httpx.MockTransport(handle))
    info=asyncio.run(adapter.discover())
    assert info['streaming'] and info['approvals']
    assert info['models']==[{'provider':'configured','model':'model-a'},{'provider':'configured','model':'model-b'}]
    assert info['skills'][0]['name']=='reports' and info['jobs'][0]['id']=='brief1'
