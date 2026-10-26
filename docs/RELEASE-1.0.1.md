# Gateway 1.0.1

Voice messages and Brain Dump transcription now use the speech provider configured in the active Hermes profile, through Hermes’ original transcription function. curdr no longer forces its own local Whisper model.

The gateway discovers the usual Hermes Python installation. Custom installations can configure `--hermes-python`, `--hermes-home` and, if needed, `--hermes-root`. Run `curdr-gateway voice-setup` to check the integration without a transcription request or model download. Provider errors retain actionable diagnostics; failed recordings remain saved.

Update the gateway and restart curdr with the same data path. The Android 1.0.0 app remains compatible; no app reinstall is required. See [connection setup](CONNECT-HERMES.md).
