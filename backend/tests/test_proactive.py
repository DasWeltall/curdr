from datetime import datetime,timezone
from app.proactive import due
from app.db import DEFAULTS

def test_background_checks_respect_quiet_sleep_interval_and_restart_marker():
    settings={**DEFAULTS,'onboarded':True,'proactiveChecks':True,'briefingEnabled':True,'timezone':'Europe/Berlin'}
    morning=datetime(2026,10,24,5,0,tzinfo=timezone.utc) # 07:00 local
    assert due(settings,{},morning)==(True,True)
    marker={'briefDate':'2026-10-24','checked':morning.timestamp()}
    assert due(settings,marker,morning)==(False,False)
    assert due(settings,{},morning,busy=True)==(False,False)
    assert due({**settings,'sleeping':True},{},morning)==(False,False)
    assert due(settings,{},datetime(2026,10,24,22,0,tzinfo=timezone.utc))==(False,False)
    assert due({**settings,'quiet':False},{},datetime(2026,10,24,22,0,tzinfo=timezone.utc))==(False,True)

def test_unknown_recovered_run_does_not_block_scheduled_work_forever():
    from app.proactive import is_busy
    assert not is_busy([{'status':'unknown'},{'status':'completed'}])
    assert is_busy([{'status':'unknown'},{'status':'waiting_for_approval'}])
