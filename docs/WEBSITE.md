# Website and personal app

The public product website explains curdr and links to GitHub Releases, the install command and raw `install.md`. Host it wherever you build your new design; it does not need access to a user's Hermes, chat history, database or model keys. Use the self-hosted Gabarito font and original curdr seed mark from `website/assets/`, preserving the font license.

The personal application lives on the founder's Hermes server. The installer builds Expo's web export and the curdr gateway serves it on the same origin. A reverse proxy/VPN supplies the user's HTTPS URL. The browser and Android app authenticate to curdr; curdr connects privately to Hermes's loopback API. Profiles, avatar, messages, channels, tasks and routines live in the server's SQLite data directory, shared across that owner's devices. API keys remain on the server.

Recommended website links: **Install** (existing-Hermes message and new-install command), **Android** (GitHub Release assets), **iPhone** (Safari home-screen guide), **Docs**, **GitHub**. Do not point every user's Open app button at a single shared private gateway. If you add an Open my app field, keep the URL in that browser and do not proxy credentials through the marketing site. This project is a single-owner self-hosted workspace, not a public multi-tenant service.

The agent installer must be served as plain Markdown from `raw.githubusercontent.com/DasWeltall/curdr/main/install.md`, with a normal browser link to GitHub's rendered file. Website CDN bot protection must not be on the installation path. `release.json` identifies the pinned runtime tag/commit. Do not advertise features or downloads until the release actually contains them.
