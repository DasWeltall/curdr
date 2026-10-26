"""Run with Hermes' Python, never the curdr environment. No model/provider overrides."""
import argparse
import contextlib
import inspect
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
import wave


def safe_error(value):
    text=str(value or 'Hermes transcription failed.')
    for key,value in os.environ.items():
        if len(value)>=6 and re.search(r'(key|token|secret|password)',key,re.I):text=text.replace(value,'[redacted]')
    text=re.sub(r'(?i)(bearer\s+)[a-z0-9._~+/=-]+',r'\1[redacted]',text)
    text=re.sub(r'(?i)((?:api[_-]?key|access[_-]?token|password|secret)\s*[=:]\s*)[^\s,;]+',r'\1[redacted]',text)
    return text[:600]


def execute(args):
    if args.root:sys.path.insert(0,str(args.root))
    try:
        import hermes_bootstrap  # Hermes PM activation / native library paths, when available.
    except ModuleNotFoundError as error:
        if error.name!='hermes_bootstrap':raise
    # Same profile env loader as the Hermes CLI / messaging gateway.
    try:
        from hermes_cli.env_loader import load_hermes_dotenv
    except ImportError:
        from dotenv import load_dotenv
        load_dotenv(args.home/'.env',override=True)
    else:load_hermes_dotenv(hermes_home=args.home,project_env=args.root/'.env' if args.root else None)
    from hermes_cli.config import load_config
    if args.verify_profile:
        expected=os.environ.get('CURDR_STT_API_KEY','')
        actual=os.environ.get('API_SERVER_KEY','')
        if not expected or not actual or expected!=actual:return {'error':'The default Hermes profile could not be matched to this API connection. Configure --hermes-home with the active profile directory.','code':'hermes_stt_profile_mismatch','status':409}
    config=load_config();stt=config.get('stt') or {}
    provider=stt.get('provider') or 'auto'
    if stt.get('enabled') is False:return {'error':'Speech-to-text is disabled in the active Hermes profile.','code':'hermes_stt_disabled','status':409}
    if not shutil.which('ffmpeg'):return {'error':'Install FFmpeg on the Hermes host to decode voice recordings.','code':'hermes_stt_decoder_missing','status':503}
    from tools.transcription_tools import transcribe_audio
    if args.check:
        from tools import transcription_tools
        resolve=getattr(transcription_tools,'_get_provider',None)
        if resolve:
            resolved=resolve(stt) if inspect.signature(resolve).parameters else resolve()
            if resolved=='none':return {'error':'The selected Hermes speech provider is unavailable. Check its credentials and dependencies.','code':'hermes_stt_provider_unavailable','status':503}
            provider=resolved
        return {'ready':True,'provider':provider,'source':'hermes','profile':str(args.home)}
    try:
        from hermes_cli.plugins import discover_plugins
    except ImportError:pass
    else:discover_plugins()
    with tempfile.TemporaryDirectory(prefix='curdr-decode-') as directory:
        wav=Path(directory)/'voice.wav'
        subprocess.run(['ffmpeg','-nostdin','-v','error','-protocol_whitelist','file,pipe','-i',str(args.source),'-t','121','-ac','1','-ar','16000',str(wav)],check=True,timeout=30,stdin=subprocess.DEVNULL,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
        with wave.open(str(wav)) as audio:duration=audio.getnframes()/audio.getframerate()
        if not .15<=duration<=120.9:return {'error':'Recording must contain speech and be shorter than two minutes.','code':'hermes_stt_duration','status':422}
        # Telegram calls the same function with model=None and source='gateway'.
        kwargs={'source':'gateway'} if 'source' in inspect.signature(transcribe_audio).parameters else {}
        result=transcribe_audio(str(wav),None,**kwargs)
    if not isinstance(result,dict):return {'error':'Hermes returned an invalid transcription result.','code':'hermes_stt_invalid_response','status':502}
    if result.get('success') is not True:
        return {'error':safe_error(result.get('error')),'code':'hermes_stt_provider_failed','status':502}
    text=result.get('transcript')
    if not isinstance(text,str) or not text.strip():return {'error':'No speech detected.','code':'hermes_stt_empty','status':422}
    return {'text':text.strip()[:20000],'provider':result.get('provider',provider)}


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--home',type=Path,required=True);parser.add_argument('--root',type=Path);parser.add_argument('--verify-profile',action='store_true')
    mode=parser.add_mutually_exclusive_group(required=True);mode.add_argument('--check',action='store_true');mode.add_argument('--source',type=Path)
    args=parser.parse_args()
    try:
        with contextlib.redirect_stdout(sys.stderr):result=execute(args)
    except ImportError:result={'error':'Hermes transcription dependencies could not be imported. Configure its actual Python environment.','code':'hermes_stt_runtime_invalid','status':503}
    except subprocess.TimeoutExpired:result={'error':'Audio decoding timed out.','code':'hermes_stt_decode_timeout','status':504}
    except subprocess.CalledProcessError:result={'error':'The recording could not be decoded.','code':'hermes_stt_decode_failed','status':422}
    except Exception as error:result={'error':safe_error(error),'code':'hermes_stt_provider_failed','status':502}
    print(json.dumps(result))

if __name__=='__main__':main()
