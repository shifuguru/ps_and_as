# Access control policy

## Accounts in scope

GitHub, Railway, Google Cloud Console (OAuth client), Apple Developer (if used), and any shared password-manager vault for the project.

## Rules

1. **MFA** is required on every account that can change production code, env, or DNS/hosting.
2. **No shared interactive logins.** Prefer individual accounts. If a shared break-glass account exists, store it in a password manager and log every use.
3. **Offboarding:** revoke GitHub/Railway/Google/Apple access the same day someone leaves.
4. **Secrets:** production secrets live in Railway / GitHub Actions Variables or Secrets — not in the repo, Discord, or screenshots.
5. **Client IDs vs secrets:** OAuth *web client IDs* may be public; `GOOGLE_SESSION_SECRET` and deploy tokens must not be.
6. **Server data:** only maintainers with Railway access may read or edit `player-stats.json` or run [delete-player-stats.js](../../scripts/delete-player-stats.js).
7. **Least privilege for Actions:** do not broaden `permissions:` in workflows without review.

## Authentication inside the product

| Path | Control |
|------|---------|
| Device / install ID | Local identity; not a password |
| Game Center | Apple authentication on device |
| Google-linked stats writes | Bearer ID token or `psas1.*` session; audience checked server-side |
| Seat reclaim | Server-held `reconnectSecret` (not the public profile id alone) |

Failed Google auth attempts are logged in structured form without tokens (see `server/googleAuth.js`).

## Periodic review

- Quarterly: who has Railway + GitHub admin?
- After any suspected compromise: rotate `GOOGLE_SESSION_SECRET` and review Actions secrets.
