"""Build the static product site, agent entrypoints and checksummed source descriptor."""
from pathlib import Path
import argparse,hashlib,json,shutil,subprocess,sys
from urllib.parse import urlsplit
root=Path(__file__).resolve().parent.parent
parser=argparse.ArgumentParser();parser.add_argument('--out',type=Path,default=root/'artifacts/website');parser.add_argument('--base-url',default='https://curdr-founders.codingpenguin.chatgpt.site');args=parser.parse_args()
base=args.base_url.rstrip('/');url=urlsplit(base)
if url.scheme!='https' or not url.hostname or url.query or url.fragment:raise SystemExit('Use a public HTTPS base URL without query or fragment.')
version=json.loads((root/'package.json').read_text())['version']
subprocess.run([sys.executable,str(root/'scripts/package-source.py')],cwd=root,check=True)
source=root/'public/downloads'/f'curdr-source-v{version}.zip'
out=args.out.resolve()
shutil.copytree(root/'website',out,dirs_exist_ok=True)
shutil.copyfile(root/'install.md',out/'install.md')
skill=out/'skills/curdr-install';skill.mkdir(parents=True,exist_ok=True);shutil.copyfile(root/'skills/curdr-install/SKILL.md',skill/'SKILL.md')
(out/'downloads').mkdir(exist_ok=True);shutil.copyfile(source,out/'downloads'/source.name)
release=dict(version=version,channel='source-preview',source_url=base+'/downloads/'+source.name,sha256=hashlib.sha256(source.read_bytes()).hexdigest(),archive_root='curdr-'+version,repository='https://github.com/DasWeltall/curdr',license='MIT')
(out/f'release-{version}.json').write_text(json.dumps(release,indent=2)+'\n')
print(json.dumps(dict(directory=str(out),version=version,source_bytes=source.stat().st_size,sha256=release['sha256'])))
