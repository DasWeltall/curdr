# curdr 0.8

This release connects curdr to the existing Hermes Runs API instead of waiting for a single completed chat reply. Update **both the app and curdr gateway**. The Hermes instance must expose the capabilities documented in its [official API](https://hermes-agent.nousresearch.com/docs/user-guide/features/api-server).

## What changed

- Configurable user/assistant bubble colors, automatic readable foregrounds, preview and profile synchronization.
- Text streaming, Markdown, tool progress, subagent tasks, exact run states, one-time tool approvals and clarification questions.
- Durable run/session identities, SSE replay cursors, status polling and restart recovery. Unknown executions are never automatically submitted again.
- Computer shows actual run activity, installed Hermes skills, task results, uploaded files and files/images from an explicitly shared workspace. This is not a remote desktop video stream.
- Hermes settings show supported capabilities, actual configured models/providers, toolsets and existing Hermes scheduled jobs. Model overrides affect curdr requests. Global tool permissions/provider credentials remain host-managed.
- Opt-in background checks and morning briefs run on the gateway, respect quiet hours, the configured time zone and sleep. They use the connected Hermes tools and incur its normal model costs. No mobile push service is configured: reopen the app to see persisted results.
- Android recording permission no longer gets removed by the photo picker plugin; the build checks both manifest and actual APK. Native keyboard movement and navigation visibility use the SDK 58 keyboard controller, including Expo Go.
- No forced English model instruction. The default reply language follows the user; the interface stays English.
- Images are forwarded as real image content. Other files are written into the shared workspace for Hermes file tools; Docker/remote tool environments need the same mounted path.

## Upgrade an existing gateway

1. Stop the curdr gateway process/service. Back up its persistent data directory and Hermes state before migration. Preserve `config.json`, `gateway-token`, `hermes-api-key`, `curdr.db`, speech files and the existing session prefix.
2. Extract the **0.8 source**. Activate the existing curdr virtual environment, then run from that source root:

   ```bash
   python -m pip install --upgrade './backend[voice]'
   curdr-gateway voice-setup
   curdr-gateway serve
   ```

   Use the existing `--data /absolute/path` argument if configured. `voice-setup` requires ffmpeg. For a managed service, update that service's installed package/working directory and restart it instead of starting a second server.
3. Verify the installed Hermes API's `GET /v1/capabilities`. For full integration it must report `run_submission`, `run_events_sse` and run approvals (`run_approval_response` or `run_approval`). If missing, update Hermes using its official procedure and restart its existing gateway. Keep the existing provider/model/tool configuration and approval policy.
4. Existing curdr configurations automatically use `<data directory>/workspace` for shared files. To select another directory, run `curdr-gateway configure --host <existing-LAN-IP> --workspace /absolute/shared/path` **with the existing port, origins and data path preserved**. Configure prompts privately for the Hermes API key. Give Hermes tools access to that exact directory; mount it at the same path if using a container. Do not index an entire home folder.
5. Install the new APK as an update, open Settings → Connection, keep the saved connection and use Hermes settings → Refresh from Hermes. If pairing is needed, run `curdr-gateway pair` on the same host/data directory. The app connects to the **curdr gateway**, normally port 8000; that gateway talks privately to Hermes, normally loopback port 8642.
6. In Settings, choose Reply language → Auto; optionally enable Background checks/Morning brief, verify your time zone and quiet hours.

## Tell your Hermes

Give Hermes the **0.8 source archive** together with this request. This is an instruction to your own agent; curdr does not secretly modify the Hermes installation:

```text
Update my existing curdr installation to the attached 0.8 source. First inspect the current Hermes version, API capabilities, curdr service/virtual environment, persistent data path, binding/port, allowed web origins and shared workspace. Stop curdr and take a consistent backup before installing the new backend. Keep my existing conversations, tasks, profile, settings, tokens and session prefix. Do not reinstall Hermes or reset its data.

Enable/verify the authenticated official Hermes API on loopback. Verify run_submission, run_events_sse and run approvals; update Hermes through its documented procedure only if those are missing, preserving its model/provider/tools and approval policy. Install the attached backend in curdr's existing separate virtual environment. Verify ffmpeg and local voice recognition. Configure an explicit shared output/upload directory accessible at the same path to Hermes tools and curdr, and preserve existing network/origin configuration. Restart the existing curdr service with one worker.

Test a streamed German reply, an actual tool trace, a harmless action requiring one-time approval plus denial, separate #test channel context, a reviewed task/result file, installed skills and an image upload. Do not weaken approval rules or expose ports publicly. Do not enable paid background checks without asking me. Report which checks passed, which need a physical phone, and the gateway address. If pairing is necessary, provide the one-time code through our private conversation, never an API/provider key.
```

## Verification boundaries

Automated tests use the official API shapes through HTTP transports, including streaming before approval, exact request/generation approval payloads, failures, SSE reconnect/deduplication, stale approvals, recovery fencing, actual upload paths and image content. They do not replace a test against your home Hermes host. Physical Android recording, camera and keyboard behavior need your phone. Browser QA uses the explicit isolated Demo mode; no fabricated work enters connected mode.

## Beyond Android

The web/PWA works on desktop and iPhone; the remote gateway must be reachable through valid HTTPS from the hosted HTTPS site. Native iOS uses the same Expo source. An EAS production build and TestFlight distribution require your Apple Developer credentials and App Store Connect setup; no iOS binary has been signed in this release. See [Expo TestFlight](https://docs.expo.dev/submit/testflight/) and [internal distribution](https://docs.expo.dev/build/internal-distribution/).

For a public open-source launch, publish the sanitized source with its MIT/third-party notices in your own repository, attach a versioned Android build and checksum, and demonstrate one real flow: install → connect existing Hermes → task → approval → result. Keep a release checklist and issue templates. The current hosted preview remains private; no public GitHub repository or store listing has been created automatically.
