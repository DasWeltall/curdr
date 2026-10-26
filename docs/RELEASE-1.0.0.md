# curdr 1.0.0

First regular release of the curdr app and gateway.

- Short public installation guide, pixel wordmark and new app icon.
- Routines handle structured Hermes schedules and malformed job lists safely.
- Model, tool and skill commands refresh Hermes inventory before answering.
- Hermes HTTP errors preserve status and error codes. Streaming failures retain diagnostics without exposing credentials.
- Web interface works on desktop and phones; Android APK includes the same UI.

## Integration requirements

Hermes must expose its authenticated API. Available models, tools, jobs and approvals depend on its version and capabilities. curdr commands use that API; they are not the Telegram gateway's native slash-command dispatcher. Unsupported native commands are rejected rather than sent to a model as if executed.

Remote Android notifications require Firebase/Expo credentials and a configured build. Unconfigured builds cannot receive remote push. The downloadable Android APK retains the existing development signing key for installation compatibility; it is not a Play Store signing configuration.
