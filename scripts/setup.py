#!/usr/bin/env python3
"""Create local-only secrets without printing credentials."""
from pathlib import Path
import secrets
import os
root=Path(__file__).resolve().parents[1]
env=root/'.env'
if not env.exists():
    value=(root/'.env.example').read_text().replace('replace-with-a-random-token-at-least-24-characters',secrets.token_hex(32))
    env.write_text(value)
    os.chmod(env,0o600)
secret=root/'secrets'
secret.mkdir(mode=0o700,exist_ok=True)
key=secret/'provider_key'
if not key.exists():
    key.write_text('')
    os.chmod(key,0o600)
print('Lokale .env und secrets/provider_key sind vorbereitet. Bestehende Dateien bleiben erhalten.')
