# Security policy

## Supported versions

Security fixes target the **live web build** on [GitHub Pages](https://shifuguru.github.io/ps_and_as/) and the production Railway game server. Report issues against current `main` / production, not abandoned forks.

## Reporting a vulnerability

Please **do not** open a public GitHub issue for vulnerabilities that could harm players (auth bypass, seat hijack, secret leak, RCE, etc.).

Prefer one of:

1. **GitHub Security Advisories** — [Report a vulnerability](https://github.com/shifuguru/ps_and_as/security/advisories/new) on this repository (private to maintainers).
2. If advisories are unavailable, email the maintainer via the GitHub profile for [@shifuguru](https://github.com/shifuguru) and mark the subject `Ps & As security`.

Include:

- Affected surface (web client, socket server, Google sync, seat reclaim, …)
- Steps to reproduce or a proof-of-concept
- Impact (what an attacker gains)
- Whether you believe the issue is already being exploited

We will acknowledge reports when we can and aim to remediate high-impact issues before any coordinated disclosure.

## Out of scope (examples)

- Issues that require physical access to an unlocked device
- Attacks against third-party services we do not control (Apple, Google, GitHub, Railway) except misconfiguration on our side
- Social-engineering players into revealing secrets
- Pure gameplay “cheats” that do not break confidentiality of other players’ hands or accounts (report those as bugs if useful)

## Security contacts (operators)

| Topic | Channel |
|-------|---------|
| Vulnerability disclosure | This file / GitHub Security Advisories |
| Player data deletion request | Same channels; include player ID (`google:…`, Game Center id, or device id) |
| Privacy questions | [Privacy policy](https://shifuguru.github.io/ps_and_as/privacy.html) |

## Baseline expectations for maintainers

See [docs/ops-security-checklist.md](./docs/ops-security-checklist.md) for MFA, secret rotation, and deploy hygiene. Data map: [docs/data-inventory.md](./docs/data-inventory.md).
