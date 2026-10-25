"""Offline Whisper command used through Hermes' original local STT provider."""
import sys
from pathlib import Path
from faster_whisper import WhisperModel

source, output = sys.argv[1:3]
model = WhisperModel('/opt/curdr-stt', device='cpu', compute_type='int8', cpu_threads=2)
segments, _ = model.transcribe(source, beam_size=3, vad_filter=True, condition_on_previous_text=False)
text = ' '.join(segment.text.strip() for segment in segments if segment.no_speech_prob < .6 and segment.avg_logprob > -1.0).strip()
Path(output,'transcript.txt').write_text(text,encoding='utf-8')
