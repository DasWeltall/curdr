"""Authenticated owner controls. No arbitrary shell or filesystem proxy."""
import asyncio,hashlib,json,os,re,shutil
from pathlib import Path
import httpx
from fastapi import Depends,HTTPException
from .db import uid,now
from .founder import PROFILE_FIELDS

MORNING='Choose up to three priorities for today with reasons and one smallest next step. Say what to ignore or defer and what needs my input. Use actual goals, deadlines and evidence. Keep this short; use a compact checklist when helpful.'
CHECK='Check for meaningful new results, deadlines or blockers against my current goal. Batch findings. Name the changed fact, its source and why it needs attention now. Return exactly [SILENT] if nothing actionable changed or you cannot verify a change. Do not invent work, create fake urgency or paraphrase an unchanged reminder.'


def register(app,db,runtime,runner,auth,queue):
    home=Path(os.environ['CURDR_HERMES_HOME']).expanduser().resolve() if os.getenv('CURDR_HERMES_HOME') else None
    async def remote(path,method='GET',body=None):
        if not runtime.adapter:raise HTTPException(409,'Connect an existing Hermes API first.')
        try:return await runtime.adapter.request(path,method,body)
        except httpx.HTTPStatusError as e:
            from .errors import upstream_http_error
            raise upstream_http_error(e)
        except (ValueError,httpx.HTTPError):raise HTTPException(502,'Could not reach Hermes.')

    def setting(patch):
        value={**db.get('settings','main'),**patch};db.event('settings',value);return value

    def local_routines():
        s=db.get('settings','main')
        return [dict(id='local-morning',name='Morning brief',kind='local',enabled=s.get('briefingEnabled',False),time=s['brief'],schedule='Daily at '+s['brief'],prompt=s.get('morningPrompt') or MORNING,timezone=s.get('timezone','Europe/Berlin')),
                dict(id='local-checks',name='Background check',kind='local',enabled=s.get('proactiveChecks',False),interval=s.get('proactiveInterval',60),schedule='Every '+{30:'30 minutes',60:'1 hour',180:'3 hours',300:'5 hours'}.get(s.get('proactiveInterval',60),'1 hour'),prompt=s.get('checkPrompt') or CHECK,timezone=s.get('timezone','Europe/Berlin'))]

    @app.get('/routines',dependencies=[Depends(auth)])
    async def routines():
        jobs=(db.get('meta','hermes') or {}).get('jobs',[])
        return local_routines()+[{**j,'enabled':j.get('enabled',not j.get('paused',False)),'id':'hermes-'+str(j['id']),'remoteId':str(j['id']),'kind':'hermes'} for j in (jobs if isinstance(jobs,list) else []) if isinstance(j,dict) and isinstance(j.get('id'),(str,int))]

    @app.get('/routines/{id}',dependencies=[Depends(auth)])
    async def routine(id:str):
        if id.startswith('local-'):
            value=next((r for r in local_routines() if r['id']==id),None)
            if not value:raise HTTPException(404,'Routine not found.')
            return value
        result=await remote('/api/jobs/'+id.removeprefix('hermes-'));return {**result.get('job',result),'id':id,'kind':'hermes'}

    @app.put('/routines/{id}',dependencies=[Depends(auth)])
    async def edit_routine(id:str,body:dict):
        if set(body)-{'name','prompt','time','interval','enabled','schedule'}:raise HTTPException(422,'Unsupported routine field.')
        if 'prompt' in body and (not isinstance(body['prompt'],str) or not 1<=len(body['prompt'])<=12000):raise HTTPException(422,'Enter a prompt under 12000 characters.')
        if 'enabled' in body and type(body['enabled']) is not bool:raise HTTPException(422,'Enabled must be a boolean.')
        if id=='local-morning':
            if 'time' in body and (not isinstance(body['time'],str) or not re.fullmatch(r'(?:[01]\d|2[0-3]):[0-5]\d',body['time'])):raise HTTPException(422,'Use a valid 24-hour time, for example 07:30.')
            setting({{'prompt':'morningPrompt','enabled':'briefingEnabled','time':'brief'}[k]:v for k,v in body.items() if k in ('prompt','enabled','time')})
        elif id=='local-checks':
            if 'interval' in body and body['interval'] not in (30,60,180,300):raise HTTPException(422,'Choose 30 minutes, 1 hour, 3 hours or 5 hours.')
            setting({{'prompt':'checkPrompt','enabled':'proactiveChecks','interval':'proactiveInterval'}[k]:v for k,v in body.items() if k in ('prompt','enabled','interval')})
        elif id.startswith('hermes-'):
            payload={k:v for k,v in body.items() if k in ('name','prompt','schedule')}
            if payload:await remote('/api/jobs/'+id[7:],'PATCH',payload)
            if 'enabled' in body:await remote('/api/jobs/'+id[7:]+('/resume' if body['enabled'] else '/pause'),'POST',{})
            await runtime.refresh()
        else:raise HTTPException(404,'Routine not found.')
        return await routine(id)

    @app.post('/routines/{id}/{action}',dependencies=[Depends(auth)])
    async def run_routine(id:str,action:str):
        if action not in ('test','run'):raise HTTPException(404,'Unknown routine action.')
        item=await routine(id)
        if id.startswith('hermes-') and action=='run':
            result=await remote('/api/jobs/'+id[7:]+'/run','POST',{});await runtime.refresh();return result
        prompt=item.get('prompt')
        if not prompt:raise HTTPException(409,'Hermes did not expose a testable prompt for this routine.')
        from .channels import workspace_context
        try:
            async with queue:
                output=await runtime.ask(prompt+'\nThis is an explicit routine preview. Read only; do not send, buy, delete or change external services.',db.get('settings','main'),purpose='briefing',workspace=workspace_context(db,'main'))
                if output.strip()!='[SILENT]':runtime.finish(output,'main')
        except (ValueError,httpx.HTTPError):raise HTTPException(502,'Routine preview failed. Check Hermes and its model.')
        return {'ok':True,'output':output,'tested':action=='test'}

    @app.get('/captures',dependencies=[Depends(auth)])
    async def captures():return list(reversed(db.all('brain_dumps')))[0:30]

    @app.post('/captures/drafts/{id}/park',dependencies=[Depends(auth)])
    async def park(id:str):
        row=db.conn.execute('SELECT data FROM drafts WHERE id=?',(id,)).fetchone()
        if not row:raise HTTPException(404,'Capture item not found.')
        value=json.loads(row[0]);item={**value,'id':id,'parkedAt':now()};db.put('parked_ideas',id,item);return item

    @app.get('/captures/parked',dependencies=[Depends(auth)])
    async def parked():return db.all('parked_ideas')

    @app.get('/founder/memory',dependencies=[Depends(auth)])
    async def memory():return db.all('founder_memory')

    @app.put('/founder/memory/{id}',dependencies=[Depends(auth)])
    async def remember(id:str,body:dict):
        if set(body)-{'text','scope'} or not isinstance(body.get('text'),str) or not 1<=len(body['text'].strip())<=2000:raise HTTPException(422,'Enter a fact under 2000 characters.')
        from .channels import channel_id
        try:scope='shared' if body.get('scope')=='shared' else channel_id(body.get('scope','main'))
        except ValueError:raise HTTPException(422,'Invalid memory scope.')
        item=dict(id=id if id!='new' else uid(),text=body['text'].strip(),scope=scope,source='user',updatedAt=now());db.put('founder_memory',item['id'],item);return item

    @app.post('/founder/memory/{id}/forget',dependencies=[Depends(auth)])
    async def forget(id:str):
        with db.lock:db.conn.execute('DELETE FROM objects WHERE kind=? AND id=?',('founder_memory',id))
        return {'ok':True}

    def workspace_path(relative=''):
        root=runtime.root
        if not root:raise HTTPException(409,'Configure a shared workspace directory on the gateway host.')
        parts=Path(relative).parts
        if any(p.startswith('.') or p in ('..','~') for p in parts):raise HTTPException(422,'Choose a visible path inside the shared workspace.')
        candidate=root/relative
        if candidate.is_symlink() or any(p.is_symlink() for p in [candidate,*candidate.parents] if p!=root and root in p.parents):raise HTTPException(422,'Symlinks are not browsable.')
        resolved=candidate.resolve()
        if resolved!=root and root not in resolved.parents:raise HTTPException(422,'Path is outside the shared workspace.')
        return root,resolved

    @app.get('/workspace',dependencies=[Depends(auth)])
    async def browse(path:str=''):
        root,folder=workspace_path(path)
        if not folder.is_dir():raise HTTPException(404,'Folder not found.')
        entries=[]
        for p in sorted(folder.iterdir(),key=lambda p:(not p.is_dir(),p.name.lower())):
            if p.name.startswith('.') or p.is_symlink():continue
            entries.append(dict(name=p.name,path=p.relative_to(root).as_posix(),directory=p.is_dir(),size=0 if p.is_dir() else p.stat().st_size))
            if len(entries)>=300:break
        return dict(path=folder.relative_to(root).as_posix().replace('.','',1) if folder==root else folder.relative_to(root).as_posix(),entries=entries)

    @app.get('/workspace/file',dependencies=[Depends(auth)])
    async def read_file(path:str):
        import base64,mimetypes
        root,p=workspace_path(path)
        if not p.is_file():raise HTTPException(404,'File not found.')
        if p.stat().st_size>10*1024*1024:raise HTTPException(413,'Preview supports files up to 10 MB.')
        mime=mimetypes.guess_type(p.name)[0] or 'application/octet-stream';data=p.read_bytes()
        item=dict(id='browse-'+hashlib.sha256(path.encode()).hexdigest()[:24],name=p.name,channel='main',updatedAt=now(),mime=mime,base64=base64.b64encode(data).decode(),origin='hermes')
        if mime.startswith('text/') or p.suffix in ('.json','.md','.csv'):item['content']=data.decode(errors='replace')
        from .visuals import Visual
        if p.name.endswith('.curdr.json'):
            try:Visual.model_validate_json(item.get('content',''));item['mime']='application/vnd.curdr.visual+json'
            except ValueError:pass
        db.event('file_added',item);return item

    def first_party():
        items=[dict(id='curdr-'+p.stem,title=p.stem.replace('-',' ').title(),source='curdr',category='Co-founder',description=p.read_text().split('\n\n')[0].split('\n')[-1],enabled=True,readOnly=False) for p in (Path(__file__).parent/'prompts').glob('*.md')]
        known={i['id'] for i in items}
        items.extend(dict(id=row['id'],title=row['id'].replace('curdr-','').replace('-',' ').title(),source='curdr',category='Custom',description=row['content'][:120],enabled=True,readOnly=False) for row in db.all('skill_sources') if row['id'] not in known)
        return items

    @app.get('/library/skills',dependencies=[Depends(auth)])
    async def skills():return dict(items=first_party()+db.all('skills'),editableHost=bool(home and (home/'skills').is_dir()),installSupported=bool(home and shutil.which('hermes')))

    def own_skill(id):
        name=id.removeprefix('curdr-')
        if not re.fullmatch('[a-z0-9-]{1,70}',name):raise HTTPException(422,'Invalid skill name.')
        path=Path(__file__).parent/'prompts'/(name+'.md')
        return (db.get('skill_sources',id) or {}).get('content') or (path.read_text() if path.is_file() else None)

    def host_skill(id):
        if not home:raise HTTPException(409,'Configure --hermes-home for local skill editing. Remote Hermes exposes discovery only.')
        name=id.removeprefix('hermes:');root=home/'skills'
        for path in root.rglob('SKILL.md'):
            if path.is_symlink() or root not in path.resolve().parents:continue
            if path.parent.name==name:return path
        raise HTTPException(404,'Skill source not found in this Hermes profile.')

    @app.get('/library/skills/{id}',dependencies=[Depends(auth)])
    async def skill_source(id:str):
        content=own_skill(id) if id.startswith('curdr-') else host_skill(id).read_text()
        if content is None:raise HTTPException(404,'Skill not found.')
        return dict(id=id,content=content,revision=hashlib.sha256(content.encode()).hexdigest())

    @app.put('/library/skills/{id}',dependencies=[Depends(auth)])
    async def save_skill(id:str,body:dict):
        content=body.get('content')
        if not isinstance(content,str) or not 1<=len(content.encode())<=65536:raise HTTPException(422,'Skill text must be under 64 KiB.')
        try:current=await skill_source(id)
        except HTTPException as e:
            if e.status_code!=404 or not id.startswith('curdr-'):raise
            own_skill(id);current={'revision':None}
        if body.get('revision')!=current['revision']:raise HTTPException(409,'Skill changed. Reload it before saving.')
        if id.startswith('curdr-'):db.put('skill_sources',id,{'id':id,'content':content})
        else:
            path=host_skill(id);backup=path.with_name('SKILL.curdr-backup.md');shutil.copy2(path,backup)
            temporary=path.with_name('SKILL.curdr-tmp');temporary.write_text(content);temporary.replace(path)
        return await skill_source(id)

    @app.post('/library/skills/install',dependencies=[Depends(auth)])
    async def install_skill(body:dict):
        slug=body.get('slug','')
        if not home or not shutil.which('hermes'):raise HTTPException(409,'Skill installation needs Hermes CLI and an explicitly configured --hermes-home on this gateway host.')
        if not isinstance(slug,str) or not re.fullmatch(r'[a-zA-Z0-9._/-]{1,200}',slug) or '..' in slug:raise HTTPException(422,'Use a source-qualified skill slug from the official Hermes hub.')
        env={**os.environ,'HERMES_HOME':str(home)}
        proc=await asyncio.create_subprocess_exec('hermes','skills','install',slug,env=env,stdin=asyncio.subprocess.DEVNULL,stdout=asyncio.subprocess.PIPE,stderr=asyncio.subprocess.STDOUT)
        try:output,_=await asyncio.wait_for(proc.communicate(),120)
        except asyncio.TimeoutError:proc.kill();await proc.wait();raise HTTPException(504,'Skill installation timed out. Inspect the host before retrying.')
        from .live import safe_text
        if proc.returncode:raise HTTPException(409,safe_text(output.decode(errors='replace'),2000) or 'Hermes did not install this skill. Review its scanner or required confirmation on the host.')
        await runtime.refresh();return {'ok':True,'output':safe_text(output.decode(errors='replace'),2000)}
