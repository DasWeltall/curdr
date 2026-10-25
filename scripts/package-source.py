"""Export publishable source without Site identity, credentials or runtime data."""
from pathlib import Path
import subprocess
import zipfile
import json
root=Path(__file__).resolve().parent.parent
version=json.loads((root/'package.json').read_text())['version']
output=root/('public/downloads/curdr-source-v'+version+'.zip')
output.parent.mkdir(parents=True,exist_ok=True)
paths=subprocess.check_output(['git','ls-files','--cached','--others','--exclude-standard','-z'],cwd=root).decode().split('\0')
with zipfile.ZipFile(output,'w',compression=zipfile.ZIP_DEFLATED) as archive:
    for name in sorted(set(paths)):
        if not name or name.startswith(('.openai/','.local/','artifacts/','screenshots/','docs/screenshots/','reference/','public/downloads/')):continue
        path=root/name
        if path.is_file() and not path.is_symlink():archive.write(path,'curdr-'+version+'/'+name)
print(output)
