"""Install beside an existing Hermes deployment, without changing its Python environment."""
import argparse
import asyncio
import getpass
import ipaddress
import json
import os
from pathlib import Path
import secrets
import shlex
import sys

DEFAULT_DATA=Path.home()/'.local/share/curdr'

def private_host(value):
    try:
        ip=ipaddress.ip_address(value)
        if ip.is_loopback or ip.version==4 and any(ip in ipaddress.ip_network(net) for net in ('10.0.0.0/8','172.16.0.0/12','192.168.0.0/16')):return value
    except ValueError:pass
    raise argparse.ArgumentTypeError('Choose loopback or the specific private LAN IP of this host (not 0.0.0.0).')

def save_private(path,value):
    temporary=path.with_suffix('.tmp')
    fd=os.open(temporary,os.O_WRONLY|os.O_CREAT|os.O_TRUNC,0o600)
    with os.fdopen(fd,'w') as out:out.write(value)
    temporary.replace(path)
    path.chmod(0o600)

def configure(args):
    from .existing_hermes import ExistingHermes
    root=args.data.expanduser().resolve()
    config_path=root/'config.json'
    previous=json.loads(config_path.read_text()) if config_path.exists() else {}
    hermes_home=str(args.hermes_home.expanduser().resolve()) if getattr(args,'hermes_home',None) else previous.get('hermes_home','')
    if not hermes_home and getattr(args,'hermes_env',None):hermes_home=str(args.hermes_env.expanduser().resolve().parent)
    speech={}
    for name in ('hermes_python','hermes_root'):
        value=getattr(args,name,None)
        if value is not None:
            path=value.expanduser().absolute()
            if name=='hermes_python' and not (path.is_file() and os.access(path,os.X_OK)):raise ValueError('Choose the executable Python from your Hermes environment.')
            if name=='hermes_root' and not (path/'tools/transcription_tools.py').is_file():raise ValueError('Choose the Hermes source directory containing tools/transcription_tools.py.')
            speech[name]=str(path)
    key_file=root/'hermes-api-key'
    if getattr(args,'hermes_env',None):
        key=''
        for line in args.hermes_env.expanduser().read_text().splitlines():
            name,sep,value=line.removeprefix('export ').partition('=')
            if sep and name.strip()=='API_SERVER_KEY':
                parts=shlex.split(value,comments=True);key=parts[0] if len(parts)==1 else '';break
        if not key:raise ValueError('The selected Hermes environment has no literal API_SERVER_KEY. Configure it privately first.')
    elif key_file.exists():key=key_file.read_text().strip()
    else:key=getpass.getpass('Existing Hermes API_SERVER_KEY (stored only on this host): ').strip()
    agent=ExistingHermes(args.hermes_url or previous.get('hermes_url','http://127.0.0.1:8642'),key=key)
    if not asyncio.run(agent.health()):raise ValueError('Hermes is not ready. Enable its API, check the address/key and run hermes gateway, then try again. Existing curdr configuration was kept.')
    root.mkdir(parents=True,exist_ok=True,mode=0o700)
    configuration={**previous,'hermes_url':agent.url,'model':agent.model,'host':args.host or previous.get('host','127.0.0.1'),'port':args.port if args.port is not None else previous.get('port',8000),'origins':args.origin if args.origin is not None else previous.get('origins',[]),'hermes_home':hermes_home,**speech,'workspace':str(args.workspace.expanduser().resolve()) if getattr(args,'workspace',None) else previous.get('workspace',str(root/'workspace')),'session_prefix':previous.get('session_prefix','curdr-'+secrets.token_hex(8))}
    if not previous.get('web_dir') and (Path.cwd()/'dist/index.html').is_file():configuration['web_dir']=str(Path.cwd()/'dist')
    save_private(root/'hermes-api-key',key)
    if not (root/'gateway-token').exists():save_private(root/'gateway-token',secrets.token_urlsafe(32))
    save_private(config_path,json.dumps(configuration,indent=2)+'\n')
    print('Hermes verified. curdr configuration saved. Next: curdr-gateway serve. Voice uses the selected Hermes speech provider.')

def activate(root):
    root=root.expanduser().resolve()
    try: config=json.loads((root/'config.json').read_text())
    except FileNotFoundError:raise ValueError('Run curdr-gateway configure first.')
    os.environ.update(CURDR_TOKEN=(root/'gateway-token').read_text().strip(),CURDR_HERMES_API_URL=config['hermes_url'],CURDR_HERMES_API_KEY_FILE=str(root/'hermes-api-key'),CURDR_HERMES_MODEL=config['model'],CURDR_HERMES_SESSION_PREFIX=config['session_prefix'],CURDR_DB=str(root/'curdr.db'),CURDR_WORKSPACE_DIR=config.get('workspace',str(root/'workspace')),CURDR_AGENT_MODE='hermes',CURDR_ORIGINS=','.join(config.get('origins',[])))
    for key,env in (('hermes_home','CURDR_HERMES_HOME'),('hermes_python','CURDR_HERMES_PYTHON'),('hermes_root','CURDR_HERMES_ROOT')):
        if config.get(key):os.environ[env]=config[key]
    if config.get('web_dir'):os.environ['CURDR_WEB_DIR']=config['web_dir']
    return root,config

def main():
    parser=argparse.ArgumentParser(description='curdr gateway for your existing Hermes')
    commands=parser.add_subparsers(dest='command',required=True)
    for command in ('configure','serve','pair','voice-setup','web','check'):
        child=commands.add_parser(command)
        child.add_argument('--data',type=Path,default=DEFAULT_DATA,help='Persistent configuration and workspace directory')
        if command=='web':child.add_argument('--dir',type=Path,required=True,help='Built Expo web export with index.html')
        if command=='configure':
            child.add_argument('--hermes-env',type=Path,help='Read API_SERVER_KEY locally without printing it; never evaluates shell expressions')
            child.add_argument('--hermes-home',type=Path,help='Explicit local Hermes profile for skill editing and installation')
            child.add_argument('--hermes-python',type=Path,help='Python executable from the existing Hermes environment, for its configured speech provider')
            child.add_argument('--hermes-root',type=Path,help='Hermes source directory, if not discoverable from its Python environment')
            child.add_argument('--workspace',type=Path,help='Explicit directory shared with Hermes for visible files and screenshots')
            child.add_argument('--hermes-url',default=None)
            child.add_argument('--host',type=private_host,default=None)
            child.add_argument('--port',type=int,default=None)
            child.add_argument('--origin',action='append',default=None,help='Replace browser origins with these exact values; omitted preserves existing origins')
    args=parser.parse_args()
    try:
        if args.command=='configure':
            if args.port is not None and not 1<=args.port<=65535:raise ValueError('Invalid port.')
            configure(args);return
        root,config=activate(args.data)
        if args.command=='web':
            folder=args.dir.expanduser().resolve()
            if not (folder/'index.html').is_file() or not (folder/'manifest.webmanifest').is_file():raise ValueError('Choose a complete web export. Run npm run build:web first.')
            save_private(root/'config.json',json.dumps({**config,'web_dir':str(folder)},indent=2)+'\n')
            print('Web export configured. Restart the existing curdr service to apply it.');return
        if args.command=='check':
            from importlib.metadata import version
            from .existing_hermes import ExistingHermes
            agent=ExistingHermes(config['hermes_url'],key=(root/'hermes-api-key').read_text().strip())
            ready=asyncio.run(agent.health())
            print(json.dumps(dict(version=version('curdr-gateway'),hermes_ready=ready,guidelines_ready=all((Path(__file__).parent/'prompts'/name).is_file() for name in ('chat.md','cofounder.md')),web_ready=(Path(config.get('web_dir','/app/web'))/'index.html').is_file(),voice_ready=agent.audio_ready,voice=agent.stt_status)))
            if not ready:sys.exit(1)
            return
        if args.command=='voice-setup':
            from .hermes_stt import HermesSTT
            status=asyncio.run(HermesSTT(config['hermes_url']).check())
            if not status.get('ready'):raise ValueError(status.get('error','Hermes speech is unavailable.')+' ('+status.get('code','hermes_stt_unavailable')+')')
            print('Hermes speech is ready. Provider: '+str(status.get('provider','auto'))+'. Model, language and credentials come from the active Hermes profile.');return
        from .db import Database
        from .pairing import issue_pair
        db=Database(root/'curdr.db',recover=False)
        code=issue_pair(db);db.conn.close()
        display_host = "["+config["host"]+"]" if ":" in config["host"] else config["host"]
        print(f"Gateway: http://{display_host}:{config['port']}")
        print('Pairing code (single use, expires in 10 minutes): '+code['code'],flush=True)
        if args.command=='serve':
            import uvicorn
            uvicorn.run('app.main:create_app',factory=True,host=config['host'],port=config['port'],workers=1,access_log=False)
    except (ValueError,KeyError,OSError) as error:
        print('curdr: '+str(error),file=sys.stderr);sys.exit(1)

if __name__=='__main__':main()
