"""Internal worker boundary: one process per bounded Hermes turn.

No provider key, host mounts, Docker socket, terminal, browser or connectors.
The subprocess is killed if Gateway disconnects or the deadline expires.
"""
import asyncio
import json
import os
import signal
import sys
from fastapi import FastAPI, HTTPException, Request, UploadFile, File
from pydantic import BaseModel, Field

app=FastAPI(docs_url=None,redoc_url=None,openapi_url=None)
semaphore=asyncio.Semaphore(1)


class Turn(BaseModel):
    text:str=Field(min_length=1,max_length=22000)
    model:str
    purpose:str='chat'
    style:str='kurz'
    history:list[dict]=[]
    skills:list[dict]=[]
    channel:str=Field(default='main',pattern=r'^[a-z0-9_-]{1,48}$')
    workspace:str=Field(default='',max_length=15000)


@app.get('/health')
async def health():
    from pathlib import Path
    import httpx
    executable=os.environ.get('HERMES_PYTHON',sys.executable)
    if not Path('/opt/hermes/run_agent.py').is_file() or not Path(executable).is_file():
        raise HTTPException(503,'Hermes runtime missing.')
    process=await asyncio.create_subprocess_exec(executable,'-c',"import sys;sys.path.insert(0,'/opt/hermes');from run_agent import AIAgent;assert callable(AIAgent.run_conversation)",stdout=asyncio.subprocess.DEVNULL,stderr=asyncio.subprocess.DEVNULL)
    try:
        code=await asyncio.wait_for(process.wait(),timeout=8)
    except asyncio.TimeoutError:
        process.kill();await process.wait()
        raise HTTPException(503,'Hermes runtime not ready.')
    if code:
        raise HTTPException(503,'Hermes import failed.')
    try:
        async with httpx.AsyncClient(timeout=3) as client:
            proxy=await client.get('http://model-proxy:8091/health')
            configured=proxy.status_code==200 and proxy.json().get('configured') is True
    except (httpx.HTTPError,ValueError):
        configured=False
    if not configured:
        raise HTTPException(503,'Model proxy is not configured.')
    speech=await asyncio.create_subprocess_exec(os.environ.get('HERMES_PYTHON',sys.executable),'/bridge/transcribe.py','--check',stdout=asyncio.subprocess.PIPE,stderr=asyncio.subprocess.DEVNULL)
    try:
        out,_=await asyncio.wait_for(speech.communicate(),20);audio=json.loads(out)
    except (asyncio.TimeoutError,ValueError):
        if speech.returncode is None:speech.kill();await speech.wait()
        audio={'ready':False}
    return dict(ready=True,audio_ready=audio.get('ready') is True,runtime='NousResearch/hermes-agent',revision='bda3a363e9695e3f63fce4a7ca85ba17b5fecb61',tools=['memory','skills_list','skill_view','skill_manage'])


@app.post('/run')
async def run(body:Turn,request:Request):
    async with semaphore:
        process=await asyncio.create_subprocess_exec(os.environ.get('HERMES_PYTHON',sys.executable),'/bridge/worker.py',stdin=asyncio.subprocess.PIPE,stdout=asyncio.subprocess.PIPE,stderr=asyncio.subprocess.PIPE,start_new_session=True)
        communicate=asyncio.create_task(process.communicate(body.model_dump_json().encode()))
        try:
            for _ in range(400):
                done,_=await asyncio.wait({communicate},timeout=.25)
                if done:
                    out,err=communicate.result()
                    if process.returncode:
                        raise HTTPException(502,'Hermes worker failed. Check internal logs.')
                    return json.loads(out)
                if await request.is_disconnected():
                    raise HTTPException(499,'Gateway disconnected.')
            raise HTTPException(504,'Hermes deadline exceeded.')
        finally:
            if process.returncode is None:
                os.killpg(process.pid,signal.SIGKILL)
                await process.wait()
            if not communicate.done():
                communicate.cancel()


@app.post('/transcribe')
async def transcribe(file:UploadFile=File(...)):
    import tempfile
    from pathlib import Path
    data=await file.read(8*1024*1024+1)
    if not data or len(data)>8*1024*1024:
        raise HTTPException(413,'Voice message is too large.')
    suffix=Path(file.filename or 'voice.webm').suffix
    if suffix not in {'.m4a','.mp4','.webm','.ogg','.wav','.mp3'}:
        raise HTTPException(415,'Unsupported audio format.')
    async with semaphore:
        with tempfile.TemporaryDirectory(prefix='curdr-upload-') as directory:
            source=Path(directory)/('voice'+suffix)
            source.write_bytes(data)
            process=await asyncio.create_subprocess_exec(os.environ.get('HERMES_PYTHON',sys.executable),'/bridge/transcribe.py',str(source),stdout=asyncio.subprocess.PIPE,stderr=asyncio.subprocess.PIPE,start_new_session=True)
            try:
                out,_=await asyncio.wait_for(process.communicate(),timeout=160)
                if process.returncode: raise HTTPException(502,'Hermes transcription worker failed.')
                result=json.loads(out)
                if result.get('error'):raise HTTPException(result.get('status',502),{'message':result['error'],'code':result.get('code','hermes_stt_failed'),'source':'hermes'})
                return result
            except asyncio.TimeoutError:
                raise HTTPException(504,'Transcription timed out.')
            finally:
                if process.returncode is None:
                    os.killpg(process.pid,signal.SIGKILL)
                    await process.wait()
