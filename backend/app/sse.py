"""SSE framing for Hermes: comments, CRLF, multiline data and replay IDs."""
import json

async def events(lines):
    data=[]; name='message'; identity=None
    async for line in lines:
        if not line:
            if data:
                raw='\n'.join(data)
                if raw=='[DONE]':yield {'event':'done','_id':identity}
                else:
                    try:value=json.loads(raw)
                    except ValueError:value=None
                    if isinstance(value,dict):yield {**value,'event':value.get('event') or value.get('type') or name,'_id':identity}
            data=[];name='message';identity=None
            continue
        if line.startswith(':'):continue
        field,_,value=line.partition(':')
        if value.startswith(' '):value=value[1:]
        if field=='data':data.append(value)
        elif field=='event':name=value
        elif field=='id' and '\0' not in value:identity=value
    if data:
        try:value=json.loads('\n'.join(data))
        except ValueError:return
        if isinstance(value,dict):yield {**value,'event':value.get('event') or value.get('type') or name,'_id':identity}
