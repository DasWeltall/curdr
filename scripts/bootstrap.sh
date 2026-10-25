#!/usr/bin/env bash
# Human entry point. Agents use install.md and a verified release checkout.
set -euo pipefail
curdr_repo=https://github.com/DasWeltall/curdr.git
curdr_raw=https://raw.githubusercontent.com/DasWeltall/curdr/main
curdr_home="${CURDR_HERMES_HOME:-${HERMES_HOME:-$HOME/.hermes}}"
curdr_base="${CURDR_INSTALL_DIR:-$HOME/.local/share/curdr-releases}"
curdr_voice=false
curdr_args=()
for curdr_arg in "$@"; do
 case "$curdr_arg" in
  --voice) curdr_voice=true ;;
  --help) echo 'Install Hermes if missing, then curdr. Options: --voice; CURDR_HERMES_HOME, CURDR_INSTALL_DIR, CURDR_RELEASE_FILE (local descriptor for offline checks). Existing installs: use install.md for a backed-up update.'; exit 0 ;;
  *) echo "Unknown option: $curdr_arg" >&2; exit 2 ;;
 esac
done
case "$(uname -s)" in Linux|Darwin) ;; *) echo 'Use Linux, macOS or WSL2 for the server.' >&2; exit 1;; esac
for curdr_dependency in curl git; do command -v "$curdr_dependency" >/dev/null || { echo "Install $curdr_dependency first." >&2; exit 1; }; done
# Never infer another owner's active data path or replace an existing release.
if [[ -f "$HOME/.local/share/curdr/config.json" ]]; then
 echo 'curdr is already configured. Follow install.md to preserve and update its running service.' >&2; exit 1
fi
curdr_temp="$(mktemp -d)"
trap 'rm -rf "$curdr_temp"' EXIT
curdr_new_hermes=false
if ! command -v hermes >/dev/null && [[ ! -x "$HOME/.local/bin/hermes" ]]; then
 if [[ -e "$curdr_home" ]]; then echo 'A Hermes directory already exists. Activate that installation first; it will not be replaced.' >&2; exit 1; fi
 echo 'Installing Hermes using its official installer…'
 curl -fsSL --proto '=https' --tlsv1.2 https://hermes-agent.nousresearch.com/install.sh -o "$curdr_temp/hermes-install.sh"
 bash "$curdr_temp/hermes-install.sh" --non-interactive
 curdr_new_hermes=true
fi
export HERMES_HOME="$curdr_home"
export PATH="$HOME/.local/bin:$PATH"
# Hermes PM's activation script exposes its pinned Python/Node/FFmpeg toolchain.
if [[ -f "$curdr_home/hermes-agent/activate" ]]; then source "$curdr_home/hermes-agent/activate"; fi
command -v python3 >/dev/null || { echo 'Activate Hermes or install Python 3.11+.' >&2; exit 1; }
command -v node >/dev/null || { echo 'Activate Hermes or install Node 24+.' >&2; exit 1; }
if "$curdr_new_hermes"; then
 echo 'Choose your provider/model in the Hermes setup. Credentials stay on this server.'
 if [[ ! -r /dev/tty ]]; then echo 'Run hermes model in a terminal, then rerun this installer.' >&2; exit 1; fi
 hermes model </dev/tty
 # Fresh install only: create a private loopback API key, never print it.
 python3 - "$curdr_home" <<'PY'
from pathlib import Path
import os,secrets,sys
root=Path(sys.argv[1]);path=root/'.env';text=path.read_text() if path.exists() else ''
keys={line.removeprefix('export ').partition('=')[0].strip() for line in text.splitlines() if not line.lstrip().startswith('#')}
add={k:v for k,v in {'API_SERVER_ENABLED':'true','API_SERVER_HOST':'127.0.0.1','API_SERVER_PORT':'8642','API_SERVER_KEY':secrets.token_urlsafe(40)}.items() if k not in keys}
fd=os.open(path,os.O_WRONLY|os.O_APPEND|os.O_CREAT,0o600)
with os.fdopen(fd,'w') as out:out.write('\n'+''.join(k+'='+v+'\n' for k,v in add.items()))
path.chmod(0o600)
PY
 hermes gateway install
 hermes gateway start
fi
if [[ -n "${CURDR_RELEASE_FILE:-}" ]]; then cp "$CURDR_RELEASE_FILE" "$curdr_temp/release.json"; else curl -fsSL --proto '=https' --tlsv1.2 "$curdr_raw/release.json" -o "$curdr_temp/release.json"; fi
# Avoid eval and shell expansion of the release descriptor.
python3 - "$curdr_temp/release.json" > "$curdr_temp/revision" <<'PY'
import json,re,sys
value=json.load(open(sys.argv[1]));tag=value['tag'];sha=value['commit']
assert re.fullmatch(r'v[0-9]+\.[0-9]+\.[0-9]+',tag) and re.fullmatch(r'[a-f0-9]{40}',sha),'Invalid release descriptor'
print(tag);print(sha)
PY
curdr_tag="$(sed -n '1p' "$curdr_temp/revision")"
curdr_sha="$(sed -n '2p' "$curdr_temp/revision")"
mkdir -p "$curdr_base"
curdr_release_path="$curdr_base/${curdr_tag}-$(date +%Y%m%d%H%M%S)"
git clone --depth 1 --branch "$curdr_tag" "$curdr_repo" "$curdr_release_path"
[[ "$(git -C "$curdr_release_path" rev-parse HEAD)" = "$curdr_sha" ]] || { echo 'Release commit mismatch. Stopped without executing curdr.' >&2; exit 1; }
if "$curdr_voice"; then curdr_args+=(--voice); fi
bash "$curdr_release_path/scripts/install-local.sh" --hermes-env "$curdr_home/.env" --hermes-home "$curdr_home" "${curdr_args[@]}"
echo 'Starting curdr on this server. Phone access needs your HTTPS/VPN address; see docs/SELF-HOST.md.'
exec "$curdr_release_path/.venv-curdr/bin/curdr-gateway" serve
