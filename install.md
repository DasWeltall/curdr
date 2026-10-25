# Install curdr · agent instructions · 0.9.1

Use only when the owner asks you to install or update curdr on their existing Hermes host. This adds the curdr UI and gateway; it does not replace Hermes. Work quietly and report only the result. Do not read the full repository, run paid model tests, enable routines, install TencentDB, build Android, publish to GitHub or change the owner's agent personality globally.

## 1. Locate and preserve

Find the active curdr service, installation, Python environment, `--data` path and Hermes profile. Do not assume the default profile if another is active. For updates, take a consistent backup of the existing curdr data/configuration and retain the previous source/environment for rollback. Stop only the curdr service for the final switch, not Hermes. Keep its database, API keys, gateway token, profile, sessions, workspace, binding, origins and routines.

## 2. Obtain the pinned release

Requirements also include Git. Use the public GitHub repository, not the product website CDN. Clone into a new versioned local release directory, leaving the current installation intact:

```bash
git clone --depth 1 --branch v0.9.1 https://github.com/DasWeltall/curdr.git /ABSOLUTE/NEW/RELEASE/DIRECTORY
git -C /ABSOLUTE/NEW/RELEASE/DIRECTORY rev-parse HEAD
```

Substitute a real unused path. Require the exact commit `d3123228ccdb09b75f402200039a0d3db9eec8fd`; stop on any mismatch. Never install unpinned main or pipe a remote script into a shell. Continue from this verified checkout. The product website is only a presentation surface; installation must not depend on its automated-client access.

## 3. Prepare

Requirements: Python 3.11+ with venv, Node 24+, npm, and an existing authenticated Hermes API. Add ffmpeg and `--voice` only when preserving existing voice support or the owner requests it. Do not silently install a second Hermes or reset its API key.

From the pinned checkout, run:

```bash
bash scripts/install-local.sh --data /ABSOLUTE/EXISTING/CURDR/DATA
```

Substitute the actual data path (new default: `$HOME/.local/share/curdr`). Existing connection settings and key are reused. First install: add `--hermes-env /ABSOLUTE/ACTIVE/HERMES/.env` and, if needed, its `--hermes-url`. This reads `API_SERVER_KEY` locally without printing it. Never paste keys into chat. Set `--hermes-home` or `--workspace` only to actual directories authorized by the owner. Binding defaults to loopback on new installs. The script builds the PWA, configures `web_dir` and performs read-only health checks without an LLM call.

## 4. Serve and pair

Restart the existing curdr service with this release's `.venv-curdr/bin/curdr-gateway serve --data ACTUAL_PATH`, preserving its service manager and network settings. For a new install, use that command in a managed persistent process (one worker). Do not overwrite an unrelated service or run two curdr services against one database.

Use the existing HTTPS reverse proxy/VPN, preserving streaming (disable response buffering; allow long SSE connections). If none exists, report that HTTPS setup is still required for iPhone/browser microphone and camera; do not open public ports on your own. If a new browser origin is authorized, add that exact origin while preserving the existing allowlist.

Generate a fresh code with `curdr-gateway pair --data ACTUAL_PATH` from the release environment. The user opens their curdr URL, selects Connect Hermes, enters that same gateway URL and code, and loads their saved server profile. iPhone: Safari → Share → Add to Home Screen → Open as Web App.

Return: version, service result, usable URL, short-lived pairing code privately, and remaining blockers. No secrets, model calls or fabricated device-test claims. On failure, restore the previous service target and configuration; never delete the persistent data.
