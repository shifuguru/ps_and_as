# Incident response policy

## When this applies

Suspicious access to Railway/GitHub, leaked `GOOGLE_SESSION_SECRET`, unauthorized cloud stats writes, seat-hijack reports, or accidental exposure of player identifiers/emails.

## Severity (simple)

| Level | Examples | Initial response |
|-------|----------|------------------|
| Sev-1 | Confirmed secret leak; mass unauthorized stats writes; RCE | Rotate secrets immediately; take service offline if needed |
| Sev-2 | Single-account abuse; hand-leak bug in multiplayer | Patch + deploy; notify affected players if PII exposed |
| Sev-3 | Dependency CVE with no known exploit path | Schedule patch via Dependabot/audit workflow |

## Response steps

1. **Contain** — revoke/rotate credentials; block abusive IPs only if Railway tooling allows and abuse is clear.
2. **Preserve** — save relevant logs (Railway, Actions) before redeploy wipes context.
3. **Eradicate** — merge fix; redeploy via CI; confirm Google auth guard still enforced.
4. **Recover** — restore `player-stats` from backup if volume/data was corrupted ([ops-persistence.md](../ops-persistence.md)).
5. **Announce** — for Sev-1/2 with player impact, note on What's New / README as appropriate; do not claim “SOC 2 compliant” as a substitute for disclosure.
6. **Learn** — append a short entry below; update checklist/policies if a control failed.

## Contacts

See [SECURITY.md](../../SECURITY.md). External reporters should use GitHub Security Advisories when possible.

## Session secret leak playbook

1. Generate a new high-entropy `GOOGLE_SESSION_SECRET` on Railway.
2. Redeploy/restart the server so the new secret is loaded.
3. Existing `psas1.*` tokens fail verification — players re-link via Google ID token exchange.
4. Check recent `google_auth_*` structured logs for spikes in denials or successes around the leak window.

## Incident log

| Date | Sev | Summary | Outcome |
|------|-----|---------|---------|
| — | — | No production incidents recorded in-repo yet | — |
