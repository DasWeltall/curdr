import importlib.util
from pathlib import Path
import pytest
spec=importlib.util.spec_from_file_location('setup_hermes',Path(__file__).resolve().parents[2]/'scripts/setup-hermes.py')
setup=importlib.util.module_from_spec(spec)
spec.loader.exec_module(setup)


def test_prices_are_current_and_require_tool_support():
    model={'id':'vendor/model','supported_parameters':['tools'],'pricing':{'prompt':'0.000001','completion':'0.000005'}}
    catalog={'data':[model]}
    assert setup.model_prices(catalog,'vendor/model')=={'input':1.25,'output':6.25}
    model['pricing']['request']='0.01'
    with pytest.raises(ValueError): setup.model_prices(catalog,'vendor/model')
    model['pricing']['request']='0'
    model['supported_parameters']=[]
    with pytest.raises(ValueError): setup.model_prices(catalog,'vendor/model')


def test_secret_is_atomically_written_with_private_permissions(tmp_path):
    target=tmp_path/'secret'
    setup.atomic_private(target,'never-output-this')
    assert target.read_text()=='never-output-this'
    assert target.stat().st_mode & 0o777 == 0o600
    assert list(tmp_path.iterdir())==[target]
