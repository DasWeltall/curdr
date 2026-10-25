# curdr 0.9 — founder workspace

Update both the app and the curdr gateway. Back up the existing gateway data directory consistently while the service is stopped. Keep the same database, API keys, app token, session prefix and data path. Install `./backend[voice]` from this release into the existing separate curdr virtual environment and restart its existing service with one worker.

The first run now asks seven short founder-context questions. It does not guess the user's goals, stage or boundaries. Saving and starting the first plan makes an actual Hermes request; saving alone does not. Existing users can open Founder profile from Settings.

Routines moved out of Settings into Tasks → Routines. Morning time is a validated HH:MM value. Checks support 30/60/180/300 minutes. Routine testing uses the configured model, saves its result to chat and does not alter the schedule. Existing Hermes jobs can be inspected and edited through the supported Jobs API. Local checks ask Hermes to read/propose only; host permissions/approval rules still apply. No native push service has been configured.

Computer has Activity, Files, Skills and Runtime. It exposes actual model/tool inventory, real run titles/results, bounded shared-workspace browsing and actual visualization cards. This is not an arbitrary host file browser or live desktop stream. Skill editing/installing on the Hermes host requires an explicit local profile:

```bash
curdr-gateway configure --host YOUR_EXISTING_LAN_IP \
  --workspace /your/existing/shared/workspace \
  --hermes-home /your/actual/hermes/profile
```

Preserve existing `--port`, `--origin` and `--data` arguments when reconfiguring. The gateway and profile must be on the same host; remote API discovery does not grant filesystem access. Host skill edits are revision checked and back up the previous SKILL.md. Hub installation uses the actual Hermes CLI, scanner and normal confirmation behavior, without `--force` or shell interpolation. A blocked install is reported as blocked.

The slash menu lists implemented curdr controls and installed skill dispatch. `/help`, `/status`, `/models`, `/model provider/model`, `/tools`, `/skills`, `/memory`, `/remember`, `/dump`, `/reality-check`, `/brief`, `/new` and `/stop` are handled intentionally. Terminal-only Hermes commands are not silently sent to an LLM and reported as executed.

Founder memory is SQLite-backed and explicit. TencentDB for PostgreSQL is evaluated in docs/product/MEMORY.md; no Tencent connection is enabled. Read the co-founder skills for the behavior contract and the build-in-public plan for the launch experiment.

## Give this to your Hermes

Update my existing curdr to this source release in its separate Python environment. Back up and preserve all workspace/profile/session/token state. Verify the official Hermes Runs/Jobs/models/skills endpoints. Configure the explicit shared workspace and local Hermes profile only if they are on this host; preserve existing network binding, port, origins and data path. Verify ffmpeg/STT and restart the existing curdr service. Test a brain dump without starting unreviewed work, a parked idea, an honest reality check, profile/memory edit and forgetting, routine edit/test, a real tool trace, one-time approve/deny and a visualization. Keep approval policies intact. Report the gateway address, passed checks and anything requiring my physical phone. Never output API/provider keys.
