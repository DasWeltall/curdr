import asyncio,json,time
import httpx
import pytest
from app.db import Database
from app.notifications import PushService,attention,awake
from app.existing_hermes import ExistingHermes
from app.runner import Runner
from app.live import LiveRuntime

@pytest.fixture
def db(tmp_path,monkeypatch):
    monkeypatch.setenv('CURDR_PUSH_ENABLED','true')
    value=Database(tmp_path/'push.db');value.put('settings','main',{**value.get('settings','main'),'quiet':False})
    value.put('push_devices','phone',{'id':'phone','token':'ExpoPushToken[abcdefghijk]','cursor':0,'updated':time.time()})
    yield value
    value.conn.close()

def test_final_only_durable_delivery_and_private_body(db):
    async def scenario():
        calls=[]
        def handle(request):
            body=json.loads(request.content);calls.append((request.url.path,body))
            return httpx.Response(200,json={'data':{'status':'ok','id':'ticket-1'}})
        db.event('message',dict(id='m1',role='agent',kind='text',channel='launch',text='Private launch revenue',streaming=True))
        async with httpx.AsyncClient(transport=httpx.MockTransport(handle)) as client:
            service=PushService(db,client);await service.tick();assert not calls
            db.event('message',dict(id='m1',role='agent',kind='text',channel='launch',text='Private launch revenue',streaming=False))
            await service.tick();assert len(calls)==1
            assert calls[0][1]['data']=={'channel':'launch','messageId':'m1'}
            assert 'Private' not in json.dumps(calls)
            assert db.get('push_outbox','phone')['ticket']=='ticket-1'
            await PushService(db,client).tick();assert len(calls)==1 # restart does not resend accepted ticket
    asyncio.run(scenario())

def test_quiet_sleep_active_and_settled_prompt(db):
    assert not awake({'sleeping':True},time.time())
    assert not awake({'quiet':True,'timezone':'UTC'},0)
    assert awake({'quiet':False},0)
    item=dict(id='p1',state='pending',kind='tool',channel='main',expiresAt='')
    db.event('approval',item);db.event('approval',{**item,'state':'approved'})
    assert attention(db,{'type':'approval','data':item}) is None
    async def scenario():
        calls=[]
        def handle(request):calls.append(request);return httpx.Response(500)
        db.put('push_devices','phone',{**db.get('push_devices','phone'),'activeUntil':time.time()+60})
        db.message('Done.')
        async with httpx.AsyncClient(transport=httpx.MockTransport(handle)) as client:
            await PushService(db,client).tick();assert not calls
            assert db.get('push_devices','phone')['cursor']==db.snapshot()[1]
    asyncio.run(scenario())

def test_retry_and_dead_token_removal(db):
    async def scenario():
        clock=time.time();calls=[]
        def handle(request):
            calls.append(request)
            if len(calls)==1:return httpx.Response(503)
            return httpx.Response(200,json={'data':{'status':'error','details':{'error':'DeviceNotRegistered'}}})
        db.message('Done.')
        async with httpx.AsyncClient(transport=httpx.MockTransport(handle)) as client:
            service=PushService(db,client);await service.tick(clock)
            assert db.get('push_outbox','phone')['attempts']==1
            await service.tick(clock+1);assert len(calls)==1
            await service.tick(clock+40);assert db.get('push_devices','phone') is None
    asyncio.run(scenario())

@pytest.mark.parametrize('decision',['session','always'])
def test_scoped_approval_requires_explicit_hermes_choice(db,decision):
    async def scenario():
        calls=[]
        def handle(request):calls.append(json.loads(request.content));return httpx.Response(200,json={'status':'resolved'})
        runner=Runner();runner.existing=ExistingHermes('http://hermes:8642',key='test',transport=httpx.MockTransport(handle));live=LiveRuntime(db,runner)
        approval=dict(id='a1',runId='r1',requestId='prompt1',executionGeneration=8,kind='tool',state='pending')
        with pytest.raises(ValueError):await live.decide(approval,decision)
        assert not calls
        await live.decide({**approval,'allowedChoices':['once',decision,'deny']},decision)
        assert calls==[{'request_id':'prompt1','execution_generation':8,'choice':decision}]
        assert db.get('approvals','a1')['state']=='approved'
    asyncio.run(scenario())

def test_retry_drops_approval_resolved_before_delivery(db):
    async def scenario():
        calls=[];clock=time.time()
        def handle(request):calls.append(request);return httpx.Response(503)
        item=dict(id='approval1',kind='tool',state='pending',channel='main')
        db.event('approval',item)
        async with httpx.AsyncClient(transport=httpx.MockTransport(handle)) as client:
            service=PushService(db,client);await service.tick(clock)
            db.event('approval',{**item,'state':'approved'})
            await service.tick(clock+60)
            assert len(calls)==1 and db.get('push_outbox','phone') is None
    asyncio.run(scenario())

def test_registration_requires_auth_and_export_never_contains_token(tmp_path,monkeypatch):
    from app.main import create_app
    from fastapi.testclient import TestClient
    monkeypatch.setenv('CURDR_TOKEN','test-token-abcdefghijklmnopqrstuvwxyz');monkeypatch.setenv('CURDR_AGENT_MODE','mock');monkeypatch.setenv('CURDR_PUSH_ENABLED','true')
    app=create_app(str(tmp_path/'auth.db'))
    # No lifespan means no external worker/network calls in this transport test.
    client=TestClient(app)
    assert client.get('/notifications').status_code==401
    client.headers['Authorization']='Bearer test-token-abcdefghijklmnopqrstuvwxyz'
    device={'id':'test-phone-device-123','token':'ExpoPushToken[abcdefghijk]','active':True}
    assert client.post('/notifications/devices',json=device).status_code==200
    assert 'ExpoPushToken' not in json.dumps(app.state.db.snapshot())
    assert client.post('/notifications/devices/'+device['id']+'/remove',json={}).status_code==200
    assert app.state.db.all('push_devices')==[]
    app.state.db.conn.close()
