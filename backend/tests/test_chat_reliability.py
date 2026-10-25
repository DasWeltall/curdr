import asyncio,json
from fastapi.testclient import TestClient
from app.db import Database
from app.main import create_app
from app.runner import Runner
from app.live import LiveRuntime
from app.founder import instructions

class ChatRunner(Runner):
 def __init__(self):self.mode='hermes';self.calls=0
 async def health(self):return True
 async def ask(self,*args,**kwargs):self.calls+=1;return 'One useful next move.'
 async def transcribe(self,*args):return 'Prepare launch.'

def test_same_message_retry_is_idempotent_and_original_command_stays_readable(tmp_path,monkeypatch):
 monkeypatch.setenv('CURDR_TOKEN','test-token-abcdefghijklmnopqrstuvwxyz');runner=ChatRunner()
 app=create_app(str(tmp_path/'chat.db'),runner)
 with TestClient(app,headers={'Authorization':'Bearer test-token-abcdefghijklmnopqrstuvwxyz'}) as client:
  data={'text':'Hi','client_id':'u-123456789','channel':'main'}
  assert client.post('/message',json=data).status_code==200
  assert client.post('/message',json=data).status_code==200
  assert runner.calls==1
  assert client.post('/message',json={**data,'text':'Different'}).status_code==409
  assert client.post('/message',json={'text':'/reality-check An idea','client_id':'u-987654321'}).status_code==200
  snap=client.get('/snapshot').json()
  assert next(m for m in snap['messages'] if m['id']=='u-987654321')['text']=='/reality-check An idea'

def test_database_upsert_preserves_message_order_across_reconnect(tmp_path):
 db=Database(tmp_path/'db');first=db.message('One');second=db.message('Two')
 db.event('message',{**first,'text':'One updated'})
 assert [m['id'] for m in db.snapshot()[0]['messages']]==[first['id'],second['id']]
 db.conn.close()

def test_replayed_hermes_delta_is_not_appended_twice(tmp_path):
 async def scenario():
  db=Database(tmp_path/'db');runtime=LiveRuntime(db,ChatRunner())
  event={'event':'message.delta','run_id':'run','seq':4,'delta':'Hello'}
  await runtime.event(event);await runtime.event(event)
  assert runtime.text['main']=='Hello'
  db.conn.close()
 asyncio.run(scenario())

def test_chat_skill_is_loaded_only_into_curdr_request_instructions():
 text=instructions({'founderProfile':{}})
 assert '# curdr chat' in text and '55 prose words' in text
 assert 'Never edit global SOUL.md or AGENTS.md' in text
 assert 'em dashes or en dashes' in text


def test_voice_retry_keeps_one_recording_and_one_agent_run(tmp_path,monkeypatch):
 monkeypatch.setenv('CURDR_TOKEN','test-token-abcdefghijklmnopqrstuvwxyz');runner=ChatRunner()
 app=create_app(str(tmp_path/'voice.db'),runner)
 with TestClient(app,headers={'Authorization':'Bearer test-token-abcdefghijklmnopqrstuvwxyz'}) as client:
  data={'duration':'2.5','channel':'main','peaks':'[0.1,0.7]','client_id':'u-voice123456'}
  for _ in range(2):
   response=client.post('/audio',data=data,files={'file':('voice.m4a',b'actual-audio-fixture','audio/mp4')})
   assert response.status_code==200,response.text
  assert runner.calls==1
  snap=client.get('/snapshot').json()
  voices=[m for m in snap['messages'] if m['kind']=='audio']
  assert len(voices)==1 and voices[0]['id']==data['client_id'] and voices[0]['transcript']=='Prepare launch.'
  assert client.post('/audio',data=data,files={'file':('voice.m4a',b'different-bytes','audio/mp4')}).status_code==409
