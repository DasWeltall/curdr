"""Use the same profile-aware Hermes speech worker in the managed container."""
import os
from pathlib import Path
import runpy
import sys
worker=Path(__file__).with_name('hermes_stt_worker.py')
source=sys.argv[1]
sys.argv=[str(worker),'--home',os.getenv('HERMES_HOME','/opt/data'),'--root','/opt/hermes']+(['--check'] if source=='--check' else ['--source',source])
runpy.run_path(str(worker),run_name='__main__')
