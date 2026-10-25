"""Scheduling policy separated from execution so downtime and quiet hours are deterministic."""
from datetime import datetime
from zoneinfo import ZoneInfo

def due(settings,marker,clock:datetime,busy=False):
    local=clock.astimezone(ZoneInfo(settings.get('timezone','Europe/Berlin')))
    if busy or settings.get('sleeping') or not settings.get('onboarded') or not settings.get('sbx'):return False,False
    if settings.get('quiet') and (local.hour>=22 or local.hour<7):return False,False
    brief=bool(settings.get('briefingEnabled') and local.strftime('%H:%M')>=settings['brief'] and marker.get('briefDate')!=local.date().isoformat())
    check=bool(settings.get('proactiveChecks') and clock.timestamp()-marker.get('checked',0)>=settings.get('proactiveInterval',60)*60)
    return brief,check


def is_busy(runs):
    terminal={'completed','failed','cancelled','interrupted','partial','unknown'}
    return any(r.get('status') not in terminal for r in runs)
