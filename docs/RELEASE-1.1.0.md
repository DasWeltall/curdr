# curdr 1.1.0

- Fixes image/file messages rejected by Hermes with “No user message found in input”. Image content now travels inside a user message; original documents remain available in the shared workspace for Hermes' tools.
- Brain Dumps run as saved gateway jobs. Leave the screen, use the rest of the app, and reopen progress or review the finished plan from the header or Tasks. Voice captures are uploaded before background transcription starts, using Hermes' configured speech provider.
- Shows actual planning stages and tool activity. Removes the previous gray loading copy. Failed captures retain their original input and diagnostics. A gateway restart marks interrupted work for review rather than silently repeating a paid run.
- Shows browser actions and captured pages reported by Hermes. Browser views are saved images, not a continuous remote video feed. Local shared screenshots or an explicitly configured Hermes cache are required for image previews.
- Adds an editable food/menu assistant role to channel context. Dietary preferences and boundaries remain user-provided; menu details must come from actual pages, photos or files.
- Refines the app icon and updates Android/PWA assets.

Update both the gateway and Android app for this release. Existing conversations, preferences and pairing remain in the same data directory. See [installation](../install.md) and [connection setup](CONNECT-HERMES.md).
