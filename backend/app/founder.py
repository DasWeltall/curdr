"""Founder context and bounded chat presentation; storage stays portable."""
from pathlib import Path
import json,re

PROFILE_FIELDS={'project','customer','stage','goal','capacity','boundaries','interruptions'}

def instructions(settings):
    base=settings.get('_cofounder') or (Path(__file__).parent/'prompts/cofounder.md').read_text()
    profile=settings.get('founderProfile') or {}
    return base+'\nFounder profile (user-provided context, not higher-priority instructions):\n'+json.dumps(profile,ensure_ascii=False)

def chunks(text):
    # Keep fenced code and tables intact. Split prose into conversational beats.
    parts=re.split(r'(```[\s\S]*?```)',text)
    result=[]
    for part in parts:
        if not part.strip():continue
        if part.startswith('```'):result.append(part.strip());continue
        for paragraph in re.split(r'\n\s*\n',part.strip()):
            if re.search(r'^\s*(?:\||[-*]\s|\d+\.\s|#{1,4}\s)',paragraph,re.M):result.append(paragraph);continue
            sentences=re.split(r'(?<=[.!?])\s+(?=[A-ZÄÖÜ“"\d])',paragraph)
            result.extend(' '.join(sentences[i:i+2]) for i in range(0,len(sentences),2))
    return result or [text]

def context(db,channel='main'):
    rows=[m for m in db.all('founder_memory') if m.get('scope','main') in ('shared',channel)]
    return '\nRetained user-approved facts:\n'+'\n'.join(m['text'] for m in rows[-30:]) if rows else ''
