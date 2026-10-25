# Avatar Studio – vendored, unmodified upstream sources

- Repository: https://github.com/ai-calypse/avatar-studio
- Revision: 231533990744a22f329d8a0a4ac9d86bfeca55ed
- Package: @ai-calypse/avatar-studio 0.2.0
- License: MIT, Copyright (c) 2026 CX ART Lab and ai-calypse
- Copied: public entrypoint, src/, TypeScript declarations, LICENSE.

The original SVG rendering, customization, gestures and animation implementation
is bundled unchanged with esbuild. curdr's adapter runs this bundle offline in a
WebView on native platforms and a sandboxed iframe on web. No hosted avatar API,
remote JavaScript or copied ChatGPT artwork is used. The curdr editor is separate.
