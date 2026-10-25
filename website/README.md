# curdr product website

A buildless static site with self-hosted Gabarito fonts, an interactive illustrative product conversation, an agent-install message and no analytics/account form.

From the repository root, run `python3 scripts/build-website.py --out artifacts/website`. The output includes install.md, the installation skill, the source ZIP and a versioned SHA-256 descriptor. Host the output directory over HTTPS. The illustrative conversation makes no model requests.
