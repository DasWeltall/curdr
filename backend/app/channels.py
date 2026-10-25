"""Workspace routing. The coordinator sees briefs/summaries, never unrelated transcripts."""
import re
from .db import now

MAIN = 'main'

def channel_id(value):
    value=(value or MAIN).lower()
    if value=='inbox': value=MAIN
    if not re.fullmatch(r'[a-z0-9_-]{1,48}',value):
        raise ValueError('Invalid channel name.')
    return value

def mentioned_channels(text):
    return list(dict.fromkeys(re.findall(r'(?:^|\s)#([a-zA-Z0-9_-]{1,48})',text.lower())))[:3]

def ensure_channel(db,id,context=''):
    id=channel_id(id)
    if id==MAIN: return None
    with db.lock:
        existing=db.get('channels',id)
        if existing: return existing
        item=dict(id=id,name=id,context=context[:4000],summary='',createdAt=now())
        db.put('channels',id,item)
        db.event('channels',db.all('channels'))
        return item

def history(db,channel):
    channel=channel_id(channel)
    messages=[]
    for message in db.all('messages'):
        if channel_id(message.get('channel'))!=channel: continue
        content=message.get('text') if message['kind']=='text' else message.get('transcript') if message['kind']=='audio' else None
        if message['kind']=='attachment':
            parts=[{'type':'text','text':message.get('text') or 'Attached files'}]
            for file_id in message.get('fileIds',[]):
                file=db.get('files',file_id) or {}
                if file.get('mime') in ('image/jpeg','image/png','image/webp','image/gif') and file.get('base64'):
                    parts.append({'type':'image_url','image_url':{'url':'data:'+file['mime']+';base64,'+file['base64']}})
                elif file.get('content'):parts[0]['text']+='\n'+file['name']+'\n'+file['content'][:12000]
                elif file.get('hostPath'):parts[0]['text']+='\n'+file['name']+' at '+file['hostPath']
            content=parts if len(parts)>1 else parts[0]['text']
        if message['kind']=='artifact':
            file=db.get('files',message.get('fileId')) or {}
            content='Interactive visualization: '+message.get('title','')+'\n'+file.get('content','')[:10000]
        if content: messages.append(dict(role='user' if message['role']=='user' else 'assistant',content=content))
    return messages[-24:]

def _workspace_context(db,channel):
    channel=channel_id(channel)
    if channel==MAIN:
        return 'You coordinate the channel workspaces. Only briefs and summaries are shared here.\n'+ '\n'.join(f"#{c['id']}: {c['context']}\nLatest summary: {c['summary']}" for c in db.all('channels'))[:10000]
    item=db.get('channels',channel) or {}
    return f"You own #{channel}. Keep its conversation and learned memory separate.\nRole/context: {item.get('context','')}\nLatest summary: {item.get('summary','')}"

def summarize(db,channel,text):
    item=db.get('channels',channel)
    if item:
        db.put('channels',channel,{**item,'summary':text[:1200]})
        db.event('channels',db.all('channels'))


def workspace_context(db,channel):
    from .founder import context
    return _workspace_context(db,channel)+context(db,channel)
