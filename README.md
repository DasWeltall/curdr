<p align="center"><img src="assets/readme-hero.svg" width="100%" alt="curdr. Less in your head. More shipped. An open-source AI co-founder for solo founders, powered by your own Hermes."></p>

# Your ideas need room to move.

**Less in your head. More shipped.** An open-source AI co-founder for solo founders, powered by [Hermes](https://github.com/NousResearch/hermes-agent).

Say everything on your mind. Review a smaller plan, park distractions and start the work that matters. Your agent challenges weak assumptions, remembers the context you choose to keep, and interrupts only for useful results or decisions.

[Website](https://curdr-founders.codingpenguin.chatgpt.site) · [Releases / Android](https://github.com/DasWeltall/curdr/releases) · [Agent install guide](install.md)

## Install

**Upgrading from 0.9/0.10?** Install the **0.12.0 Android APK** as well as updating the gateway. The native media-upload fix is in the client; a server update alone cannot fix the old APK. Your saved server data stays in the same data directory.

**Already have Hermes?** Send it this:

> Install or update curdr using https://raw.githubusercontent.com/DasWeltall/curdr/main/install.md. Preserve my profile, data and permissions. Use minimal tokens and no paid model tests.

**New to Hermes?** On your Linux, macOS or WSL2 server:

```bash
curl -fsSL https://raw.githubusercontent.com/DasWeltall/curdr/main/scripts/bootstrap.sh -o /tmp/curdr-install.sh && bash /tmp/curdr-install.sh
```

The installer installs Hermes if missing, opens its provider setup, verifies a pinned curdr release and starts your curdr server. Your provider login/API key is still required. It keeps an existing Hermes installation. Review the [script](scripts/bootstrap.sh) before running it. Add `--voice` to install local transcription (FFmpeg required).

Open your server's curdr URL, choose **Connect Hermes**, enter that URL and the pairing code generated on the host with `.venv-curdr/bin/curdr-gateway pair`. [Phone access and HTTPS](docs/SELF-HOST.md) are required for browser camera/microphone. A localhost URL only works on the server itself.

- **Android:** install the APK from Releases, or use the web app.
- **iPhone:** open your server URL in Safari → Share → Add to Home Screen → Open as Web App.
- **Desktop:** use the same URL in a browser.

## Where it runs

curdr adds a phone-friendly interface and a small gateway **alongside your existing Hermes**. The gateway talks to the Hermes API on your server. It serves the web app too, so iPhone users need no native installation. Your conversations, profile, tasks and settings stay in the curdr data directory on that server. Model credentials stay on the host.

The public website explains curdr and links to installation. It is separate from your private, self-hosted workspace.

## What you get

- Voice/text brain dumps with one-step transcription and planning. **Start**, **Save for later** or **Park**; captures are not commitments.
- Main chat and agent-created channels with separate context, real Hermes streaming and tool activity.
- Explicit approvals, including session/rule permission only when Hermes allows it.
- Reviewable tasks, editable routines, files and compact interactive visualizations.
- Founder interview, editable memory and a quiet co-founder skill. A separate `curdr-chat` skill keeps replies short and interruptions useful. It applies only inside curdr; your global Hermes personality stays yours.
- Android notification delivery code with quiet hours and sleep. **Requires your FCM/Expo build credentials and gateway opt-in**; it does not work in Expo Go. [Setup](docs/NOTIFICATIONS.md).

This is an early release. Your models, tools and permissions come from your Hermes. Native iOS distribution and web push are not provided. No fake tool results or unsupported terminal commands.

## Develop

Python 3.11+, Node 24+, npm, Git and a configured Hermes API:

```bash
git clone https://github.com/DasWeltall/curdr.git
cd curdr
bash scripts/install-local.sh --hermes-env "$HOME/.hermes/.env"
.venv-curdr/bin/curdr-gateway serve
```

App development: `npm ci` then `npm run go` (Expo Go) or `npm run web`. Remote push needs a custom Android build. Checks: `npm run typecheck`, `npm test`, `python -m pytest backend/tests` (install `pytest pytest-asyncio` in a development environment).

## Contribute

Start with [CONTRIBUTING.md](CONTRIBUTING.md) or report the exact step where setup or a real founder workflow breaks. The most useful feedback: Did a brain dump reduce your workload? Was an interruption worth it? Could you get connected without help? [What to test next](docs/product/COMMUNITY-VALIDATION.md).

[Connection details](docs/CONNECT-HERMES.md) · [Self-hosting](docs/SELF-HOST.md) · [Website architecture](docs/WEBSITE.md) · [Security](SECURITY.md) · [MIT license](LICENSE)

Avatar Studio components retain their original MIT attribution in [third_party/avatar-studio/LICENSE](third_party/avatar-studio/LICENSE).

## Update an existing host install

Give Hermes the [agent guide](https://raw.githubusercontent.com/DasWeltall/curdr/main/install.md), or run `bash scripts/update.sh --data /absolute/curdr/data` from your trusted checkout. It prepares and backs up the pinned update. Switch your existing service to the printed executable, then restart curdr. Your web interface is served by that gateway; phones and computers can use it without the Android app. Existing Docker installs should update their existing image and volumes instead.
