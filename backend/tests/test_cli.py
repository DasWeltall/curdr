import argparse
import json
from argparse import Namespace
import pytest
from app import cli
from app.existing_hermes import ExistingHermes

def test_configure_verifies_before_replacing_saved_credentials(tmp_path,monkeypatch):
    (tmp_path/'config.json').write_text('{"saved":true}')
    (tmp_path/'hermes-api-key').write_text('old-key')
    monkeypatch.setattr(cli.getpass,'getpass',lambda _: 'new-key')
    async def unavailable(self):return False
    monkeypatch.setattr(ExistingHermes,'health',unavailable)
    args=Namespace(data=tmp_path,hermes_url='http://127.0.0.1:8642',host='192.168.1.50',port=8000,origin=[])
    with pytest.raises(ValueError):cli.configure(args)
    assert (tmp_path/'hermes-api-key').read_text()=='old-key'
    assert json.loads((tmp_path/'config.json').read_text())=={'saved':True}

def test_successful_setup_and_reconfigure_keep_identity_and_app_token(tmp_path,monkeypatch):
    monkeypatch.setattr(cli.getpass,'getpass',lambda _: 'new-key')
    async def ready(self):return True
    monkeypatch.setattr(ExistingHermes,'health',ready)
    args=Namespace(data=tmp_path,hermes_url='http://127.0.0.1:8642',host='192.168.1.50',port=8000,origin=[])
    cli.configure(args)
    first=json.loads((tmp_path/'config.json').read_text())
    token=(tmp_path/'gateway-token').read_text()
    cli.configure(args)
    assert json.loads((tmp_path/'config.json').read_text())['session_prefix']==first['session_prefix']
    assert (tmp_path/'gateway-token').read_text()==token
    assert (tmp_path/'hermes-api-key').stat().st_mode & 0o777==0o600
    assert len(token)>24

@pytest.mark.parametrize('host',['0.0.0.0','8.8.8.8','example.com'])
def test_bind_is_an_explicit_lan_interface(host):
    with pytest.raises(argparse.ArgumentTypeError):cli.private_host(host)

def test_reconfigure_omissions_preserve_custom_network_profile_and_key(tmp_path,monkeypatch):
    previous={'host':'192.168.1.8','port':8044,'origins':['https://private.example'],'session_prefix':'keep-me','hermes_url':'http://127.0.0.1:9900','web_dir':'/existing/web','hermes_home':'/existing/profile','workspace':'/existing/files'}
    (tmp_path/'config.json').write_text(json.dumps(previous));(tmp_path/'hermes-api-key').write_text('existing-key');(tmp_path/'gateway-token').write_text('existing-token')
    async def ready(self):
        assert self.url=='http://127.0.0.1:9900' and self.key=='existing-key';return True
    monkeypatch.setattr(ExistingHermes,'health',ready)
    monkeypatch.setattr(cli.getpass,'getpass',lambda _:pytest.fail('Must reuse the existing key'))
    cli.configure(Namespace(data=tmp_path,hermes_url=None,host=None,port=None,origin=None))
    saved=json.loads((tmp_path/'config.json').read_text())
    for name,value in previous.items():assert saved[name]==value
    assert (tmp_path/'gateway-token').read_text()=='existing-token'

def test_first_install_reads_quoted_hermes_key_without_evaluating_shell(tmp_path,monkeypatch,capsys):
    env=tmp_path/'hermes.env';env.write_text('API_SERVER_KEY="literal-$(touch-not-executed)#key"\n')
    async def ready(self):assert self.key=='literal-$(touch-not-executed)#key';return True
    monkeypatch.setattr(ExistingHermes,'health',ready)
    data=tmp_path/'data'
    cli.configure(Namespace(data=data,hermes_url=None,host=None,port=None,origin=None,hermes_env=env))
    assert 'literal-' not in capsys.readouterr().out
    assert json.loads((data/'config.json').read_text())['host']=='127.0.0.1'
    assert (data/'hermes-api-key').read_text()=='literal-$(touch-not-executed)#key'

def test_web_export_update_preserves_configuration_and_rejects_incomplete_export(tmp_path,monkeypatch):
    config={'host':'192.168.1.8','origins':['https://private.example'],'session_prefix':'retained','web_dir':'/old'}
    (tmp_path/'config.json').write_text(json.dumps(config))
    monkeypatch.setattr(cli,'activate',lambda _: (tmp_path,config))
    export=tmp_path/'web';export.mkdir();(export/'index.html').write_text('<html></html>')
    monkeypatch.setattr('sys.argv',['curdr-gateway','web','--dir',str(export),'--data',str(tmp_path)])
    with pytest.raises(SystemExit):cli.main()
    assert json.loads((tmp_path/'config.json').read_text())==config
    (export/'manifest.webmanifest').write_text('{}');cli.main()
    updated=json.loads((tmp_path/'config.json').read_text())
    assert updated=={**config,'web_dir':str(export)}
