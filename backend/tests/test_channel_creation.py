import asyncio,json
import pytest
from fastapi import HTTPException
from app.db import Database
from app.channel_creation import create_requested_channel

class Agent:
    def __init__(self,result):self.result=result;self.calls=[]
    async def ask(self,*args,**kwargs):self.calls.append((args,kwargs));return self.result

def test_agent_created_channel_validates_context(tmp_path):
    db=Database(tmp_path/'channels.db');agent=Agent(json.dumps({'id':'research','name':'Customer research','context':'Own customer interviews and validate the first paid use case.'}))
    asyncio.run(create_requested_channel(db,agent,'Customer interviews','main'))
    assert agent.calls[0][1]['purpose']=='channel'
    assert db.get('channels','research')['name']=='Customer research'
    assert not db.get('meta','channel-intent:main')['pending']
    db.conn.close()

@pytest.mark.parametrize('output',['not json','{"id":"main","name":"Main","context":"overwrite coordinator"}','{"id":"bad/path","name":"Bad","context":"Do something"}'])
def test_invalid_agent_output_never_creates_channel(tmp_path,output):
    db=Database(tmp_path/'channels.db')
    with pytest.raises(HTTPException):asyncio.run(create_requested_channel(db,Agent(output),'Research','main'))
    assert db.all('channels')==[];db.conn.close()


def test_channel_agent_gets_json_contract_not_visual_instructions():
    import httpx
    from app.existing_hermes import ExistingHermes
    def handle(request):
        body=json.loads(request.content);instructions=body['messages'][0]['content']
        assert 'Channel setup: return only' in instructions
        assert 'Allowed blocks:' not in instructions
        return httpx.Response(200,json={'choices':[{'message':{'content':'{"question":"Which purpose?"}'},'finish_reason':'stop'}]})
    agent=ExistingHermes('http://hermes:8642',key='test',transport=httpx.MockTransport(handle))
    result=asyncio.run(agent.ask('Research',{'sbx':True},purpose='channel'))
    assert json.loads(result)['question']=='Which purpose?'
