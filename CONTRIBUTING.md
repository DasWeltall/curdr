# Contributing

Use Node 24, npm and Python 3.11+. Run `npm ci`, `npm test`, `npm run typecheck`, `npm run build:web` and `python -m pytest backend/tests` with `PYTHONPATH=backend` (or run pytest from backend/). Install gateway dependencies with `python -m pip install -e './backend[voice]' pytest` in a separate venv.

Use `npm run go` for Expo Go. `npm run build:apk` creates a standalone ARM64 preview with an embedded bundle, using a full JDK 17 (including javac) and a configured Android SDK. Install platform 37.0, build-tools 36.0.0 and 37.0.0, NDK 27.1.12297006 and CMake 3.22.1; set JAVA_HOME and ANDROID_HOME to those installations. The native android/ directory is generated from app.json and config plugins; commit configuration changes rather than generated native projects. Do not commit credentials, .env, user data, local SQLite files or signing keys.

The Android GitHub Actions workflow can build a downloadable preview artifact with no Expo account. Preview builds use the standard development signing key. For public release distribution, configure an owner-controlled production keystore, increment android.versionCode and publish through the intended release channel. An Expo account is optional. Source and early releases are published at https://github.com/DasWeltall/curdr.

Keep upstream avatar attribution in third_party and preserve its MIT license. Hermes is an independent MIT-licensed upstream project, not vendored into this app's UI. Test adapter changes against the documented Hermes API. Do not substitute fake results for unavailable services.
