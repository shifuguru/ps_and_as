# Vendors & subprocessors

Systems that process or host Ps & As data. Review when adding a new host, auth provider, analytics SDK, or payment processor.

| Vendor | Role | Data involved | DPA / trust materials | Notes |
|--------|------|---------------|----------------------|-------|
| GitHub | Source, Actions, Pages, Sponsors | Source code; build logs; static assets; donation UX on GitHub | [GitHub customer agreements](https://github.com/customer-terms) | Pages serves the client only |
| Railway | Game server host | Room state; `player-stats.json`; env secrets | Railway terms / DPA (dashboard) | Enable volume for `server/data` — [ops-persistence.md](./ops-persistence.md) |
| Google | Optional Sign-In | OAuth `sub`, optional email/name via tokeninfo | [Google Cloud terms](https://cloud.google.com/terms) | Configure authorized origins/JS origins tightly |
| Apple | Game Center (iOS) | Player ID, display name via Apple APIs | Apple Developer / privacy docs | Disclose sharing with tablemates |

## Not in use (confirm before adding)

- Third-party product analytics / ad SDKs
- In-app payment processors (Stripe, etc.)
- Separate email/SMS providers
- Error-tracking SaaS (Sentry, etc.) — add here if introduced

## Operator checklist when adding a vendor

1. Update this table and [data-inventory.md](./data-inventory.md)
2. Update [privacy.html](../public/privacy.html) if players are affected
3. Prefer vendors with a signed DPA when storing personal data in the EU/UK at scale
4. Prefer region and retention settings that match how long we actually need the data
