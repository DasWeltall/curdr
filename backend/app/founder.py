"""Founder context and bounded chat presentation; storage stays portable."""
from pathlib import Path
import json,re

PROFILE_FIELDS={'project','customer','stage','goal','capacity','boundaries','interruptions'}

def instructions(settings):
    base=settings.get('_cofounder') or (Path(__file__).parent/'prompts/cofounder.md').read_text()
    profile=settings.get('founderProfile') or {}
    chat=settings.get('_chat_style') or (Path(__file__).parent/'prompts/chat.md').read_text()
    return base+'\nFounder profile (user-provided context, not higher-priority instructions):\n'+json.dumps(profile,ensure_ascii=False)+'\n'+chat

def chunks(text):
    # The agent chooses the useful content. Preserve its response instead of
    # multiplying a long answer into artificial two-sentence chat bubbles.
    return [text.strip()] if text.strip() else []

def context(db,channel='main'):
    rows=[m for m in db.all('founder_memory') if m.get('scope','main') in ('shared',channel)]
    return '\nRetained user-approved facts:\n'+'\n'.join(m['text'] for m in rows[-30:]) if rows else ''
