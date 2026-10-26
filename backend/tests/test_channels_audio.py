import pytest
from fastapi.testclient import TestClient
from app.main import create_app
from app.runner import Runner

class Agent(Runner):
    def __init__(self):
        self.mode='hermes'
        self.calls=[]
    async def health(self): return True
    async def ask(self,text,settings,history=None,**kwargs):
        self.calls.append((text,history or [],kwargs))
        return 'Result from '+kwargs.get('channel','main')
    async def transcribe(self,data,filename):
        assert data==b'recorded-audio'
        return 'Please plan my next step.'

@pytest.fixture
def connected(tmp_path,monkeypatch):
    monkeypatch.setenv('CURDR_TOKEN','test-token-abcdefghijklmnopqrstuvwxyz')
    runner=Agent()
    app=create_app(str(tmp_path/'state.db'),runner)
    with TestClient(app,headers={'Authorization':'Bearer test-token-abcdefghijklmnopqrstuvwxyz'}) as client:
        yield client,app,runner

def test_private_channel_history_and_coordinator_handoff(connected):
    client,app,runner=connected
    assert client.put('/channels/launch',json={'context':'Keep the launch small.'}).status_code==200
    client.post('/message',json={'text':'A private launch note','channel':'launch'})
    client.post('/message',json={'text':'An unrelated research note','channel':'research'})
    runner.calls.clear()
    assert client.post('/message',json={'text':'Draft the next step for #launch'}).status_code==200
    child,main=runner.calls
    assert child[2]['channel']=='launch' and main[2]['channel']=='main'
    assert any('private launch note' in m['content'] for m in child[1])
    assert not any('research note' in m['content'] for m in child[1])
    assert not any('private launch note' in m['content'] for m in main[1])
    assert 'Result from launch' in main[0]
    assert 'Keep the launch small.' in child[2]['workspace']
    assert app.state.db.get('channels','launch')['summary']=='Result from launch'

def test_audio_is_preserved_transcribed_and_processed_once(connected):
    client,app,runner=connected
    response=client.post('/audio',files={'file':('voice.webm',b'recorded-audio','audio/webm')},data={'duration':'3.2','channel':'launch','peaks':'[0,0.2,0.9,0]'})
    assert response.status_code==200,response.text
    messages=client.get('/snapshot').json()['messages']
    audio=[message for message in messages if message['kind']=='audio']
    assert len(audio)==1 and audio[0]['processing']=='ready'
    assert audio[0]['peaks']==[0,.2,.9,0]
    assert audio[0]['transcript']=='Please plan my next step.'
    assert runner.calls[0][1]==[]  # current transcript is not duplicated into prior history
    assert runner.calls[0][2]['channel']=='launch'
    download=client.get('/files/'+audio[0]['fileId']+'/download')
    assert download.content==b'recorded-audio'

def test_audio_failures_do_not_invent_transcripts(connected):
    client,app,runner=connected
    async def failed(*args): raise ValueError('No speech')
    runner.transcribe=failed
    response=client.post('/audio',files={'file':('voice.webm',b'recorded-audio','audio/webm')},data={'duration':'2','channel':'main'})
    assert response.status_code==502
    audio=client.get('/snapshot').json()['messages'][0]
    assert audio['processing']=='failed' and 'transcript' not in audio
    assert runner.calls==[]

def test_rejects_audio_types_limits_and_cross_channel_attachments(connected):
    client,_,runner=connected
    assert client.post('/audio',files={'file':('file.txt',b'text','text/plain')},data={'duration':'2'}).status_code==415
    assert client.post('/audio',files={'file':('voice.webm',b'audio','audio/webm')},data={'duration':'500'}).status_code==422
    assert client.put('/channels/../bad',json={'context':'x'}).status_code in (404,405)
    item=client.post('/files',files={'file':('note.txt',b'private','text/plain')},data={'channel':'launch'}).json()
    assert client.post('/message',json={'text':'Read this','channel':'research','attachments':[item['id']]}).status_code==422
    assert runner.calls==[]


def test_audio_transcript_survives_reply_failure(connected):
    client,_,runner=connected
    async def failed(*args,**kwargs): raise ValueError('Model unavailable')
    runner.ask=failed
    response=client.post('/audio',files={'file':('voice.webm',b'recorded-audio','audio/webm')},data={'duration':'2'})
    assert response.status_code==502 and 'transcribed and saved' in response.json()['detail']
    audio=client.get('/snapshot').json()['messages'][0]
    assert audio['processing']=='ready' and audio['transcript']=='Please plan my next step.'

@pytest.mark.parametrize('peaks',['[-1]','[2]','[true]','[NaN]','{}','[0,'+'0,'*1200+'0]'])
def test_invalid_waveform_is_rejected_without_saving(connected,peaks):
    client,app,runner=connected
    response=client.post('/audio',files={'file':('voice.webm',b'recorded-audio','audio/webm')},data={'duration':'2','peaks':peaks})
    assert response.status_code==422
    assert app.state.db.all('messages')==[]
    assert runner.calls==[]

def test_speech_provider_error_is_visible_in_voice_and_brain_dump(connected):
    from app.hermes_stt import SpeechError
    client,app,runner=connected
    async def unavailable(*args):raise SpeechError('Selected speech provider has no remaining quota.','hermes_stt_provider_failed')
    runner.transcribe=unavailable
    for path in ('/audio','/transcribe'):
        response=client.post(path,files={'file':('voice.webm',b'recorded-audio','audio/webm')},data={'duration':'2'})
        assert response.status_code==502
        assert response.json()['detail']['code']=='hermes_stt_provider_failed'
        assert 'quota' in response.json()['detail']['message']
    audio=next(m for m in app.state.db.all('messages') if m.get('kind')=='audio')
    assert audio['processing']=='failed' and audio['errorCode']=='hermes_stt_provider_failed'
    assert client.get('/files/'+audio['fileId']+'/download').content==b'recorded-audio'
    assert runner.calls==[]
