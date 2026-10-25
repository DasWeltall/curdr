#!/usr/bin/env python3
"""Install the pinned Hermes runtime, verify a real turn, then pair the app.

Run on the user's computer/server, not inside Expo Go. Only stdlib is needed.
"""
import argparse
import getpass
import ipaddress
import json
import math
import os
from pathlib import Path
import re
import secrets
import shutil
import socket
import subprocess
import sys
import time
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
IMAGE = 'curdr-hermes-upstream:bda3a363e969'
CATALOG = 'https://openrouter.ai/api/v1/models'


def atomic_private(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_name(path.name + '.tmp-' + secrets.token_hex(6))
    fd = os.open(temp, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    try:
        with os.fdopen(fd, 'w') as stream:
            stream.write(value)
        os.replace(temp, path)
    finally:
        temp.unlink(missing_ok=True)


def model_prices(catalog, model):
    item = next((m for m in catalog['data'] if m['id'] == model), None)
    if not item:
        raise ValueError('Modell-ID fehlt im OpenRouter-Katalog.')
    if 'tools' not in item.get('supported_parameters', []):
        raise ValueError('Das gewählte Modell unterstützt keine Hermes-Tools.')
    price = item['pricing']
    if any(float(price.get(k, '0') or '0') != 0 for k in ('request', 'image', 'web_search', 'internal_reasoning')):
        raise ValueError('Dieses Modell hat zusätzliche Gebühren; bitte ein reines Text-/Tool-Modell wählen.')
    result = {k: float(price[v]) * 1_000_000 * 1.25 for k, v in [('input', 'prompt'), ('output', 'completion')]}
    if any(not math.isfinite(n) or n < 0 for n in result.values()):
        raise ValueError('Ungültige Modellpreise.')
    return result


def lan_address():
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
            sock.connect(('8.8.8.8', 80))  # route lookup; no packets sent
            return sock.getsockname()[0]
    except OSError:
        return '127.0.0.1'


def api(url, token, path, body=None, timeout=120, method=None):
    request = Request(url + path, data=None if body is None else json.dumps(body).encode(),
                      headers={'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json'},
                      method=method or ('GET' if body is None else 'POST'))
    with urlopen(request, timeout=timeout) as response:
        return json.load(response)


def run(*args):
    subprocess.run(args, cwd=ROOT, check=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--host', help='Private IP des Rechners im selben WLAN wie das Handy')
    parser.add_argument('--model', default='openai/gpt-4.1-mini')
    parser.add_argument('--budget', type=float, default=20)
    parser.add_argument('--pair-only', action='store_true', help='Neuen Code für eine vorhandene Installation erzeugen')
    options = parser.parse_args()
    if options.pair_only:
        values = dict(line.split('=', 1) for line in (ROOT / '.env').read_text().splitlines() if '=' in line and not line.startswith('#'))
        token = values['CURDR_TOKEN']
        host = options.host or values.get('CURDR_BIND_HOST', '127.0.0.1')
    else:
        if not math.isfinite(options.budget) or options.budget <= 0:
            raise ValueError('Das Budget muss größer als null sein.')
        if not re.fullmatch(r'[A-Za-z0-9_.:/-]{1,160}', options.model):
            raise ValueError('Ungültige Modell-ID.')
        for command in ('docker', 'git', 'node', 'npm', 'bash'):
            if not shutil.which(command):
                raise ValueError(f'{command} fehlt. Docker Desktop/Engine, Git und Node installieren und erneut starten.')
        run('docker', 'compose', 'version')
        run('docker', 'info', '--format', '{{.ServerVersion}}')
        host = options.host or lan_address()
        address = ipaddress.ip_address(host)
        if address.version != 4 or not (address.is_loopback or any(address in ipaddress.ip_network(n) for n in ('10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16'))):
            raise ValueError('--host muss eine private IPv4-Adresse des Rechners sein.')
        print('Lade aktuelle Modellpreise und prüfe Tool-Unterstützung …', flush=True)
        with urlopen(CATALOG, timeout=30) as response:
            prices = model_prices(json.load(response), options.model)
        keyfile = ROOT / 'secrets/provider_key'
        key = keyfile.read_text().strip() if keyfile.exists() else ''
        if not key:
            key = getpass.getpass('OpenRouter API-Key (bleibt auf diesem Rechner): ').strip()
        if not key or any(c.isspace() for c in key):
            raise ValueError('Ein gültiger API-Key fehlt.')
        atomic_private(keyfile, key)
        previous = ROOT / '.env'
        old = dict(line.split('=', 1) for line in previous.read_text().splitlines() if '=' in line and not line.startswith('#')) if previous.exists() else {}
        existing = old.get('CURDR_TOKEN', '')
        token = existing if re.fullmatch(r'[A-Za-z0-9_-]{24,128}', existing) and existing != 'replace-with-a-random-token-at-least-24-characters' else secrets.token_urlsafe(48)
        env = dict(CURDR_TOKEN=token, CURDR_AGENT_MODE='hermes', CURDR_BIND_HOST=host,
                   CURDR_MODELS=options.model, CURDR_MAX_BUDGET=str(options.budget),
                   CURDR_PROVIDER_URL='https://openrouter.ai/api/v1', CURDR_MIN_INTERVAL='0',
                   CURDR_MODEL_PRICES=json.dumps({options.model: prices}, separators=(',', ':')),
                   CURDR_ORIGINS='http://localhost:8081,http://localhost:8000')
        # These validated values contain no shell expansion or dotenv newlines.
        atomic_private(ROOT / '.env', ''.join(f'{k}={v}\n' for k, v in env.items()))
        if not (ROOT / 'node_modules/expo').exists():
            run('npm', 'ci', '--no-audit', '--no-fund')
        run('npm', 'run', 'build:web')
        image = subprocess.run(['docker', 'image', 'inspect', IMAGE], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        if image.returncode:
            print('Baue den gepinnten offiziellen Hermes-Agenten. Der erste Build kann dauern.', flush=True)
            run('bash', 'scripts/setup-hermes.sh')
        run('docker', 'compose', '--profile', 'agent', 'up', '--build', '-d')
    url = f'http://{host}:8000'
    print('Prüfe Hermes-Runtime und Modellverbindung …', flush=True)
    for attempt in range(60):
        try:
            health = api(url, token, '/health', timeout=15)
            if health.get('agent') == 'hermes' and health.get('agent_status') == 'ready':
                break
        except (URLError, TimeoutError, OSError):
            pass
        time.sleep(2)
    else:
        raise ValueError('Hermes ist nicht bereit. Details: docker compose --profile agent logs --tail=80')
    if not options.pair_only:
        api(url, token, '/settings', {'model': options.model, 'budget': options.budget, 'sbx': True}, method='PUT')
        # Real provider request, inside the configured budget. No simulated success.
        api(url, token, '/message', {'text': 'Verbindungstest: Antworte nur mit Bereit.'})
    pairing = api(url, token, '/pair/start', {})
    print('\nHermes ist bereit. In curdr: Einstellungen → Hermes verbinden')
    print('Gateway-Adresse:', url)
    print('Einmalcode (10 Minuten gültig):', pairing['code'])
    if host == '127.0.0.1':
        print('Für das Handy erneut mit --host PRIVATE-IP starten; localhost zeigt dort auf das Handy.')
    print('\nExpo Go starten: npm run go  (Handy und Rechner im selben WLAN)')
    print('Für einen neuen Einmalcode: npm run setup:hermes -- --pair-only')


if __name__ == '__main__':
    try:
        main()
    except (ValueError, KeyError, HTTPError, URLError, OSError, subprocess.CalledProcessError, KeyboardInterrupt) as error:
        print(f'\nEinrichtung nicht abgeschlossen: {error}', file=sys.stderr)
        sys.exit(1)
