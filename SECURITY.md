# Security policy

## Supported versions

Security fixes target the **live web build** on [GitHub Pages](https://shifuguru.github.io/ps_and_as/), the **Android Play builds** cut from this repository, and the production Railway game server. Report issues against current `main` / production, not abandoned forks.

## Reporting a vulnerability

Please **do not** open a public GitHub issue for vulnerabilities that could harm players (auth bypass, seat hijack, secret leak, RCE, etc.).

Prefer one of:

1. **GitHub Security Advisories** — [Report a vulnerability](https://github.com/shifuguru/ps_and_as/security/advisories/new) on this repository (private to maintainers).
2. If advisories are unavailable, contact the maintainer via the GitHub profile for [@shifuguru](https://github.com/shifuguru) and mark the subject `Ps & As security`.

Include:

- Affected surface (web client, Android app, socket server, Google sync, seat reclaim, billing, …)
- Steps to reproduce or a proof-of-concept
- Impact (what an attacker gains)
- Whether you believe the issue is already being exploited

We will acknowledge reports when we can and aim to remediate high-impact issues before any coordinated disclosure.

## Out of scope (examples)

- Issues that require physical access to an unlocked device
- Attacks against third-party services we do not control (Apple, Google, GitHub, Railway, Stripe) except misconfiguration on our side
- Social-engineering players into revealing secrets
- Pure gameplay “cheats” that do not break confidentiality of other players’ hands or accounts (report those as bugs if useful)

## Security contacts (operators)

| Topic | Channel |
|-------|---------|
| Vulnerability disclosure | This file / GitHub Security Advisories |
| Player data deletion request | Email [shifuguru@outlook.com](mailto:shifuguru@outlook.com). Ask for Google-linked email (if any) + display name (Settings does not show raw player IDs) |
| Privacy questions | [Privacy policy](https://shifuguru.github.io/ps_and_as/privacy.html) · [shifuguru@outlook.com](mailto:shifuguru@outlook.com) |

## Related docs

- [docs/data-inventory.md](./docs/data-inventory.md) — data map for privacy / Play Data safety
- [docs/play-store/RELEASE_CHECKLIST.md](./docs/play-store/RELEASE_CHECKLIST.md) — Google Play release operator steps
