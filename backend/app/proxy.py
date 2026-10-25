"""Narrow model proxy. Only this service sees the provider's key.

Budget accounting reserves a conservative upper bound before each request and
never refunds unknown failures. The UI reports reservations, not an invoice.
"""
import json
import os
import sqlite3
import time
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path
from urllib.parse import urlsplit
import httpx
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from .db import Database


def create_proxy(path=None, upstream_client=None):
    # Proxy must not run Gateway's startup recovery.
    db=Database(path or os.getenv('CURDR_DB','/data/curdr.db'),recover=False)
    prices=json.loads(os.getenv('CURDR_MODEL_PRICES','{}') or '{}')
    url=os.getenv('CURDR_PROVIDER_URL','https://openrouter.ai/api/v1').rstrip('/')
    parsed=urlsplit(url)
    if parsed.scheme!='https' or parsed.username or parsed.password or parsed.query or parsed.fragment:
        raise RuntimeError('CURDR_PROVIDER_URL must be a fixed HTTPS URL.')
    keyfile=Path(os.getenv('CURDR_PROVIDER_KEY_FILE','/run/secrets/provider_key'))
    app=FastAPI(title='curdr model proxy',docs_url=None,redoc_url=None,openapi_url=None)
    app.state.db=db

    @app.get('/health')
    async def health():
        return dict(configured=bool(prices) and keyfile.is_file() and bool(keyfile.read_text().strip()),models=list(prices))

    @app.post('/v1/chat/completions')
    async def completion(request:Request):
        raw=await request.body()
        if len(raw)>256000:
            raise HTTPException(413,'Model request is too large.')
        try:
            body=json.loads(raw)
        except (ValueError,UnicodeError):
            raise HTTPException(422,'Invalid JSON.')
        model=body.get('model')
        price=prices.get(model)
        if not isinstance(price,dict) or not all(k in price for k in ('input','output')):
            raise HTTPException(403,'Model has no configured pricing.')
        if body.get('stream') or body.get('n',1)!=1 or body.get('functions'):
            raise HTTPException(422,'Streaming and multiple outputs are disabled.')
        messages=body.get('messages')
        allowed_tools={'memory','skills_list','skill_view','skill_manage'}
        tools=body.get('tools') or []
        if not isinstance(tools,list) or len(tools)>4 or any(not isinstance(t,dict) or t.get('type')!='function' or not isinstance(t.get('function'),dict) or t['function'].get('name') not in allowed_tools for t in tools):
            raise HTTPException(422,'Tool is not allowed in curdr.')
        if not isinstance(messages,list) or not messages:
            raise HTTPException(422,'Messages are missing.')
        for m in messages:
            if not isinstance(m,dict) or m.get('role') not in ('system','user','assistant','tool') or not (isinstance(m.get('content'),str) or m.get('role')=='assistant' and m.get('content') is None and isinstance(m.get('tool_calls'),list)):
                raise HTTPException(422,'Invalid text or tool message.')
            for call in m.get('tool_calls',[]):
                if not isinstance(call,dict) or not isinstance(call.get('function'),dict) or call['function'].get('name') not in allowed_tools:
                    raise HTTPException(422,'Unknown tool call.')
        if not keyfile.is_file() or not keyfile.read_text().strip():
            raise HTTPException(503,'Provider key is missing.')
        # Drop unsupported provider knobs instead of forwarding arbitrary options.
        output_cap=int(os.getenv('CURDR_MAX_OUTPUT_TOKENS','4096'))
        requested=body.get('max_completion_tokens',body.get('max_tokens',output_cap))
        if not isinstance(requested,int) or not 1<=requested<=output_cap:
            raise HTTPException(422,'Output limit exceeded.')
        payload=dict(model=model,messages=messages,max_tokens=requested,stream=False)
        if tools:
            payload['tools']=tools
            payload['tool_choice']='auto'
        if isinstance(body.get('temperature'),(float,int)):
            payload['temperature']=body['temperature']
        # UTF-8 bytes + per-message framing deliberately overestimate text tokens.
        input_bound=len(json.dumps(payload,ensure_ascii=False).encode('utf-8'))+512*len(messages)+1024
        reserve=(Decimal(input_bound)*Decimal(str(price['input']))+Decimal(requested)*Decimal(str(price['output'])))/Decimal(1000000)
        if not reserve.is_finite() or reserve<0:
            raise HTTPException(503,'Invalid price limit.')
        month=datetime.now(timezone.utc).strftime('%Y-%m')
        with db.lock:
            db.conn.execute('BEGIN IMMEDIATE')
            try:
                settings=db.get('settings','main')
                maximum=Decimal(str(min(settings['budget'],float(os.getenv('CURDR_MAX_BUDGET','20')))))
                row=db.conn.execute('SELECT reserved FROM spend WHERE month=?',(month,)).fetchone()
                used=Decimal(str(row[0])) if row else Decimal(0)
                if used+reserve>maximum:
                    raise HTTPException(402,'Monthly budget reached.')
                last=db.get('meta','last_model_call') or {'time':0}
                if time.time()-last['time']<float(os.getenv('CURDR_MIN_INTERVAL','2')):
                    raise HTTPException(429,'Minimum request interval has not elapsed.')
                db.conn.execute('INSERT OR REPLACE INTO spend VALUES(?,?)',(month,float(used+reserve)))
                db.put('meta','last_model_call',dict(time=time.time()))
                settings['used']=float(used+reserve)
                db.put('settings','main',settings)
                db.conn.execute('INSERT INTO events(data) VALUES(?)',(json.dumps(dict(type='settings',data=settings)),))
                db.conn.execute('COMMIT')
            except BaseException:
                db.conn.execute('ROLLBACK')
                raise
        if not keyfile.is_file() or not keyfile.read_text().strip():
            raise HTTPException(503,'Provider key is missing.')
        try:
            async with httpx.AsyncClient(timeout=85,follow_redirects=False,trust_env=False,transport=upstream_client) as client:
                res=await client.post(f'{url}/chat/completions',headers={'Authorization':f'Bearer {keyfile.read_text().strip()}'},json=payload)
                if res.status_code!=200:
                    # Never reflect provider error bodies or headers into the sandbox.
                    raise HTTPException(502,'Model provider rejected the request.')
                result=res.json()
                if not isinstance(result.get('choices'),list):
                    raise ValueError('invalid response')
                db.event('log',f"Model: {model} · reserviert {float(reserve):.6f} $ · Tokens: {result.get('usage',{}).get('total_tokens','unbekannt')}")
                return JSONResponse(result)
        except HTTPException:
            raise
        except (httpx.HTTPError,ValueError):
            raise HTTPException(502,'Model provider is unavailable.')
    return app

