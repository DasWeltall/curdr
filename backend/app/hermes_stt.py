"""Invoke STT in the owner's Hermes environment, using its selected profile/provider."""
import asyncio
import importlib.util
import json
import os
from pathlib import Path
import shlex
import shutil
import signal
import sys
import tempfile
from urllib.parse import urlsplit
from .errors import public_text


class SpeechError(ValueError):
    def __init__(self, message, code='hermes_stt_failed', status=502):
        super().__init__(public_text(message))
        self.code,self.status=code,status

    @property
    def detail(self):
        return {'code':self.code,'message':str(self),'source':'hermes'}


def runtime_paths(url='http://127.0.0.1:8642'):
    """Only infer a local Hermes for loopback APIs; remote profiles must be explicit."""
    explicit_home=os.getenv('CURDR_HERMES_HOME')
    explicit_python=os.getenv('CURDR_HERMES_PYTHON')
    explicit_root=os.getenv('CURDR_HERMES_ROOT')
    if urlsplit(url).hostname not in ('localhost','127.0.0.1','::1') and not (explicit_home and explicit_python):
        raise SpeechError('Run the curdr gateway beside Hermes, or explicitly configure its local Hermes Python and profile. The Hermes HTTP API does not expose Telegram transcription.', 'hermes_stt_host_required',503)
    home=Path(explicit_home or os.getenv('HERMES_HOME') or Path.home()/'.hermes').expanduser().absolute()
    roots=[Path(explicit_root).expanduser().absolute()] if explicit_root else [home/'hermes-agent',Path.home()/'.hermes/hermes-agent']
    candidates=[]
    if explicit_python:candidates.append(Path(explicit_python).expanduser().absolute())
    else:
        entry=shutil.which('hermes')
        if entry:
            try:
                line=Path(entry).read_text().splitlines()[0]
                parts=shlex.split(line[2:]) if line.startswith('#!') else []
                if parts and Path(parts[0]).is_absolute() and Path(parts[0]).name.startswith('python'):candidates.append(Path(parts[0]))
            except (OSError,UnicodeError,IndexError,ValueError):pass
        candidates.extend(root/'.venv/bin/python' for root in roots)
        candidates.extend(root/'venv/bin/python' for root in roots)
        try:
            if importlib.util.find_spec('hermes_cli'):candidates.append(Path(sys.executable))
        except (ImportError,ValueError):pass
    python=next((p for p in candidates if p.is_file() and os.access(p,os.X_OK)),None)
    if not python:raise SpeechError('Hermes Python was not found. Run curdr-gateway configure --hermes-python /path/to/hermes/.venv/bin/python --hermes-home /path/to/active/profile, then restart curdr.', 'hermes_stt_runtime_missing',503)
    if not home.is_dir():raise SpeechError('The configured Hermes profile directory does not exist.', 'hermes_stt_profile_missing',503)
    if not explicit_root:roots.insert(0,python.parent.parent.parent)
    root=next((p for p in roots if (p/'tools/transcription_tools.py').is_file() and (p/'hermes_cli').is_dir()),None)
    if explicit_root and not root:raise SpeechError('The configured Hermes source directory has no transcription module.', 'hermes_stt_runtime_missing',503)
    # Do not resolve Python's symlink: that would discard the virtual environment.
    return python,home,root


class HermesSTT:
    def __init__(self,url,key=None):self.url,self.key=url,key

    async def invoke(self,source=None):
        python,home,root=runtime_paths(self.url)
        env={**os.environ,'HERMES_HOME':str(home),'PYTHONUNBUFFERED':'1','PYTHONIOENCODING':'utf-8'}
        for key in ('HERMES_PROFILE','HERMES_CONFIG','HERMES_ENV','PYTHONPATH','PYTHONHOME'):
            env.pop(key,None)
        worker=Path(__file__).with_name('hermes_stt_worker.py')
        args=[str(python),str(worker),'--home',str(home)]
        if not os.getenv('CURDR_HERMES_HOME'):
            expected=self.key
            if not expected and os.getenv('CURDR_HERMES_API_KEY_FILE'):expected=Path(os.environ['CURDR_HERMES_API_KEY_FILE']).read_text().strip()
            env['CURDR_STT_API_KEY']=expected or ''
            args+=['--verify-profile']
        if root:args+=['--root',str(root)]
        args+=['--source',str(source)] if source else ['--check']
        process=await asyncio.create_subprocess_exec(*args,env=env,cwd=str(root or home),stdout=asyncio.subprocess.PIPE,stderr=asyncio.subprocess.DEVNULL,start_new_session=os.name=='posix')
        try:
            output,_=await asyncio.wait_for(process.communicate(),180 if source else 20)
        except BaseException as error:
            if process.returncode is None:
                try:
                    if os.name=='posix':os.killpg(process.pid,signal.SIGKILL)
                    else:process.kill()
                except ProcessLookupError:pass
            await process.wait()
            if isinstance(error,asyncio.TimeoutError):raise SpeechError('Hermes transcription timed out.' if source else 'Hermes speech configuration check timed out.','hermes_stt_timeout',504) from None
            raise
        try:
            if len(output)>200000:raise ValueError()
            result=json.loads(output)
            if not isinstance(result,dict):raise ValueError()
        except (ValueError,UnicodeError):raise SpeechError('Hermes speech worker returned an invalid response. Check that the configured Python belongs to Hermes.','hermes_stt_runtime_invalid',503) from None
        if process.returncode or result.get('error'):
            raise SpeechError(result.get('error') or 'Hermes transcription failed.',result.get('code','hermes_stt_failed'),result.get('status',502))
        return result

    async def check(self):
        try:return await self.invoke()
        except (SpeechError,OSError) as error:
            return {'ready':False,'code':getattr(error,'code','hermes_stt_runtime_missing'),'error':public_text(error)}

    async def transcribe(self,data,filename):
        with tempfile.TemporaryDirectory(prefix='curdr-voice-') as directory:
            source=Path(directory)/('voice'+Path(filename).suffix)
            source.write_bytes(data)
            result=await self.invoke(source)
            text=result.get('text')
            if not isinstance(text,str) or not text.strip():raise SpeechError('No speech detected.','hermes_stt_empty',422)
            return text.strip()[:20000]
