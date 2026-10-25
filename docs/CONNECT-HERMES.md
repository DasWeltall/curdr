# Connect an existing Hermes

curdr Android → curdr gateway → the official Hermes API on your existing host.

The app gateway keeps the app workspace durable. It is separate from `hermes gateway`, which runs the existing agent and its official API. Your provider, model and tool configuration remain in Hermes. No Docker rebuild, provider key in the app, or second Hermes installation is required.

## 1. Enable the official API

On your existing Hermes host, add these values to `~/.hermes/.env`. Generate a long random key yourself; do not commit it or put it in a URL.

```dotenv
API_SERVER_ENABLED=true
API_SERVER_KEY=<your-random-key>
```

Restart the existing Hermes gateway using its usual service manager, or run `hermes gateway`. Its API defaults to `http://127.0.0.1:8642`. Leave it on loopback when curdr runs on the same host. Verify that your Hermes version supports the [official API server](https://hermes-agent.nousresearch.com/docs/user-guide/features/api-server).

## 2. Install curdr separately

Use Python 3.11+, ffmpeg and the extracted curdr source folder:

```bash
python3 -m venv .venv-curdr
. .venv-curdr/bin/activate
python -m pip install './backend[voice]'
curdr-gateway configure --host 192.168.1.50
curdr-gateway voice-setup
curdr-gateway serve
```

Replace `192.168.1.50` with this host's actual LAN IP. Configure asks for **the existing Hermes API key privately**, verifies authenticated readiness, and stores it only on that host. A failed verification preserves existing configuration. The gateway uses its own generated app token. `serve` prints the app address and a single-use pairing code valid for ten minutes. Generate a new code later with `curdr-gateway pair` in another terminal using the same user/data directory. Keep the service running. Allow TCP 8000 only from your trusted LAN; do not forward it from your router.

`voice-setup` downloads the public Whisper base model once. Afterward voice decoding/transcription runs offline on the gateway CPU. Recordings are stored in the app workspace; Hermes receives their transcript as a normal conversation turn. The official Hermes API does not document an audio upload/transcription endpoint, so curdr performs this step beside Hermes. No transcript is invented if recognition fails. Install ffmpeg through your OS package manager. Omit the voice extra if you only need text chat.

## 3. Pair the Android app

Install the preview APK, connect the phone to the same Wi-Fi, and open **Connect Hermes**:

1. Enter the printed LAN gateway address (usually port 8000, not Hermes port 8642).
2. Paste the pairing code into the app. The code is exchanged once; the app token is held in Android SecureStore.
3. Choose this device's profile or the profile already saved on the gateway. Existing remote conversations and tasks are retained.

The wizard checks actual readiness before saving the connection. Your Hermes API key and provider keys never need to be entered into the app. mDNS names such as `hermes.local` work when your network resolves them; using the numeric LAN IP is more reliable on Android.

## Browser and remote access

The hosted HTTPS website cannot fetch a plain HTTP LAN server. Use the APK for this local setup. For the website or use outside home, put a correctly certified HTTPS reverse proxy in front of the curdr gateway, optionally reachable through your own VPN, and configure its exact browser origin:

```bash
curdr-gateway configure --host 127.0.0.1 \
  --origin https://YOUR_CURDR_WEB_ORIGIN
```

A proxy on the same host can forward to loopback port 8000. The Android app needs no CORS origin. Configure supports `--hermes-url` when the official API is elsewhere and `--port` for a different app gateway port. Every command supports `--data /absolute/persistent/path`. Never disable TLS certificate validation to connect.

## Storage and restore

The default persistent directory is `~/.local/share/curdr`:

| File | Purpose |
| --- | --- |
| `curdr.db` | SQLite conversations, tasks, channel contexts/summaries, settings, profile photo, avatar, uploads/audio, visualization state, durable event log and pairing state |
| `config.json` | API address, binding, browser origins, model alias and stable channel memory prefix |
| `gateway-token` | App credential; file mode 0600 |
| `hermes-api-key` | Existing Hermes API credential; file mode 0600 |
| `speech/` | Downloaded offline transcription model |

The phone stores its connection token in SecureStore, its gateway address and a local preference backup in AsyncStorage. The browser keeps its token in sessionStorage, so it must be paired again after the browser session ends. The gateway is the source of truth for connected work. Full offline conversation editing/sync is not implemented. Changing gateways does not merge unrelated conversation databases. Profile transfer copies only personal preferences, not remote budgets, models or permissions. Disconnect keeps the latest preferences on the device. Local/Demo work never silently imports fabricated conversations into Hermes.

Back up the directory while the gateway is **stopped**, including config and credentials, or take a consistent SQLite backup plus the other files. Restore it with the same `--data` path. Back up Hermes's own state separately: its model configuration, sessions, memory and skills are not inside curdr.db. Keep the stable `session_prefix` in config so channel memory remains associated after restore. Run a single Uvicorn worker; one gateway owns one person's workspace. This is not a multi-tenant service.

## Runtime behavior and limits

The adapter discovers actual Hermes capabilities and uses `/v1/runs` with text/tool SSE streaming, polling, exact approval identities and persistent channel sessions. Older APIs fall back to streamed chat completions with limited recovery/approval support. Each channel uses a stable namespaced `X-Hermes-Session-Key`, imports recent history only for its first session and then continues the server-owned conversation. Main coordinates explicit #mentions through summaries. Failed, cancelled, interrupted and unknown runs never become successful automatically.

Existing Hermes permissions, approvals, spending limits and tools apply. curdr resolves supported tool approvals only for the exact run, request ID and execution generation; it never grants session-wide or permanent approval. Global tool/provider settings remain host-managed. Sleep affects curdr work and checks, not unrelated Hermes jobs. Existing Hermes routines can be listed, run, paused and resumed through supported API endpoints.

Use an explicit shared workspace for files/screenshots. The default is `<data>/workspace`; `configure --workspace /absolute/path` changes it. Hermes and curdr must see the same path (including container mounts). Files up to 10 MiB in supported formats are indexed; hidden files and symlinks are skipped. Files are not a live desktop video stream. Images are forwarded as real image content; other uploads are accessible to Hermes file tools through the shared path. Model/tool support still determines whether the content can be processed.

For upgrades and a copyable instruction for your agent, read [release 0.8](RELEASE-0.8.md).
