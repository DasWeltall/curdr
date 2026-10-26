#!/usr/bin/env bash
# Prepare a pinned release alongside the running one. Never restart unknown services.
set -euo pipefail
curdr_data="$HOME/.local/share/curdr"
while (($#)); do
 case "$1" in
 --data) curdr_data="$2";shift 2;;
 --help) echo 'bash scripts/update.sh [--data /absolute/existing/data]. Backs up and prepares the pinned release; your service manager/agent performs the final switch.';exit 0;;
 *) echo "Unknown option: $1" >&2;exit 1;;
 esac
done
[[ "$curdr_data" = /* && -f "$curdr_data/config.json" ]] || { echo 'Use --data with the existing configured curdr data directory.' >&2;exit 1; }
curdr_temp="$(mktemp -d)"
trap 'rm -rf -- "$curdr_temp"' EXIT
curl -fsSL --proto '=https' --tlsv1.2 https://raw.githubusercontent.com/DasWeltall/curdr/main/release.json -o "$curdr_temp/release.json"
python3 - "$curdr_temp/release.json" > "$curdr_temp/revision" <<'PY'
import json,re,sys
r=json.load(open(sys.argv[1]));assert re.fullmatch(r'v[0-9]+\.[0-9]+\.[0-9]+',r['tag']);assert re.fullmatch('[a-f0-9]{40}',r['commit']);print(r['tag']);print(r['commit'])
PY
curdr_tag="$(sed -n '1p' "$curdr_temp/revision")"
curdr_sha="$(sed -n '2p' "$curdr_temp/revision")"
curdr_release="$curdr_data/releases/$curdr_tag-$curdr_sha"
mkdir -p "$curdr_data/releases"
if [[ -e "$curdr_release" ]]; then
 [[ "$(git -C "$curdr_release" rev-parse HEAD)" = "$curdr_sha" && -z "$(git -C "$curdr_release" status --porcelain)" ]] || { echo 'Existing release was changed; stopped.' >&2;exit 1; }
else
 git clone --depth 1 --branch "$curdr_tag" https://github.com/DasWeltall/curdr.git "$curdr_release"
fi
[[ "$(git -C "$curdr_release" rev-parse HEAD)" = "$curdr_sha" ]] || { echo 'Release pin mismatch.' >&2;exit 1; }
python3 - "$curdr_data" <<'PY'
from pathlib import Path
import sys,sqlite3,shutil,datetime
root=Path(sys.argv[1]);target=root/'backups'/datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S%fZ');target.mkdir(parents=True,mode=0o700)
for name in ('config.json','gateway-token','hermes-api-key'):
 p=root/name
 if p.is_file():shutil.copy2(p,target/name);(target/name).chmod(0o600)
if (root/'curdr.db').is_file():
 with sqlite3.connect('file:'+str(root/'curdr.db')+'?mode=ro',uri=True) as source,sqlite3.connect(target/'curdr.db') as dest:source.backup(dest)
 (target/'curdr.db').chmod(0o600)
print('Backup ready:',target)
PY
curdr_args=(--data "$curdr_data")
if [[ -d "$curdr_data/speech" ]]; then curdr_args+=(--voice);fi
bash "$curdr_release/scripts/install-local.sh" "${curdr_args[@]}"
printf '\nPrepared %s. Keep --data %s.\n' "$curdr_tag" "$curdr_data"
printf 'Switch your existing curdr service executable to: %s/.venv-curdr/bin/curdr-gateway\n' "$curdr_release"
echo 'Then restart that service and check its live /health version. Hermes itself does not need a personality change or reinstall.'
