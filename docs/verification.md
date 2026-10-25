# Verification · App/Gateway 0.10.3

- 27 Node tests, including the exact Expo 58 FormData exception and binary multipart round trips for native voice/transcription/photo/PDF and browser File/blob-URI uploads. Tests use the installed Expo converter and FormData patch, not a replacement serializer.
- 86 backend tests including generated compact visual persistence/interactions, real outgoing Hermes prompt guidance, Brain Dump JSON contract, scoped approvals, independent push receipts and existing gateway controls.
- Strict TypeScript and production Expo web export.
- Native Android build/signature/microphone-permission checks run in GitHub Actions. Physical microphone and owner-host Hermes tests are not inferred from encoding/build success.
- No paid model test calls. No access to the owner's private network Hermes.
