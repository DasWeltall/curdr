# Verification · 0.10.0

- 83 Python backend tests: real-run mocks, exact approval identity/generation, advertised session/always scopes, stale rejection, channel proposal validation, push final-only events, persistent tickets, retry, dead-token removal, quiet hours, foreground suppression and authenticated registration.
- 20 Node app tests; TypeScript strict check; Expo web export.
- Browser QA against the production export: opaque Brain Dump in dark mode, Make a plan, Start / Save for later, closed visualization entries, settings grouping and Gabarito.
- Official Hermes approval payload and allowed choices were checked against upstream API source. Broader permissions are never inferred.
- Bootstrap syntax/help checked. Fresh Hermes/provider setup and configured FCM device delivery require actual owner environment/credentials; not claimed as tested here.
- No paid model calls or access to the owner’s private network Hermes during verification.
