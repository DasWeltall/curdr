<p align="center"><img src="assets/icon.png" width="88" alt="curdr icon"></p>

# curdr

**Less in your head. More shipped.** An open-source AI co-founder for solo founders, powered by your own [Hermes](https://github.com/NousResearch/hermes-agent).

Capture a messy brain dump. Separate obligations from ideas. Get an honest reality check, pick a smaller next move and follow the work through to a reviewable result.

[Product website](https://curdr-founders.codingpenguin.chatgpt.site) · [Agent installation](install.md) · [Connection guide](docs/CONNECT-HERMES.md) · [Roadmap](docs/product/ROADMAP.md) · [Build in public](docs/product/BUILD-IN-PUBLIC.md)

## What it does

- **Brain dumps without a bigger to-do pile.** Preserve the original, review proposed actions, and park ideas without turning them into commitments.
- **Candid co-founder behavior.** Evidence over flattery; one useful objection, a cheap test and a next move. Read and edit the actual [skills](skills/).
- **First-run interview and explicit memory.** Current stage, customers, goals, capacity and boundaries. Inspect, edit and forget retained founder facts.
- **A quiet rhythm.** Configurable morning priorities (including what to ignore) and opt-in checks every 30 minutes, 1, 3 or 5 hours. Quiet hours and sleep.
- **Work you can follow.** Actual Hermes streaming, tool activity, scoped channel sessions, canonical one-time approvals, clarification questions, files and compact native visualizations.
- **A real mobile workspace.** Expo app for Android, web/PWA source and iOS source; measured voice recording, local transcription, camera and attachments. Tasks has Active, Up next, Channels and Routines.

This is an **early release**, not a promise of autonomous business outcomes. Provider/model/tool availability and permissions come from your Hermes. Native push notifications and live desktop video are not implemented. The current API does not expose every Hermes terminal command: curdr advertises only its implemented commands and installed skill dispatch, and refuses unknown commands rather than pretending they executed.

## Quick start

**Ask your existing Hermes to install it:**

> Install curdr on this Hermes host. Follow https://curdr-founders.codingpenguin.chatgpt.site/install.md. Preserve my data and permissions. Keep setup token-efficient and make no paid model calls.

The agent guide uses a versioned, checksummed source snapshot. It does not require reading the whole codebase or changing your global Hermes personality.

For manual setup, clone this repository. You need Python 3.11+ with venv, Node 24+, npm and a running authenticated Hermes API:

```bash
git clone https://github.com/DasWeltall/curdr.git
cd curdr
bash scripts/install-local.sh --hermes-env /ABSOLUTE/ACTIVE/HERMES/.env
.venv-curdr/bin/curdr-gateway serve
```

Replace the profile path. For an update, use your existing `--data /absolute/path` and preserve the service manager. Add `--voice` with ffmpeg available to enable/preserve offline transcription. The script prepares the gateway and web app; it does not create a persistent service or HTTPS proxy automatically. Follow [install.md](install.md) for those steps and [the connection guide](docs/CONNECT-HERMES.md) for storage and pairing.

On iPhone, open your server’s HTTPS address in Safari and add it to the Home Screen. Android and desktop can use the same PWA. Core UI is shared; device-specific microphone/camera/keyboard behavior still needs acceptance testing. Native iOS signing, push delivery and live desktop video are not implemented.

## Web, Expo Go and native builds

```bash
npm ci
npm run go                 # Expo Go compatible with SDK 58
npm run build:web          # static output in dist/
npm run build:apk          # full JDK 17 + Android SDK required
```

The standalone ARM64 Android preview embeds its JavaScript bundle and does not require Metro. It uses the standard development signing key; configure a private release keystore for public production/store releases. iOS distribution needs your Apple Developer signing setup; `eas.json` contains preview/production profiles. A JavaScript export is not an IPA or physical-device test.

The [`website/`](website/) directory is a standalone static product website. It collects no email addresses and includes no analytics. Its example interaction makes no model calls.

## Agent behavior and memory

The concise co-founder contract lives in [`backend/app/prompts`](backend/app/prompts/) and the installable Hermes-compatible skill pack in [`skills/`](skills/). The [behavior review set](evals/founder-behavior.json) and [evaluation guide](docs/product/BEHAVIOR.md) make proposed improvements testable rather than just longer prompts. It explicitly separates evidence from assumptions, avoids reflexive agreement, batches low-priority findings and does not invent progress. A user's explicit request can ask for longer code/documents; normal prose is split into short chat messages without truncating it.

curdr stores its workspace in SQLite on your gateway and lets Hermes keep its own sessions/memory. Founder facts have explicit scope and can be edited/forgotten. TencentDB for PostgreSQL is a documented optional future memory-backend direction, **not an enabled dependency**. See [memory architecture and trade-offs](docs/product/MEMORY.md).

## Development and contributions

```bash
npm run typecheck
npm test
python -m pip install -e ./backend pytest pytest-asyncio
python -m pytest backend/tests -q
```

See [CONTRIBUTING](CONTRIBUTING.md), [SECURITY](SECURITY.md), the [API contracts](docs/api.md) and [release 0.9](docs/RELEASE-0.9.md). Do not submit profiles, recordings, gateway databases or credentials in issues/PRs.

## License and attribution

curdr is MIT licensed. The original MIT avatar core from [ai-calypse/avatar-studio](https://github.com/ai-calypse/avatar-studio), pinned at `231533990744a22f329d8a0a4ac9d86bfeca55ed`, is copied unchanged under `third_party/avatar-studio`. Its license is retained in source and generated assets. Gabarito is provided through Expo Google Fonts. The curdr C/check app mark is original vector artwork in [`assets/curdr-mark.svg`](assets/curdr-mark.svg), included under the project license.
