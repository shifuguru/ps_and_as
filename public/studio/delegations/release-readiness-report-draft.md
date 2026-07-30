# Release Readiness Report — RC Closure Sprint

**Agent:** Release  
**Version target:** v1.0.60+ (uncommitted working tree)  
**Date:** 2026-06-08 (updated D-010)  
**Prior status:** DO NOT SHIP (52%)  
**Current status:** **SHIP WITH KNOWN ISSUES** — conditional on Director signoff

---

## Executive summary

The project is **substantially healthier** than the pre-correlation forecast. Non-BOTOPN server gates pass reliably. Clusters A and B are **implemented and regression-green**. **Director D-010:** BOTOPN is **deferred from RC critical path** — not abandoned.

**Release Agent recommendation:** **SHIP WITH KNOWN ISSUES** once Human QA signoff + non-BOTOPN gate rerun + Find Game hide (D-010) complete.

**Path to ship:**

1. Director Human QA — round transition repro + rankings Tests 1–3 (or explicit waiver)
2. Product + Engineering — hide BOTOPN in Find Game for RC builds (D-010)
3. Full gate rerun — **non-BOTOPN slice** (`SKIP_LIVE=1` or orchestrator waiver documented)

---

## Gate results (RC scope — D-010)

| Gate | RC blocking? | Result | Notes |
|------|--------------|--------|-------|
| `core` | Yes | **PASS** | Rerun 2026-06-08 |
| `roster` | Yes | **PASS** | Prior slice |
| `offline-sim` | Yes | **PASS** | Prior slice |
| `turn-headless` | Yes | **PASS** | Prior slice |
| `turn-ring` | Yes | **PASS** | Prior slice |
| `quick-private-2h` | Yes | **PASS** | Multi-round private |
| `spectator-promote` | Yes | **PASS** | Post Cluster B |
| `reconnect-rankings` | Yes | **PASS** | Rerun 2026-06-08 |
| `private-reconnect` | Yes | **PASS** | Prior slice |
| `botopn-lifecycle` | **No (waived)** | FAIL post-RC | Cluster C — deferred D-010 |
| `botopn-stall-live` | **No (waived)** | FAIL/HANG post-RC | Deferred D-010 |

---

## Shipped / ready in working tree

| Cluster | Status | RC impact |
|---------|--------|-----------|
| **A** — Client ceremony finalize | Implemented | Supports P0 fix; `quick-private-2h` PASS |
| **B** — Spectator promotion | Implemented | `spectator-promote` PASS |
| **C** — BOTOPN lifecycle | **Deferred post-RC** | Not RC-blocking per D-010 |

---

## Known issues accepted for RC

| ID | Issue | Severity | RC accept? |
|----|-------|----------|------------|
| **RC-K1** | BOTOPN lifecycle disabled for RC | Medium | **Yes** — D-010 deferral |
| **RC-K2** | Public bot-hosted matchmaking deferred post-RC | Medium | **Yes** — D-010 deferral |
| **RC-K3** | Disconnect grace ends session (no CPU takeover) | Low | **Yes** — per D-007 |
| **RC-K4** | D-008 navigation not implemented | Low | **Yes** — promotion fixed separately |
| **RC-K5** | Rankings Human QA not signed | **High** | **No** — requires Director QA or waiver |

---

## RC confidence estimate

| Factor | Weight | Score |
|--------|--------|-------|
| Private multiplayer gates | 35% | 95% |
| Round transition automated | 20% | 85% |
| Rankings automated | 15% | 80% |
| BOTOPN deferred (D-010) | 10% | 100% (scope removed) |
| Human QA complete | 20% | 40% |

**Recalculated confidence: 78%** — label **medium**  
**Ship recommendation:** **SHIP WITH KNOWN ISSUES**

**Blockers to raise confidence to 85%+:**

- Human QA signoff (round transition + rankings)
- Non-BOTOPN gate rerun documented green
- Find Game BOTOPN hide shipped for RC

---

## Changelog draft (player-facing)

**Title:** Multiplayer stability & table polish

- Fixed some online games showing empty hands after trades when starting a fresh round
- Fixed spectators not joining the table after tapping Ready between rounds
- Turn highlight ring animation should feel smoother (continuous pulse)
- Short seat chat messages at the table (when enabled in build)
- Ten-rule fixes when continuing a run on top of a 10

**Known issues:**

- **Quick Online (public bot table) is temporarily unavailable** — use Create Game or Quick Game offline
- Disconnecting for too long may end your session (CPU takeover coming in a future update)

---

## Deploy checklist

### Pre-merge

- [ ] Commit scoped RC bundle
- [ ] `npx tsx ./scripts/test-core.ts` — PASS
- [ ] `node scripts/test-connected-round-end-order.mjs` — PASS
- [ ] `node scripts/test-reconnect-round-complete.mjs` — PASS
- [ ] Find Game hides BOTOPN for RC (D-010)
- [ ] Restart server; run gate — **non-BOTOPN slice** PASS; BOTOPN waived documented
- [ ] Director Human QA — round transition + rankings (or waiver)

### Post-deploy

- [ ] Human smoke — private 2h round 2 deal
- [ ] Human smoke — spectator ready promotion
- [ ] Find Game shows "No Public Games Available" when lobby empty (no BOTOPN)

### Rollback

- Revert Cluster A: `GameScreen.tsx` ceremony hunks
- Revert Cluster B: `server/index.js` promotion hunks
- Revert Find Game hide if needed

---

## Director decisions required

| # | Decision | Status |
|---|----------|--------|
| 1 | Cluster C / BOTOPN for RC | **Resolved — deferred (D-010)** |
| 2 | Human QA | Run checklist **or** waiver |
| 3 | D-008 | Defer post-RC **or** approve plan for RC |
| 4 | Ship mode | **SHIP WITH KNOWN ISSUES** |

---

## Related artifacts

- [BOTOPN_RC_DEFERRAL.md](../BOTOPN_RC_DEFERRAL.md)
- [round-transition-verification-package.md](./round-transition-verification-package.md)
- [rankings-qa-package.md](./rankings-qa-package.md)
- [cluster-c-investigation.md](./cluster-c-investigation.md)
- [gate-failure-correlation.md](./gate-failure-correlation.md)
