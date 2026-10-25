# Install curdr · agent guide · Gateway 0.10.1 / App 0.10.0

Use only when the owner asks to install/update curdr. Work quietly, use minimal tokens, and report the result. No paid model tests, full-repository reading, Android builds, public-port changes or global personality edits. Keep existing routines disabled/enabled as they are.

## 1. Preserve

Find the active Hermes profile and any curdr service, release, Python environment and `--data` path. Back up existing curdr configuration/database consistently and retain the previous release for rollback. Preserve profile, avatar, sessions, workspace, keys, gateway token, origins and network binding. Stop only curdr for the final switch. Never replace another Hermes profile or silently install a second agent.

## 2. Verify the release

Clone into a real, unused absolute release directory:

```bash
git clone --depth 1 --branch gateway-v0.10.1 https://github.com/DasWeltall/curdr.git /ABSOLUTE/NEW/RELEASE
git -C /ABSOLUTE/NEW/RELEASE rev-parse HEAD
```

Require commit `83b37af427783f5c18353f30fe6a2ef9d5723a04`. Stop on mismatch. Continue only from this verified checkout. Use GitHub for installation; the marketing CDN can block automated clients.

## 3. Prepare Hermes

An existing authenticated Hermes API needs no second installation. Requirements: Git, Python 3.11+ with venv, Node 24+ and npm. The active Hermes PM activation script may provide these tools.

If Hermes is absent and the owner requested a first installation too, use `scripts/bootstrap.sh` from the verified checkout. It downloads the official Hermes installer, invokes provider/model setup, enables a private loopback API on a fresh profile, verifies the curdr release and starts it. Provider authentication requires the owner on their host; do not invent credentials or request secrets in chat. Report a blocked interactive step clearly. Do not run bootstrap over an existing curdr install.

For an existing Hermes, verify its API configuration locally (`API_SERVER_ENABLED=true`, a private `API_SERVER_KEY`, default loopback port 8642). Reuse its key. A disabled API needs the owner's requested connection setup and a drain-aware Hermes service restart; never interrupt active work silently. No paid chat call is required: `/v1/models` verifies readiness.

## 4. Install curdr

From the verified checkout:

```bash
bash scripts/install-local.sh --data /ABSOLUTE/ACTUAL/CURDR/DATA
```

First install: add `--hermes-env /ABSOLUTE/ACTIVE/HERMES/.env` and the actual `--hermes-url` if nondefault. This reads the key locally without printing it. Existing configuration is reused. Add `--hermes-home` and `--workspace` only for actual authorized directories. Add `--voice` plus FFmpeg when voice transcription is requested/already used. The installer creates an isolated environment, builds the PWA and checks readiness without a model call.

## 5. Serve, pair, report

Start/restart the existing curdr service with this release's `.venv-curdr/bin/curdr-gateway serve --data ACTUAL_PATH` (one worker). Keep the same persistent data path. First installs need a persistent process/service and the owner's HTTPS reverse proxy/VPN; preserve SSE streaming without response buffering. Loopback alone is not a phone URL. Do not open public ports yourself.

Run `curdr-gateway pair --data ACTUAL_PATH` from that environment. Return the usable URL, short-lived pairing code privately, version and unresolved setup. The user opens the URL → Connect Hermes → same URL/code → saved server profile. iPhone: Safari → Share → Add to Home Screen → Open as Web App.

Android remote notifications additionally need owner FCM/Expo credentials and a configured custom build: `docs/NOTIFICATIONS.md`. Do not claim them working from an unconfigured APK or Expo Go. On failed update, restore the prior service/configuration; never delete data.
