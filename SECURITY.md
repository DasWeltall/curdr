# Security

curdr is currently a single-owner, self-hosted gateway. Every workspace route requires its app bearer token except the one-time pairing exchange. Keep the existing Hermes API on loopback when possible and never put provider keys in the mobile app, URLs, issues or source control. Use valid HTTPS and explicit allowed origins for remote/browser use.

Shared filesystem access is bounded to an explicitly configured directory; hidden files and symlinks are not exposed. Local Hermes skill editing/installation is an explicit separate opt-in via `--hermes-home`. Skills are instructions/code and may influence what Hermes does: preserve upstream scanning and approval gates. Do not expose the gateway as a multi-tenant service.

Report vulnerabilities privately through the repository's GitHub security reporting feature when available, or contact the maintainer through their GitHub profile before publishing sensitive details. Do not post real tokens, recordings, customer data, proof-of-exploit secrets or a reachable vulnerable host in a public issue. A response SLA or supported LTS version is not promised during the early release.
