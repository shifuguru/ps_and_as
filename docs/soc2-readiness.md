# SOC 2 readiness (Phase C)

Formal SOC 2 is **not** required for a consumer card game unless an enterprise buyer, partner, or investor asks for an attestation report. Do not claim “SOC 2 compliant” without an auditor-issued report.

This doc is the go/no-go checklist when that request arrives. Baseline hygiene is already described in Phase A/B docs under `docs/`.

## When to start

Start Phase C only if at least one is true:

- A paying B2B customer requires a SOC 2 report in the contract
- Fundraising / diligence explicitly requires SOC 2
- You are hosting white-label / enterprise tables with contractual uptime or security SLAs

Otherwise stay on Phase A/B (policies, MFA, inventory, privacy page, audits, persistence).

## Recommended scope for Ps & As

| Choice | Recommendation |
|--------|----------------|
| Trust Services Criteria | **Security** only at first |
| Report type | **Type I** first (design at a point in time), then Type II if the buyer needs operating effectiveness over time |
| System boundary | GitHub repo + Actions + Pages client + Railway game server + Google/Apple auth integrations |
| Out of scope initially | Availability/Privacy TSC unless contracts promise them |

## Tooling (optional)

**Vanta / Drata / Secureframe** automate evidence collection and control monitoring. They do **not** issue the SOC 2 report — an AICPA-accredited CPA firm does.

For this stack (GitHub + Railway, small team), buy automation when:

- You expect recurring annual audits, and
- Integrations (GitHub, Google Workspace, cloud) will actually reduce spreadsheet work

Otherwise run a lightweight control register from existing docs:

- [policies/information-security.md](./policies/information-security.md)
- [ops-security-checklist.md](./ops-security-checklist.md)
- [data-inventory.md](./data-inventory.md)
- [vendors.md](./vendors.md)

## Pre-audit checklist

1. MFA and access reviews current ([access-control.md](./policies/access-control.md))
2. Secrets rotation evidence (dates) for `GOOGLE_SESSION_SECRET`
3. Change management via PRs + Actions deploy logs
4. `npm audit` / Dependabot history
5. Incident response table exercised or tabletop’d once
6. Railway volume + backup evidence ([ops-persistence.md](./ops-persistence.md))
7. Privacy policy + SECURITY.md live and accurate
8. Vendor list + links to DPAs/terms
9. Hire auditor; agree observation window for Type II
10. Budget: platform fees (if any) + auditor fees — get current quotes; often mid four to five figures USD combined

## Explicit non-goals until required

- Buying Vanta “because of Instagram ads”
- Expanding into HIPAA / PCI / ISO 27001 without a driver
- Rewriting the game onto AWS solely for SOC 2 integrations

## Status

| Item | Status |
|------|--------|
| Phase A baseline | In repo (inventory, SECURITY, privacy, Dependabot, audit CI, ops checklist) |
| Phase B ops-ready | In repo (policies, vendors, auth logging, persistence docs/scripts) |
| Phase C formal audit | **Not started** — trigger only on real buyer/investor requirement |
