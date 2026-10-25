# curdr 0.11.0

Install both the 0.11.0 Android app and gateway/web update. Preserve the existing curdr data directory and Hermes configuration.

- Flat recording and preview composer, fixed Stop/Send button, no inline X or duration label.
- Composer resets after sending and grows only for typed text, up to five lines.
- Durable local outbox waits for stream confirmation; retries reuse the message ID. Gateway writes preserve transcript order, and replayed stream packets cannot overwrite final replies.
- Bounded, paginated Markdown tables and compact previews for oversized replies keep the chat finite. The complete response remains available.
- Compact real activity indicator and an isolated, editable curdr-chat skill: brief useful replies, no dash-heavy prose and no unnecessary pings.
- Expo binary media upload fix from 0.10.3 is included. Native cards are preferred for structured results.
- README introduces the product and explains existing Hermes, first install, Android and iPhone/web access.

Validation: 33 Node tests, 91 backend tests, TypeScript and production web export. Physical-phone microphone and the owner’s private Hermes require device acceptance; automated tests use controlled adapters without paid model calls.
