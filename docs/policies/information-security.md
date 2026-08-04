# Information security policy

**Owner:** Project maintainer(s) of Ps & As  
**Applies to:** Source repo, GitHub Pages client, Railway game server, and operator laptops used for production access  
**Review cadence:** At least annually, or after a material incident / architecture change

## Purpose

Protect player identity data, session secrets, and service availability using controls proportionate to a small consumer multiplayer game.

## Principles

1. Least privilege — only people and systems that need production access get it.
2. Secrets stay off the client — never put HMAC keys or private tokens in `EXPO_PUBLIC_*`.
3. Prefer automated deploys over manual production edits.
4. Log enough to investigate abuse; never log raw tokens, passwords, or full session secrets.
5. Assume third parties (Apple, Google, GitHub, Railway) have their own controls; we configure ours correctly on top.

## In-scope assets

- GitHub repository and Actions
- Railway service + env + any volume for `server/data`
- Google OAuth client configuration
- Apple Game Center / App Store Connect (when used)
- Player cloud stats (`player-stats.json`) and live room state

## Required controls

| Control | Implementation |
|---------|----------------|
| Access | MFA on GitHub, Railway, Google Cloud, Apple — [ops-security-checklist.md](../ops-security-checklist.md) |
| Change management | PR + CI deploy for web; git-based Railway deploys |
| Encryption in transit | HTTPS for Pages and Railway public URLs |
| Vulnerability management | Dependabot + `dependency-audit` workflow |
| Policies & inventory | This folder + [data-inventory.md](../data-inventory.md) |
| Incident response | [incident-response.md](./incident-response.md) |
| Acceptable use | [acceptable-use.md](./acceptable-use.md) |
| Vendors | [vendors.md](../vendors.md) |

## Roles

| Role | Responsibility |
|------|----------------|
| Maintainer | Approves access, rotates secrets, handles incidents and deletion requests |
| Contributor | Follows PR process; no production secret access by default |

## Exceptions

Temporary exceptions (e.g. emergency hotfix from a laptop) must be recorded in the incident log with reason and follow-up (replay via CI, rotate if secrets were exposed).

## Related

- [access-control.md](./access-control.md)
- [SECURITY.md](../../SECURITY.md)
- [soc2-readiness.md](../soc2-readiness.md) — when a formal SOC 2 attestation is actually required
