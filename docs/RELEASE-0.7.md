# curdr 0.7.0

## Android artifact

- File: `curdr-0.7.0-preview-arm64.apk`
- Size: 41,913,276 bytes
- Package: `net.curdr.app`
- Version: 0.7.0, Android versionCode 7
- Architecture: arm64-v8a
- Minimum SDK: 24; target SDK: 36; compile SDK: 37
- SHA256: `c01b39c03da82f26e0cf315bbc891dee76b53a471086e8e08c6dbc94860bb628`
- Signing: standard Android development key, verified APK Signature Scheme v2; this is an installable preview, not a production store-signing identity.
- Embedded `assets/index.android.bundle`; Metro, Expo Go and a development computer are not required to launch it.

Gradle `assembleRelease` succeeded (725 tasks). APK ZIP integrity, signature, package/version metadata, architecture and embedded bundle were checked. 18 app tests and 47 gateway tests passed; TypeScript and the web export passed. Browser QA covered onboarding/name persistence, the connection walkthrough and LAN-HTTP guidance, light/dark transparent avatars, lower camera-panel opening/closing, Tasks/channels and the staged interactive chat.

Physical Android camera/microphone, keyboard and connection to the user's actual local Hermes remain unverified. The cloud environment cannot access that LAN. The user must install/configure the curdr gateway beside Hermes once, then pair through the app. See [setup and storage](CONNECT-HERMES.md).

## Changes

Voice recordings use actual metered amplitudes, retain waveform peaks and have elapsed/total times, playback seeking, pause and replay. Avatar surfaces are transparent. The empty home greeting is personalized and uses a clearer question. The attachment menu animates in and out; the camera uses an animated lower panel. Navigation remains named Tasks.

The connection flow verifies the gateway and Hermes, exchanges a single-use pairing code and explicitly chooses the device or saved remote profile. App state lives in gateway SQLite, with secure device credentials and a local preference backup. A separately installable gateway adapts the documented Hermes API; local Whisper transcription can be enabled without reinstalling Hermes. Existing Hermes provider/model/tool/approval configuration remains authoritative.

The source package includes MIT licensing, contribution/setup/storage documentation and a GitHub Actions APK workflow. No public repository or store listing was created.
