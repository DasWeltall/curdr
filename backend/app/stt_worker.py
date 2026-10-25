"""Decode bounded media offline, then transcribe locally with Whisper."""
import contextlib
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import wave

with tempfile.TemporaryDirectory(prefix='curdr-decode-') as directory:
    wav=Path(directory)/'voice.wav'
    subprocess.run(['ffmpeg','-v','error','-protocol_whitelist','file,pipe','-i',sys.argv[1],'-t','121','-ac','1','-ar','16000',str(wav)],check=True,timeout=30,stdin=subprocess.DEVNULL,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    with wave.open(str(wav)) as stream:
        duration=stream.getnframes()/stream.getframerate()
    if not .15<=duration<=120.9: raise ValueError('Invalid recording duration.')
    with contextlib.redirect_stdout(sys.stderr):
        from faster_whisper import WhisperModel
        model=WhisperModel(os.environ['CURDR_STT_MODEL'],device='cpu',compute_type='int8',cpu_threads=2,local_files_only=True)
        segments,_=model.transcribe(str(wav),beam_size=3,vad_filter=True,condition_on_previous_text=False)
        text=' '.join(s.text.strip() for s in segments if s.no_speech_prob<.6 and s.avg_logprob>-1).strip()
    if not text: raise ValueError('No speech detected.')
    print(json.dumps({'text':text[:20000]}))
