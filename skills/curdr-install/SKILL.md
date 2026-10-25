---
name: curdr-install
description: Install or update the curdr founder workspace beside an existing Hermes, preserving its data and permissions.
version: 0.9.1
license: MIT
platforms: [linux, macos]
---

Use when the owner explicitly asks to install or update curdr. Fetch and follow https://curdr-founders.codingpenguin.chatgpt.site/install.md. It points to a versioned source descriptor with a checksum and a deterministic local installer.

Do not read the entire repository. Preserve the active Hermes profile, existing curdr state and service configuration. Do not enable scheduled work, run paid model tests, create a second Hermes, expose new public ports, or overwrite global SOUL.md/AGENTS.md. Treat setup as complete only after the actual service and read-only health checks succeed; report unresolved HTTPS/device setup honestly.
