# App ↔ Gateway · v0.8

All API routes except `POST /pair/exchange` require `Authorization: Bearer <CURDR_TOKEN>`. This is a single-user deployment. Channels isolate agent context, not authorization between different users.

SSE emits `{type,data}` with increasing IDs. Every connection starts with a consistent snapshot, followed by persistent events after its cursor. Heartbeats are sent every 15 seconds.

| Route | Contract |
| --- | --- |
| `GET /health` | Agent status and actual capabilities, including sidecar audio readiness |
| `POST /pair/start` | Authenticated; returns a one-time code, expires after 600 seconds |
| `POST /pair/exchange` | `{code}` → `{token}`; atomic, expiring exchange |
| `GET /stream` | Snapshot, message, task, file, approval, activity, channels, settings, skills and log events |
| `POST /message` | `{text,channel?,attachments?:string[]}`; at most five channel-owned attachments; text may be empty with attachments |
| `POST /transcribe` | Multipart recording and duration → `{text}`; bounded local transcription without creating chat messages |
| `PUT /visuals/:id` | `{block,value}` for a calculator or `{block,item,done}` for a checklist; validates and persists the updated visualization file |
| `POST /audio` | Multipart `file`, `duration`, `channel`; actual audio, ≤8 MiB and ≤120 seconds; saves original bytes before transcription and agent processing |
| `PUT /channels/:id` | `{context}` up to 4,000 characters; creates or updates a persistent workspace |
| `POST /braindump` | `{text}` → reviewable task drafts; expires after one hour |
| `POST /tasks` | `{draft_id,start,title?,sub?,channel?}`; validates reviewed edits and commits once |
| `POST /task/:id/start,pause,done,instruction,answer,delete` | `{text?}`; deletion creates an approval |
| `POST /approval/:id` | `{decision:"approve"\|"later"}`; server checks expiry and single use |
| `GET /snapshot` | Complete workspace state including actual `runs` and `hermes` inventory |
| `GET /runtime`, `POST /runtime/refresh` | Cached or refreshed existing-Hermes metadata, configured models, toolsets, jobs and workspace |
| `POST /runs/:id/stop` | Requests actual Hermes stop; stays Stopping until executor settles |
| `POST /approval/:id/answer` | `{text}` resolves the exact clarification request/generation |
| `POST /runtime/jobs/:id/run,pause,resume` | Controls an existing job reported by Hermes, then refreshes state |
| `GET /tasks,/files,/skills,/settings` | Current entities |
| `POST /files` | Multipart `file` and optional `channel`; ≤10 MiB; returns file record |
| `GET /files/:id/download` | Original bytes as a download; uploaded HTML is not executed |
| `PUT /skills/:id` | `{enabled:boolean}` |
| `PUT /settings` | Validated settings patch; proxy controls usage |

Channel IDs are lowercase ASCII letters, digits, underscores and hyphens, at most 48 characters. Missing channels and legacy `inbox` resolve to `main`. The coordinator runs explicit whitespace-prefixed `#mentions` (up to three unique targets), then synthesizes the returned results. Child histories stay separate; main receives configured briefs and latest result excerpts. The optional managed Docker worker sets its own `HERMES_HOME`. Existing-Hermes mode uses stable namespaced session keys and server-owned sessions, not separate Hermes installations or authorization boundaries.

Messages include `artifact` (`fileId`, `title`, `description`), `text`, `attachment` (`fileIds`, optional `text`) and `audio` (`fileId`, `duration`, optional `transcript`, `processing`). Audio processing transitions from `transcribing` to `ready` or `failed` using the same message ID. Transcription failures retain the recording without an invented transcript. A later model failure retains the successful transcript. The normal reply path processes the current transcript once.

Files include original `base64` bytes and, for supported text, `content`. Existing-Hermes mode forwards supported images as actual `image_url` content and writes uploads into the shared workspace for file tools. Tool/container path access and the selected model determine content support. Text content remains available to the managed worker.

Approvals are `pending`, `approved`, `denied`, `deferred` or `expired`. Existing-Hermes tool approvals carry exact `runId`, `requestId` and `executionGeneration`; approve maps to `once`, later maps to `deny`. Hermes rejects stale generations with 409; curdr never marks a rejected decision as approved. Clarification answers use the same canonical identity. Missing/expired requests return 404/410; repeated approval returns 409. Sending or paying without an implemented connector returns 501. Deletion only affects the selected curdr task.

The optional managed Docker bridge provides `/run` and `/transcribe`; it is not publicly exposed. The model proxy allows only the configured models and Hermes memory/skill tools. It reserves costs before provider calls and rejects unsupported tools. There is no general terminal/browser execution or arbitrary URL proxy.


Native visualizations use MIME `application/vnd.curdr.visual+json`. A validated fenced `curdr` block from an actual Hermes response becomes a persisted file plus artifact message. Supported blocks: metrics, chart (bar/line, ≤24 points and four series), table (≤6 columns and 30 rows), checklist (≤20 items), calculator and text. Files contain at most eight blocks and 64 KiB of JSON. Invalid content stays plain text; it is never executed. Calculator results are `input * multiplier + offset`. Calculator/checklist edits use the authenticated visual route and emit the updated file through SSE. Later conversation context uses the saved values.

Settings include `sleeping`. Sleep cancels and remembers running background jobs, pauses them as Up next, suppresses briefs and rejects new chat/agent starts with 409. Wake restores only jobs paused by sleep. Concise replies, Default text size and active initiative are normalized server-side; quiet hours remain user controlled. The default brief is 07:00 in the configured time zone. Background checks and morning briefs are opt-in and run persistently on the gateway. Sleeping, quiet hours and active/unknown work suppress checks. Scheduled checks ask Hermes to read/propose only; existing host permissions still apply.

Run events expose actual status, tool/subagent activity and errors. Text message updates reuse the same ID with `streaming:true`, then replace it with authoritative final text and `streaming:false`. SQLite persists run IDs, session IDs and SSE sequence cursors for recovery. Status polling reconciles missed events/pending controls. A lost/unknown execution is shown for host inspection and is never automatically re-submitted. Raw model reasoning is not exposed.

## v0.9 founder workspace controls

All endpoints below require the same gateway bearer authentication. They act on the single-owner configured workspace; they are not a public multi-tenant API.

- `GET /commands`: explicit supported commands plus installed skill commands. `/message` dispatches recognized commands; unknown commands return 422 instead of pretending to execute Hermes CLI behavior.
- `GET /routines`, `GET /routines/{id}`, `PUT /routines/{id}` and `POST /routines/{id}/test|run`: local morning/check settings and existing Hermes jobs. Local edits use `prompt`, `enabled` and `time` (HH:MM) or `interval` (30/60/180/300). Remote jobs use their native schedule and permissions. Tests do not advance schedules.
- `GET /founder/memory`, `PUT /founder/memory/{id}` (including `new`) and `POST /founder/memory/{id}/forget`: explicit facts with shared or channel scope. These do not erase Hermes-owned history.
- `GET /captures`, `GET /captures/parked`, `POST /captures/drafts/{id}/park`: retained original brain dumps and parked ideas, separate from executable tasks.
- `GET /workspace?path=…` and `GET /workspace/file?path=…`: bounded, non-hidden shared-directory entries and files up to 10 MB. No access outside `CURDR_SHARED_DIR`; symlink escapes are rejected.
- `GET /library/skills`, `GET /library/skills/{id}`, `PUT /library/skills/{id}`: first-party/custom skill sources and real installed skills. Writes use `source` and the returned revision; stale revisions return 409. Existing Hermes skill editing additionally requires explicit same-host `CURDR_HERMES_HOME` access.
- `POST /library/skills/install` with qualified `source`: invokes the official Hermes installer on an explicitly configured local Hermes home. Security scan rejection is reported; no force flag is used. Remote-only API connections do not silently gain host write access.

Founder fields in settings: `founderProfile` with project/customer/stage/goal/capacity/boundaries/interruptions, `founderInterviewDone`, `morningPrompt`, `checkPrompt`. The co-founder behavior respects the user's language; English UI does not imply English-only responses.
