# Memory that reduces repeated explanations

The first release uses explicit founder context (project, customer, stage, goal, capacity, boundaries, interruption preference), user-retained facts with channel/shared scope, the original brain dumps, channel briefs and Hermes-owned sessions. Facts are inspectable, editable and removable. A correction changes the stored fact; forgetting curdr founder facts does not silently claim to erase Hermes history, backups or an external memory provider.

The co-founder contract must distinguish a user-provided fact from a model inference. A vector match is not proof. Do not auto-promote every chat message into permanent memory. Important decisions should keep their reason and source; goals should be replaceable rather than accumulate contradictory duplicates.

## TencentDB for PostgreSQL

Tencent's official [Agent Long-Term Memory overview](https://www.tencentcloud.com/document/product/409/80363) describes relational facts, pgvector semantic recall and Apache AGE graph relationships, with project/agent/tenant scopes, expiry and optional `tencentdb_ai` embeddings/summaries. This is a plausible managed PostgreSQL backend for larger shared workspaces. It does not supply the assistant's judgment, memory curation policy or business context automatically.

**Decision for this release:** keep SQLite as the self-hosted default; do not require Tencent, embeddings or a cloud account. The current curdr runtime does not connect to TencentDB. No instance, paid resource or data transfer has been created.

Before adding a managed provider: define a MemoryStore interface, migrations and export/deletion semantics; isolate tenants with enforced ownership/RLS; record provenance and superseded facts; benchmark recall on the same founder tasks against the existing baseline. Start with relational + lexical retrieval and add embeddings only where measured recall needs them. Region, costs, backup/deletion behavior and the chosen embedding/model providers must be explicit deployment choices. Avoid copying documentation sample UUIDs or claims of automatic isolation without testing the actual application role/policies.

Hermes already supports memory providers; avoid a second competing source of truth. Keep user-visible founder facts separate from opaque automatic recall and make the current backend visible in the app.
