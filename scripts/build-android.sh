#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
: "${ANDROID_HOME:=${ANDROID_SDK_ROOT:-}}"
if [[ -z "$ANDROID_HOME" ]]; then
  echo 'Set ANDROID_HOME to an installed Android SDK.' >&2
  exit 1
fi
export ANDROID_HOME ANDROID_SDK_ROOT="$ANDROID_HOME"
if [[ -n "${JAVA_HOME:-}" ]]; then
  if [[ ! -x "$JAVA_HOME/bin/javac" ]]; then
    echo 'JAVA_HOME must point to a full JDK 17, with javac, rather than a JRE.' >&2
    exit 1
  fi
elif ! command -v javac >/dev/null 2>&1; then
  echo 'Install a full JDK 17 and set JAVA_HOME before building Android.' >&2
  exit 1
fi
curdr_version="$(node -p "require('./package.json').version")"
node scripts/build-avatar.mjs
npx expo prebuild --platform android --no-install --clean
python3 scripts/check-android-permissions.py android/app/src/main/AndroidManifest.xml
# Release bundle runs without Metro. The preview uses Expo's development signing key.
(cd android && ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a --no-daemon --max-workers=2)
mkdir -p artifacts
cp android/app/build/outputs/apk/release/app-release.apk artifacts/curdr-${curdr_version}-preview-arm64.apk
"$ANDROID_HOME/build-tools/37.0.0/apksigner" verify artifacts/curdr-${curdr_version}-preview-arm64.apk
"$ANDROID_HOME/build-tools/37.0.0/aapt" dump permissions artifacts/curdr-${curdr_version}-preview-arm64.apk | python3 scripts/check-android-permissions.py --apk
sha256sum artifacts/curdr-${curdr_version}-preview-arm64.apk
