#!/usr/bin/env bash
# Install beside an existing Hermes; no root, model calls, or service/network changes.
set -euo pipefail
curdr_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$curdr_root"
curdr_data="$HOME/.local/share/curdr"
curdr_voice=false
curdr_args=()
while (($#)); do
  case "$1" in
    --voice) curdr_voice=true; shift ;;
    --data) curdr_data="$2"; curdr_args+=("$1" "$2"); shift 2 ;;
    --data=*) curdr_data="${1#*=}"; curdr_args+=("$1"); shift ;;
    --help) echo 'bash scripts/install-local.sh [--voice] [configure options: --data, --hermes-env, --hermes-home, --hermes-url, --origin, --host, --port, --workspace]'; exit 0 ;;
    *) curdr_args+=("$1"); shift ;;
  esac
done
command -v python3 >/dev/null
command -v node >/dev/null
command -v npm >/dev/null
python3 -c 'import sys; assert sys.version_info >= (3,11), "Python 3.11+ required"'
node -e 'if(Number(process.versions.node.split(".")[0])<24)throw Error("Node 24+ required")'
# Check the data path before installing or changing configuration.
[[ "$curdr_data" = /* ]] || { echo 'Use an absolute --data path.' >&2; exit 1; }
if "$curdr_voice"; then command -v ffmpeg >/dev/null; fi
python3 -m venv .venv-curdr
curdr_python="$curdr_root/.venv-curdr/bin/python"
curdr_cli="$curdr_root/.venv-curdr/bin/curdr-gateway"
"$curdr_python" -m pip install ./backend
npm ci --no-audit --no-fund
npm run build:web
"$curdr_cli" configure "${curdr_args[@]}"
"$curdr_cli" web --data "$curdr_data" --dir "$curdr_root/dist"
if "$curdr_voice"; then "$curdr_cli" voice-setup --data "$curdr_data"; fi
"$curdr_cli" check --data "$curdr_data"
echo 'Prepared. Start/restart your existing curdr service using this release and the same --data path. New installs: .venv-curdr/bin/curdr-gateway serve'
