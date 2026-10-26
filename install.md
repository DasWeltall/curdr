# Install curdr

Agent instructions. Use this guide when the owner asks to install or update curdr. Keep output brief. Never print credentials or edit global Hermes personality files.

## New installation

Run on the server that will host Hermes and curdr. Requires Python 3.11+, Node 24+, npm and Git.

```bash
curl -fsSL https://raw.githubusercontent.com/DasWeltall/curdr/main/scripts/bootstrap.sh -o /tmp/curdr-install.sh
bash /tmp/curdr-install.sh
```

The installer uses the pinned release in [release.json](https://raw.githubusercontent.com/DasWeltall/curdr/main/release.json). If Hermes already exists, reuse its active profile and authenticated API. Otherwise the installer offers the official Hermes setup. Provider authentication may require the owner on their host. Do not invent credentials or run paid model tests.

For manual installation from the verified release checkout:

```bash
bash scripts/install-local.sh --data /ABSOLUTE/CURDR/DATA --hermes-env /ABSOLUTE/HERMES/.env
```

Add `--voice` with FFmpeg installed for local transcription. Reuse existing network bindings and credentials. See [connection setup](docs/CONNECT-HERMES.md).

## Existing installation

Preserve the actual data directory, paired profiles, configuration and service. From a trusted checkout:

```bash
bash scripts/update.sh --data /ABSOLUTE/ACTUAL/CURDR/DATA
```

This verifies the pinned release, backs up the database and configuration, and prepares the new executable. Point the existing service at that executable and restart only curdr. Keep its data path. For Docker, update the existing image/service with its volumes preserved. Do not start a parallel installation or interrupt active Hermes work.

## Open and verify

Run `curdr-gateway check --data ACTUAL_PATH` and check the live `/health` version. Use `curdr-gateway pair --data ACTUAL_PATH` to obtain a short-lived pairing code. Return the working HTTPS/VPN URL and code privately. A loopback URL cannot be opened from another phone. Preserve SSE streaming through the reverse proxy; do not open public ports or disable authentication.

Open the URL, connect and pair. The gateway serves the web interface, including on iPhone. In Safari, use Share → Add to Home Screen. Android users may also install the APK from [Releases](https://github.com/DasWeltall/curdr/releases). Update both the gateway and native app for native fixes.

Bundled curdr skills install with the gateway and apply only to curdr requests. Preserve owner-edited skills and global Hermes settings. Notifications require a configured native build and delivery credentials; see [notification setup](docs/NOTIFICATIONS.md). Do not report push delivery as working without a device test.
