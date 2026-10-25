# Install curdr · agent instructions · 0.9.1

Use only when the owner asks you to install or update curdr on their existing Hermes host. This adds the curdr UI and gateway; it does not replace Hermes. Work quietly and report only the result. Do not read the full repository, run paid model tests, enable routines, install TencentDB, build Android, publish to GitHub or change the owner's agent personality globally.

## 1. Locate and preserve

Find the active curdr service, installation, Python environment, `--data` path and Hermes profile. Do not assume the default profile if another is active. For updates, take a consistent backup of the existing curdr data/configuration and retain the previous source/environment for rollback. Stop only the curdr service for the final switch, not Hermes. Keep its database, API keys, gateway token, profile, sessions, workspace, binding, origins and routines.

## 2. Obtain this release

Read https://curdr-founders.codingpenguin.chatgpt.site/release-0.9.1.json (small descriptor). Download its HTTPS `source_url`, verify `sha256` locally, then extract its single `archive_root` into a versioned local release directory. Reject checksum mismatches or paths escaping that directory. Do not install unpinned `main` or execute a remote script through a pipe.

## 3. Prepare

Requirements: Python 3.11+ with venv, Node 24+, npm, and an existing authenticated Hermes API. Add ffmpeg and `--voice` only when preserving existing voice support or the owner requests it. Do not silently install a second Hermes or reset its API key.

From the extracted source, run:

```bash
bash scripts/install-local.sh --data /ABSOLUTE/EXISTING/CURDR/DATA
```

Substitute the actual data path (new default: `$HOME/.local/share/curdr`). Existing connection settings and key are reused. First install: add `--hermes-env /ABSOLUTE/ACTIVE/HERMES/.env` and, if needed, its `--hermes-url`. This reads `API_SERVER_KEY` locally without printing it. Never paste keys into chat. Set `--hermes-home` or `--workspace` only to actual directories authorized by the owner. Binding defaults to loopback on new installs. The script builds the PWA, configures `web_dir` and performs read-only health checks without an LLM call.

## 4. Serve and pair

Restart the existing curdr service with this release's `.venv-curdr/bin/curdr-gateway serve --data ACTUAL_PATH`, preserving its service manager and network settings. For a new install, use that command in a managed persistent process (one worker). Do not overwrite an unrelated service or run two curdr services against one database.

Use the existing HTTPS reverse proxy/VPN, preserving streaming (disable response buffering; allow long SSE connections). If none exists, report that HTTPS setup is still required for iPhone/browser microphone and camera; do not open public ports on your own. If a new browser origin is authorized, add that exact origin while preserving the existing allowlist.

Generate a fresh code with `curdr-gateway pair --data ACTUAL_PATH` from the release environment. The user opens their curdr URL, selects Connect Hermes, enters that same gateway URL and code, and loads their saved server profile. iPhone: Safari → Share → Add to Home Screen → Open as Web App.

Return: version, service result, usable URL, short-lived pairing code privately, and remaining blockers. No secrets, model calls or fabricated device-test claims. On failure, restore the previous service target and configuration; never delete the persistent data.
