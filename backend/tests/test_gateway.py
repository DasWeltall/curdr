import asyncio
import json
from datetime import datetime,timedelta,timezone
import httpx
import pytest
from fastapi.testclient import TestClient
from app.main import create_app
from app.runner import Runner


@pytest.fixture
def app(tmp_path,monkeypatch):
    monkeypatch.setenv('CURDR_TOKEN','test-token-abcdefghijklmnopqrstuvwxyz')
    monkeypatch.setenv('CURDR_AGENT_MODE','mock')
    return create_app(str(tmp_path/'state.db'))


@pytest.fixture
def client(app):
    with TestClient(app,headers={'Authorization':'Bearer test-token-abcdefghijklmnopqrstuvwxyz'}) as c:
        yield c


def draft_task(client,start=False):
    drafts=client.post('/braindump',json={'text':'Tests schreiben #curdr; README prüfen #curdr'}).json()['tasks']
    return client.post('/tasks',json={'draft_id':drafts[0]['id'],'start':start}).json(),drafts


def test_authentication_covers_reads_and_writes(app):
    with TestClient(app) as c:
        for path in ['/health','/tasks','/settings','/files','/skills','/snapshot','/stream']:
            assert c.get(path).status_code==401
        assert c.post('/message',json={'text':'Hallo'}).status_code==401


def test_draft_review_commit_is_idempotent(client):
    t,drafts=draft_task(client)
    assert t['channel']=='curdr' and t['status']=='up'
    again=client.post('/tasks',json={'draft_id':drafts[0]['id'],'start':True})
    assert again.json()['id']==t['id']
    assert len(client.get('/tasks').json())==1
    assert client.post('/tasks',json={'draft_id':'invented','start':True}).status_code==410


def test_delete_requires_single_use_approval(client):
    t,_=draft_task(client)
    a=client.post(f"/task/{t['id']}/delete",json={}).json()
    assert len(client.get('/tasks').json())==1
    assert client.post('/approval/'+a['id'],json={'decision':'approve'}).status_code==200
    assert client.get('/tasks').json()==[]
    assert client.post('/approval/'+a['id'],json={'decision':'approve'}).status_code==409


def test_expiry_is_enforced_by_server(client,app):
    db=app.state.db
    a=dict(id='expired',taskId='none',kind='delete',title='delete',state='pending',expiresAt=(datetime.now(timezone.utc)-timedelta(seconds=1)).isoformat())
    db.event('approval',a)
    assert client.post('/approval/expired',json={'decision':'approve'}).status_code==410
    assert db.get('approvals','expired')['state']=='expired'


def test_external_actions_fail_without_connector(client,app):
    db=app.state.db
    for kind in ('send','pay'):
        a=dict(id=kind,taskId='none',kind=kind,title=kind,state='pending',expiresAt=(datetime.now(timezone.utc)+timedelta(minutes=5)).isoformat())
        db.event('approval',a)
        assert client.post('/approval/'+kind,json={'decision':'approve'}).status_code==501
        assert db.get('approvals',kind)['state']=='pending'


def test_settings_cannot_disable_approvals_or_raise_server_budget(client):
    for patch in [{'aPay':False},{'aSend':False},{'aDel':False},{'budget':21},{'used':0},{'network':True},{'model':'arbitrary'},{'quiet':'false'}]:
        assert client.put('/settings',json=patch).status_code==422,patch
    assert client.put('/settings',json={'theme':'dark','calm':True}).status_code==200
    assert client.get('/snapshot').json()['settings']['theme']=='dark'


def test_upload_bytes_preserved_and_html_is_not_executed(client):
    data=b'\x00\xff\x80binary'
    res=client.post('/files',files={'file':('test.bin',data,'application/octet-stream')})
    assert res.status_code==200
    download=client.get(f"/files/{res.json()['id']}/download")
    assert download.content==data
    assert download.headers['x-content-type-options']=='nosniff'
    assert download.headers['content-disposition']=='attachment'


def test_event_order_and_reconnect_snapshot(client,app):
    t,_=draft_task(client)
    state,seq=app.state.db.snapshot()
    client.post(f"/task/{t['id']}/pause",json={})
    events=app.state.db.events_after(seq)
    assert [json.loads(data)['type'] for _,data in events]==['task_update']
    fresh,newseq=app.state.db.snapshot()
    assert newseq>seq and fresh['tasks'][0]['status']=='up'


@pytest.mark.asyncio
async def test_pause_discards_inflight_results(tmp_path,monkeypatch):
    monkeypatch.setenv('CURDR_AGENT_MODE','mock')
    monkeypatch.setenv('CURDR_TOKEN','test-token-abcdefghijklmnopqrstuvwxyz')
    class Slow(Runner):
        async def ask(self,*args,**kwargs):
            if kwargs.get('purpose')=='braindump':
                return await super().ask(*args,**kwargs)
            # A badly behaved adapter swallows cancellation; generation must still fence it.
            try:
                await asyncio.sleep(10)
            except asyncio.CancelledError:
                return 'stale result'
    app=create_app(str(tmp_path/'state.db'),Slow())
    async with app.router.lifespan_context(app):
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app),base_url='http://test',headers={'Authorization':'Bearer test-token-abcdefghijklmnopqrstuvwxyz'}) as c:
            ds=(await c.post('/braindump',json={'text':'Test task'})).json()['tasks']
            t=(await c.post('/tasks',json={'draft_id':ds[0]['id'],'start':True})).json()
            await asyncio.sleep(.02)
            await c.post(f"/task/{t['id']}/pause",json={})
            await asyncio.sleep(.02)
            assert (await c.get('/files')).json()==[]
            assert (await c.get('/tasks')).json()[0]['status']=='up'


def test_character_settings_roundtrip_and_invalid_parts(client):
    agent=dict(name='Pico',shape='ghost',color='#A6CDB6',eyes='happy',mouth='smile',accessory='sprout',motion='float')
    assert client.put('/settings',json={'agent':agent,'icon':'character'}).status_code==200
    assert client.get('/settings').json()['agent']==agent
    for bad in [{**agent,'color':'url(https://example.com)'},{**agent,'name':'x'*29},{**agent,'shape':'other'},{**agent,'extra':'untrusted'}]:
        assert client.put('/settings',json={'agent':bad}).status_code==422
    assert client.get('/settings').json()['agent']==agent


def test_pairing_requires_auth_to_issue_and_is_single_use(app):
    with TestClient(app) as c:
        assert c.post('/pair/start').status_code == 401
        assert c.post('/pair/exchange', json={'code':'x'}).status_code == 401
        auth = {'Authorization':'Bearer test-token-abcdefghijklmnopqrstuvwxyz'}
        first = c.post('/pair/start', headers=auth).json()['code']
        code = c.post('/pair/start', headers=auth).json()['code']
        assert c.post('/pair/exchange', json={'code':first}).status_code == 401
        assert c.post('/pair/exchange', json={'code':code}).json()['token'] == 'test-token-abcdefghijklmnopqrstuvwxyz'
        assert c.post('/pair/exchange', json={'code':code}).status_code == 401
        from app.pairing import issue_pair
        expired = issue_pair(app.state.db, ttl=-1)['code']
        assert c.post('/pair/exchange', json={'code':expired}).status_code == 401
        assert 'pair' not in c.get('/snapshot',headers=auth).json()


def test_health_does_not_claim_mock_is_hermes(client):
    health = client.get('/health').json()
    assert health['agent_status'] == 'mock'
    assert not any(health['capabilities'].values())


def test_health_checks_the_runtime(tmp_path, monkeypatch):
    monkeypatch.setenv('CURDR_TOKEN','test-token-abcdefghijklmnopqrstuvwxyz')
    class Real(Runner):
        mode = 'hermes'
        def __init__(self): pass
        async def health(self): return True
    with TestClient(create_app(str(tmp_path/'real.db'), Real()),headers={'Authorization':'Bearer test-token-abcdefghijklmnopqrstuvwxyz'}) as c:
        health = c.get('/health').json()
        assert health['agent_status'] == 'ready'
        assert health['capabilities']['memory'] is True
        assert health['capabilities']['terminal'] is False


def test_uploaded_binary_has_shared_host_path_and_image_history(client,app,tmp_path):
    # The gateway owns upload paths; the client cannot pick a host filename.
    from app.channels import history
    import base64
    db=app.state.db
    image=client.post('/files',files={'file':('photo.png',b'png-bytes','image/png')}).json()
    db.event('message',dict(id='image-msg',role='user',kind='attachment',text='Describe this',fileIds=[image['id']],channel='main',createdAt='2026-10-25T00:00:00Z'))
    parts=history(db,'main')[-1]['content']
    assert parts[1]['type']=='image_url'
    assert parts[1]['image_url']['url']=='data:image/png;base64,'+base64.b64encode(b'png-bytes').decode()
    assert history(db,'other')==[]
