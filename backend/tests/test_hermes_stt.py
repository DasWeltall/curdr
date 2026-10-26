"""Contract tests run the real child process and decoder, with a non-network Hermes fixture."""
import asyncio
import io
import json
import os
from pathlib import Path
import sys
import wave
import pytest
from app.hermes_stt import HermesSTT,SpeechError,runtime_paths

@pytest.fixture
def hermes(tmp_path,monkeypatch):
    root=tmp_path/'hermes';profile=tmp_path/'profile'
    root.mkdir();profile.mkdir()
    for folder in ('hermes_cli','tools'):
        (root/folder).mkdir();(root/folder/'__init__.py').write_text('')
    (root/'hermes_cli/env_loader.py').write_text("import json,os\ndef load_hermes_dotenv(**kwargs):\n os.environ.update(json.loads((kwargs['hermes_home']/'env.json').read_text()))\n")
    (root/'hermes_cli/config.py').write_text("import os,json\nfrom pathlib import Path\ndef load_config():return json.loads((Path(os.environ['HERMES_HOME'])/'config.json').read_text())\n")
    (root/'tools/transcription_tools.py').write_text('''import json,os,wave
from pathlib import Path
from hermes_cli.config import load_config

def _get_provider(config):return config.get('provider','auto')
def transcribe_audio(path,model=None,source=None):
    config=load_config()['stt']
    assert model is None, 'curdr must not override the configured model'
    assert source=='gateway'
    with wave.open(path) as recording:assert recording.getframerate()==16000
    calls=Path(os.environ['HERMES_HOME'])/'calls.jsonl'
    with calls.open('a') as out:out.write(json.dumps({'provider':config['provider'],'model':config['model'],'language':config['language'],'credential':os.environ.get('STT_TEST_KEY'),'source':source})+'\\n')
    if config.get('fail'):return {'success':False,'error':'Quota exceeded. token='+os.environ['STT_TEST_KEY']}
    return {'success':True,'transcript':'A real contract transcript.','provider':config['provider']}
''')
    (profile/'env.json').write_text(json.dumps({'STT_TEST_KEY':'profile-private-value','API_SERVER_KEY':'expected-key'}))
    (profile/'config.json').write_text(json.dumps({'stt':{'provider':'groq','model':'chosen-model','language':'de'}}))
    monkeypatch.setenv('CURDR_HERMES_HOME',str(profile));monkeypatch.setenv('CURDR_HERMES_ROOT',str(root));monkeypatch.setenv('CURDR_HERMES_PYTHON',sys.executable)
    monkeypatch.setenv('STT_TEST_KEY','wrong-ambient-value')
    return root,profile


def recording():
    stream=io.BytesIO()
    with wave.open(stream,'wb') as wav:
        wav.setnchannels(1);wav.setsampwidth(2);wav.setframerate(8000);wav.writeframes(b'\0\0'*8000)
    return stream.getvalue()


def test_native_worker_uses_profile_provider_model_language_and_refreshes_configuration(hermes):
    root,profile=hermes;stt=HermesSTT('http://localhost:8642')
    assert asyncio.run(stt.check())['provider']=='groq'
    assert not (profile/'calls.jsonl').exists() # health checks make no transcription/provider call
    assert asyncio.run(stt.transcribe(recording(),'android.m4a'))=='A real contract transcript.'
    config=json.loads((profile/'config.json').read_text());config['stt'].update(provider='openai',model='new-model',language='en');(profile/'config.json').write_text(json.dumps(config))
    assert asyncio.run(stt.transcribe(recording(),'browser.webm'))=='A real contract transcript.'
    calls=[json.loads(line) for line in (profile/'calls.jsonl').read_text().splitlines()]
    assert [c['provider'] for c in calls]==['groq','openai']
    assert calls[1]['model']=='new-model' and calls[1]['language']=='en'
    assert all(c['credential']=='profile-private-value' and c['source']=='gateway' for c in calls)


def test_provider_failure_is_actionable_redacted_and_not_retried_with_whisper(hermes):
    _,profile=hermes
    (profile/'config.json').write_text(json.dumps({'stt':{'provider':'groq','model':'chosen-model','language':'de','fail':True}}))
    with pytest.raises(SpeechError) as error:asyncio.run(HermesSTT('http://localhost:8642').transcribe(recording(),'voice.ogg'))
    assert error.value.code=='hermes_stt_provider_failed' and 'Quota exceeded' in str(error.value)
    assert 'profile-private-value' not in str(error.value)
    assert len((profile/'calls.jsonl').read_text().splitlines())==1


def test_disabled_stt_and_invalid_media_never_call_provider(hermes):
    _,profile=hermes
    (profile/'config.json').write_text(json.dumps({'stt':{'provider':'groq','enabled':False}}))
    assert asyncio.run(HermesSTT('http://localhost:8642').check())['code']=='hermes_stt_disabled'
    with pytest.raises(SpeechError):asyncio.run(HermesSTT('http://localhost:8642').transcribe(recording(),'voice.wav'))
    (profile/'config.json').write_text(json.dumps({'stt':{'provider':'groq'}}))
    with pytest.raises(SpeechError) as error:asyncio.run(HermesSTT('http://localhost:8642').transcribe(b'not audio','voice.wav'))
    assert error.value.code=='hermes_stt_decode_failed'
    assert not (profile/'calls.jsonl').exists()


def test_remote_http_api_does_not_pick_an_unrelated_local_hermes(monkeypatch):
    monkeypatch.delenv('CURDR_HERMES_HOME',raising=False);monkeypatch.delenv('CURDR_HERMES_PYTHON',raising=False)
    with pytest.raises(SpeechError) as error:runtime_paths('http://192.168.1.20:8642')
    assert error.value.code=='hermes_stt_host_required'


def test_implicit_default_profile_must_match_the_connected_api_key(hermes,monkeypatch):
    _,profile=hermes;monkeypatch.delenv('CURDR_HERMES_HOME');monkeypatch.setenv('HERMES_HOME',str(profile))
    status=asyncio.run(HermesSTT('http://localhost:8642',key='another-profile-key').check())
    assert status['ready'] is False and status['code']=='hermes_stt_profile_mismatch'
    assert asyncio.run(HermesSTT('http://localhost:8642',key='expected-key').check())['ready'] is True
