"""Only a user-requested agent proposal creates a channel through chat."""
import json,re
from fastapi import HTTPException
from .channels import channel_id,ensure_channel,workspace_context

async def create_requested_channel(db,runtime,brief,channel,client_id=None):
    db.message(brief,channel,'user',identity=client_id)
    result=await runtime.ask('The user explicitly requested a new channel. Propose its focused scope from this brief: '+brief+'\nReturn ONLY a JSON object with id (lowercase slug, max 48 chars), name (short display title) and context (specific ownership, goal, boundaries). Do not use tools or change external services. Do not return a visualization. If the brief has no purpose, return {"question":"one focused question"}. Existing channel IDs: '+', '.join(c['id'] for c in db.all('channels')),db.get('settings','main'),purpose='channel',channel=channel,workspace=workspace_context(db,channel))
    raw=result.strip();raw=re.sub(r'^```(?:json)?\s*|\s*```$','',raw)
    try:
        value=json.loads(raw)
        if not isinstance(value,dict):raise ValueError()
        if isinstance(value.get('question'),str) and 1<=len(value['question'])<=300:
            db.message(value['question'],channel);return
        id=channel_id(value['id']);name=value['name'];context=value['context']
        if id=='main' or not isinstance(name,str) or not 1<=len(name)<=80 or not isinstance(context,str) or not 10<=len(context)<=4000:raise ValueError()
    except (ValueError,KeyError,TypeError):raise HTTPException(502,'Hermes did not return a valid channel proposal. Nothing was created; try a more specific purpose.')
    if db.get('channels',id):raise HTTPException(409,'A channel with that name already exists. Give Hermes a distinct purpose or name.')
    item=ensure_channel(db,id,context);db.put('channels',id,{**item,'name':name});db.event('channels',db.all('channels'))
    db.put('meta','channel-intent:'+channel,{'pending':False})
    db.message('Created #'+id+'. '+context.split('\n')[0][:180],channel)
