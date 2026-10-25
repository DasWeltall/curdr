import json
import os
import re
import httpx
from .db import uid


class Runner:
    """Hermes is reached only over the internal Docker network, never imported here."""
    def __init__(self):
        self.existing = None
        if os.getenv('CURDR_HERMES_API_URL'):
            from .existing_hermes import ExistingHermes
            self.existing = ExistingHermes()
        self.audio_ready = False
        self.mode = os.getenv('CURDR_AGENT_MODE', 'hermes')
        self.url = os.getenv('CURDR_HERMES_URL', 'http://hermes:8090')

    async def health(self):
        if self.mode!='hermes':
            return False
        self.audio_ready = False
        if self.existing:
            ready = await self.existing.health()
            self.audio_ready = self.existing.audio_ready
            return ready
        try:
            async with httpx.AsyncClient(timeout=12) as client:
                result=await client.get(f'{self.url}/health')
                self.audio_ready = result.status_code==200 and result.json().get('audio_ready') is True
                return result.status_code==200 and result.json().get('ready') is True
        except (httpx.HTTPError,ValueError):
            return False

    async def ask(self, text, settings, history=None, purpose='chat', skills=None, channel='main', workspace=''):
        if not settings['sbx']:
            raise ValueError('Hermes is paused in Settings.')
        if getattr(self,'existing',None):
            return await self.existing.ask(text,settings,history,purpose,skills,channel,workspace)
        if self.mode == 'mock':
            if purpose == 'braindump':
                chunks = [s.strip() for s in re.split(r'\n+|;\s*|(?<=[.!?])\s+', text) if s.strip()][:12]
                return json.dumps([dict(title=re.sub(r'#[\w-]+','',s).strip()[:160], sub='Test fixture · review first', channel=(re.search(r'#([\w-]+)',s).group(1) if re.search(r'#([\w-]+)',s) else 'inbox')) for s in chunks])
            return 'Test runner response. Set CURDR_AGENT_MODE=hermes for real requests.'
        from .founder import instructions
        workspace=instructions(settings)+'\n'+workspace
        async with httpx.AsyncClient(timeout=110) as client:
            res = await client.post(f'{self.url}/run', json=dict(text=text[:22000], model=settings['model'], style='kurz', purpose=purpose, history=history or [], skills=skills or [],channel=channel,workspace=f"User name: {settings.get('name') or 'not provided'}.\n"+workspace))
            res.raise_for_status()
            return res.json()['text']

    async def transcribe(self, data, filename):
        if self.mode!='hermes':
            raise ValueError('Transcription requires Hermes.')
        if getattr(self,'existing',None):
            return await self.existing.transcribe(data,filename)
        async with httpx.AsyncClient(timeout=180) as client:
            res=await client.post(f'{self.url}/transcribe',files={'file':(filename,data,'application/octet-stream')})
            res.raise_for_status()
            text=res.json().get('text','').strip()
            if not text:
                raise ValueError('No speech detected.')
            return text

    async def decompose(self, text, settings):
        output = await self.ask(text, settings, purpose='braindump')
        clean = re.sub(r'^```(?:json)?\s*|\s*```$', '', output.strip())
        items = json.loads(clean)
        if not isinstance(items, list) or len(items) > 12:
            raise ValueError('The agent returned an invalid task list.')
        result=[]
        for item in items:
            if not isinstance(item, dict) or not isinstance(item.get('title'), str) or not item['title'].strip():
                raise ValueError('A task title is missing. Try again.')
            channel = str(item.get('channel', 'inbox')).strip().lstrip('#')
            if not re.fullmatch(r'[\w-]{1,64}', channel):
                channel='inbox'
            result.append(dict(id=uid(),title=item['title'].strip()[:160],sub=str(item.get('sub',''))[:300],channel=channel,kind=item.get('kind') if item.get('kind') in ('task','idea','note') else 'task'))
        return result
