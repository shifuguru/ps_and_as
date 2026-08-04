# Ops security checklist (Phase A)

Use this whenever you deploy or onboard a maintainer. Complements [SECURITY.md](../SECURITY.md) and [data-inventory.md](./data-inventory.md).

## Access control

- [ ] MFA enabled on **GitHub** (org/user that owns `shifuguru/ps_and_as`)
- [ ] MFA enabled on **Railway** project that hosts the game server
- [ ] MFA enabled on **Google Cloud** project that owns the OAuth web client (if used)
- [ ] MFA enabled on **Apple Developer / App Store Connect** (if shipping native iOS)
- [ ] No shared passwords in chat; prefer password manager + unique credentials
- [ ] Remove access the same day someone leaves the project

## Secrets hygiene

| Secret | Where | Rules |
|--------|-------|-------|
| `GOOGLE_SESSION_SECRET` | Railway env | Required in production when Google sync is on. **Do not** fall back to the public client ID long-term. Rotate after any leak suspicion and on a ~90-day cadence. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_IDS` | Railway | Audience allow-list for ID tokens |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | GitHub Actions Variables + client bundle | Public by design; still keep Console origins locked down |
| `EXPO_PUBLIC_SERVER_URL` | GitHub Actions Variables | Public URL only — never a private key |
| `GITHUB_TOKEN` | Actions (provided) | Least privilege; do not echo into logs |

Checklist:

- [ ] Confirm no private secrets in `EXPO_PUBLIC_*` or committed `.env`
- [ ] `.env` is gitignored; only `.env.example` is committed
- [ ] After rotating `GOOGLE_SESSION_SECRET`, expect clients to re-exchange Google ID tokens

## Change management

- [ ] Production web ships via GitHub Actions (`deploy-web.yml`), not ad-hoc laptop uploads
- [ ] Prefer PR review before merging to `main`
- [ ] Avoid editing production Railway files by hand; use git deploy

## Vulnerability & dependency cadence

- [ ] Dependabot (or equivalent) open for npm ecosystems — see `.github/dependabot.yml`
- [ ] Review `npm audit` failures from CI (`dependency-audit` workflow)
- [ ] Patch high/critical production advisories promptly

## Incident readiness

If `GOOGLE_SESSION_SECRET`, Railway volume data, or seat logic is compromised:

1. Rotate the secret / credentials immediately
2. Invalidate sessions (secret rotation invalidates `psas1.*` tokens)
3. Note timeline in [policies/incident-response.md](./policies/incident-response.md)
4. If player PII may have been exposed, follow disclosure notes in that policy

## Privacy artifacts

- [ ] Player-facing policy live at `/privacy.html` on Pages
- [ ] [SECURITY.md](../SECURITY.md) lists current disclosure channel
