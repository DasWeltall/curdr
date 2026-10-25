# curdr 0.9.1 · self-hosting and public source

This is a source/gateway release. The previously supplied Android preview is 0.9.0; no new signed Android/iOS binary is part of this update.

## Install or update through an agent

Give Hermes https://curdr-founders.codingpenguin.chatgpt.site/install.md and explicitly ask it to follow that document on your existing Hermes host. The small versioned descriptor provides the source URL and SHA-256. The local installer uses a separate Python environment, builds the PWA and performs read-only health checks without a model request. It does not install Hermes, open public ports or change routines.

The installation skill can also be installed using the official Hermes URL mechanism:

```bash
hermes skills install https://curdr-founders.codingpenguin.chatgpt.site/skills/curdr-install/SKILL.md
```

Installing the skill only makes the instructions available; invoke it to actually perform setup. Keep Hermes's scanner and normal approval rules. Do not use a force-install flag.

## Important upgrade behavior

`curdr-gateway configure` now preserves omitted network/profile settings and reuses the existing local Hermes key. `--hermes-env /actual/profile/.env` supports first setup without displaying a key in chat or evaluating shell expressions. Explicit `--origin` values replace the allowlist, so preserve all still-needed entries.

`curdr-gateway web --dir /absolute/dist --data /existing/data` changes only the web-export path. `curdr-gateway check --data /existing/data` checks Hermes connectivity and reports local web/voice readiness without starting a model turn. An agent must still restart the actual existing service and verify the reachable HTTPS URL. A new unrelated service is not a substitute for upgrading the running one.

Use HTTPS for browser microphone/camera and Home Screen installation on an iPhone. A source export is not a native iOS build. Real iPhone/Android and private-LAN acceptance tests are still required. Pair with the same gateway URL and load the saved server profile.

## Behavior and scheduling

The co-founder contract now distinguishes capture, decision, authorized execution and check-in modes. Unchanged reminders should remain silent; disagreement must cite a meaningful assumption or trade-off. Twelve review scenarios are in `evals/founder-behavior.json`; they are not a claim of model-certified behavior. A terminal recovered run marked unknown no longer blocks future scheduled checks indefinitely.

Global Hermes personality and schedules are preserved. Semantic reminder deduplication, daily interruption budgets, native push, TencentDB and live desktop video are not newly implemented by this release.
