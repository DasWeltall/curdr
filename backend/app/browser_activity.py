"""Import actual browser captures from explicitly shared local locations only."""
import base64
import hashlib
import json
import os
from pathlib import Path
import re
from datetime import datetime,timezone
from urllib.parse import urlsplit,urlunsplit
from .db import now
from .errors import public_text


def browser_activity(db,workspace,run,tool,preview):
    if not any(name in tool.lower() for name in ('browser','playwright','puppeteer')):return None
    value={**run.get('browser',{}),'updatedAt':now(),'action':public_text(preview or (run.get('browser') or {}).get('action') or tool,400)}
    url=re.search(r'https?://[^\s<>"\\]+',preview or '')
    if url:
        try:
            parsed=urlsplit(url.group(0).rstrip('.,;)'))
            if parsed.hostname and not parsed.username:value['url']=urlunsplit((parsed.scheme,parsed.netloc,parsed.path,'',''))
        except ValueError:pass
    roots=[]
    if workspace:roots.append(Path(workspace).resolve())
    home=os.getenv('CURDR_HERMES_HOME')
    if home:roots.extend(Path(home)/'cache'/part for part in ('screenshots','browser_screenshots','browser-use/workspace'))
    roots=[root.resolve() for root in roots if root.is_dir()]
    candidates=[]
    try:
        payload=json.loads(preview)
        if isinstance(payload,dict):
            meta=payload.get('meta')
            path=payload.get('screenshot_path') or (meta.get('screenshot_path') if isinstance(meta,dict) else None)
            if isinstance(path,str):candidates.append(Path(path))
    except (ValueError,TypeError):pass
    candidates.extend(Path(path) for path in re.findall(r'(/[^\s"\'<>]+\.(?:png|jpe?g|webp))',preview or '',re.I) if any(part in path for part in ('/cache/screenshots/','/cache/browser_screenshots/','/cache/browser-use/workspace/','/browser/'+run['channel']+'/')))
    # The agent can also publish a view under this channel's shared browser folder.
    if workspace:
        folder=Path(workspace)/'browser'/run['channel']
        if folder.is_dir() and not folder.is_symlink():
            images=[]
            try:
                for path in list(folder.iterdir())[:200]:
                    try:
                        if path.is_file() and not path.is_symlink():images.append((path.stat().st_mtime,path))
                    except OSError:continue
            except OSError:pass
            candidates.extend(path for _,path in sorted(images,key=lambda item:item[0],reverse=True)[:5])
    started=datetime.fromisoformat(run['startedAt']).timestamp()
    for candidate in candidates:
        try:
            path=candidate.resolve()
            if candidate.is_symlink() or not any(root in path.parents for root in roots) or not path.is_file():continue
            stat=path.stat()
            if stat.st_size>5*1024*1024 or stat.st_mtime<started-1:continue
            data=path.read_bytes()
            mime='image/png' if data.startswith(b'\x89PNG\r\n\x1a\n') else 'image/jpeg' if data.startswith(b'\xff\xd8\xff') else 'image/webp' if data.startswith(b'RIFF') and data[8:12]==b'WEBP' else None
            if not mime:continue
            id='browser-'+hashlib.sha256((run['id']+str(path)).encode()+data).hexdigest()[:24]
            if not db.get('files',id):db.event('file_added',dict(id=id,name='Browser view',mime=mime,channel=run['channel'],updatedAt=now(),size=len(data),base64=base64.b64encode(data).decode(),origin='hermes',previewKind='browser',runId=run['id']))
            value.update(fileId=id,capturedAt=datetime.fromtimestamp(stat.st_mtime,timezone.utc).isoformat());break
        except (OSError,ValueError):continue
    return value
