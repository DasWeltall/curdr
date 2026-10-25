"""Bound media decoding, then use the pinned Hermes transcription implementation."""
import contextlib
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import wave

sys.path.insert(0,'/opt/hermes')
with tempfile.TemporaryDirectory(prefix='curdr-audio-') as directory:
    wav=Path(directory)/'voice.wav'
    subprocess.run(['ffmpeg','-v','error','-protocol_whitelist','file,pipe','-i',sys.argv[1],'-t','121','-ac','1','-ar','16000',str(wav)],check=True,timeout=30,stdin=subprocess.DEVNULL,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    with wave.open(str(wav)) as stream:
        duration=stream.getnframes()/stream.getframerate()
    if duration>120.9 or duration<.15:
        raise ValueError('Invalid recording duration.')
    with contextlib.redirect_stdout(sys.stderr):
        from tools.transcription_tools import transcribe_audio_local_fallback
        result=transcribe_audio_local_fallback(str(wav),model='/opt/curdr-stt')
    if result.get('success') is not True or not result.get('transcript','').strip():
        raise ValueError('No speech detected or transcription unavailable.')
    print(json.dumps({'text':result['transcript'][:20000]}))
