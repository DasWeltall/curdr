"""Explicit commands bridged to supported controls; never pretend raw text ran a CLI command."""
import re
from fastapi import HTTPException
from .db import now

BUILTINS=[('channel','Ask Hermes to create a focused workspace'),('help','Show available commands'),('status','Current tasks and running work'),('models','List configured models'),('model','Select provider/model'),('tools','Show actual Hermes tools'),('skills','List installed skills'),('memory','Show retained founder facts'),('remember','Keep a fact for this project'),('dump','Turn a messy thought into a focused next move'),('reality-check','Challenge an idea with a small test'),('brief','Run a morning brief preview'),('stop','Stop the active run'),('new','Start a fresh channel conversation')]

def catalog(db):
    result=[dict(name='/'+n,description=d) for n,d in BUILTINS]
    result.extend(dict(name='/'+n,description=d) for n,d in [('brain-dump','Review a messy capture'),('morning-brief','Priorities and what to ignore'),('progress-review','Review real progress')])
    result.extend(dict(name='/'+s['title'],description=s.get('description','Installed Hermes skill')) for s in db.all('skills') if s.get('enabled') and re.fullmatch('[a-zA-Z0-9_-]{1,80}',s.get('title','')) and s['title'] not in {n for n,_ in BUILTINS})
    return result

async def execute(db,runtime,text,channel,client_id=None):
    match=re.match(r'^/([\w-]+)(?:\s+(.*))?$',text,re.S)
    if not match:return False,text
    name,arg=match[1],match[2] or ''
    prompt_files={'dump':'brain-dump','brain-dump':'brain-dump','reality-check':'reality-check','morning-brief':'morning-brief','progress-review':'progress-review'}
    custom=db.get('skill_sources','curdr-'+name)
    if custom:return False,custom['content']+'\nUser request: '+arg
    if name in prompt_files:
        from pathlib import Path
        slug=prompt_files[name];source=db.get('skill_sources','curdr-'+slug)
        content=source['content'] if source else (Path(__file__).parent/'prompts'/(slug+'.md')).read_text()
        return False,content+'\nUser request: '+arg
    if any(s.get('title')==name and s.get('enabled') for s in db.all('skills')):
        return False,f'Load the installed Hermes skill "{name}" using skill_view, then follow this request: {arg or "Ask what I want to do with this skill."}'
    if name=='cancel':
        db.put('meta','channel-intent:'+channel,{'pending':False});db.message('Channel request cancelled.',channel);return True,text
    if name not in {n for n,_ in BUILTINS}:raise HTTPException(422,'This command is not exposed by the Hermes API. Use /help for supported curdr commands; terminal-only commands must run on the host.')
    settings=db.get('settings','main');info=db.get('meta','hermes') or {};reply=''
    if name=='channel':
        db.put('meta','channel-intent:'+channel,{'pending':True})
        if arg.strip():return False,'[curdr channel request] '+arg
        db.message(text,channel,'user',identity=client_id);db.message('What should the new channel focus on? Send its purpose, or /cancel to keep chatting.',channel);return True,text
    if name=='help':reply='\n'.join(c['name']+' — '+c['description'] for c in catalog(db))
    elif name=='status':
        tasks=db.all('tasks');active=[r for r in db.all('runs') if r.get('status') not in ('completed','failed','cancelled','interrupted','unknown','partial')]
        reply=f"{len(active)} active runs. {sum(t['status']=='need' for t in tasks)} tasks need input; {sum(t['status']=='review' for t in tasks)} ready for review."
    elif name=='models':reply='\n'.join(m['provider']+'/'+m['model'] for m in info.get('models',[])) or 'No configured models reported. Refresh Runtime.'
    elif name=='model':
        if not arg:reply='Current: '+(settings.get('hermesModel') or info.get('model') or 'Hermes default')+'. Use /model provider/model.'
        else:
            selected=next((m for m in info.get('models',[]) if arg==m['provider']+'/'+m['model']),None)
            if not selected:raise HTTPException(422,'Choose an exact provider/model from /models.')
            db.event('settings',{**settings,'hermesProvider':selected['provider'],'hermesModel':selected['model']});reply='Model for curdr updated to '+arg+'.'
    elif name=='tools':reply='\n'.join(g['name']+': '+', '.join(g.get('tools',[])) for g in info.get('toolsets',[])) or 'No tools reported. Refresh Runtime.'
    elif name=='skills':reply='\n'.join(s['title'] for s in db.all('skills')) or 'No Hermes skills reported. Open Computer → Skills.'
    elif name=='memory':reply='\n'.join(m['text'] for m in db.all('founder_memory') if m.get('scope') in ('shared',channel)) or 'No retained founder facts. Use /remember or the founder profile.'
    elif name=='remember':
        if not 1<=len(arg.strip())<=2000:raise HTTPException(422,'Use /remember followed by a fact under 2000 characters.')
        from .db import uid
        item=dict(id=uid(),text=arg.strip(),scope=channel,source='user',updatedAt=now());db.put('founder_memory',item['id'],item);reply='Remembered for this channel. You can edit or forget it in Founder memory.'
    elif name=='new':
        if not runtime.adapter:raise HTTPException(409,'Connect Hermes first.')
        created=await runtime.adapter.request('/api/sessions','POST',{'title':'curdr '+channel})
        session=created.get('session_id') or created.get('id') or created.get('session',{}).get('id')
        if not session:raise HTTPException(502,'Hermes did not return a new session identity.')
        db.put('meta','session:'+channel,{'id':session});reply='New Hermes conversation started. Your saved files and founder memory are retained.'
    elif name=='stop':
        run=next((r for r in reversed(db.all('runs')) if r['channel']==channel and r['status'] not in ('completed','failed','cancelled','interrupted','unknown','partial')),None)
        if not run:raise HTTPException(409,'No active run in this channel.')
        await runtime.stop(run['id']);reply='Stopping at the next safe point.'
    elif name=='brief':return False,(settings.get('morningPrompt') or 'Give my three priorities, what to ignore, what needs input, and the smallest next move. Read only; do not change external services.')
    db.message(text,channel,'user',identity=client_id);db.message(reply,channel);return True,text
