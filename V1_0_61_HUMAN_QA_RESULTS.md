# v1.0.61 Human QA — Round Transition & Rankings

**Date:** 2026-06-08  
**Build:** Working tree (pre-commit) — baseline production v1.0.60 @ `249eabb`  
**Agent:** Automated regression + signoff-ready checklists

---

## Automated layer (executed 2026-06-08)

| Test | Script | Result |
|------|--------|--------|
| Core rules + On Top direction recovery | `npx tsx ./scripts/test-core.ts` | **PASS** (exit 0) |
| On Top pass-block trace | `npx tsx ./scripts/trace-on-top-pass-block.mjs` | **PASS** (exit 0) |
| Reconnect during rankings / ready replay | `node scripts/test-reconnect-round-complete.mjs` | **PASS** — Test 3a joinRoom, Test 3b requestGameState |
| Connected round-end overlay order | `node scripts/test-connected-round-end-order.mjs` | **PASS** — Test 1 (no early rankings) |
| Release gate — offline slice | `npm run test-release-gate:offline` | **PASS** — 5/5 gates |
| Release gate — RC scope (D-010 waiver) | `SKIP_BOTOPN=1 SKIP_LIVE=1 npm run test-release-gate` | See `V1_0_61_RELEASE_BUNDLE.md` |

**BOTOPN gates:** `botopn-lifecycle` and `botopn-stall-live` **waived per D-010** — not RC-blocking.

---

## Round transition — Human QA checklist

Run on **staging or production build** with 2–3 humans in a **private room**. Repeat Asshole streak (≥3) preferred to exercise fresh-round path.

| # | Scenario | Pass criteria | Status |
|---|----------|---------------|--------|
| RT-1 | Finish round → rankings → ready → next deal | Hands visible after trades; PLAYING phase; no empty-hand stall | ☐ Director |
| RT-2 | Fresh round (3× Asshole) — instant trades | No phantom President trade; deal ceremony completes | ☐ Director |
| RT-3 | Sync out-of-order (`tradesComplete` before ceremony) | Client recovers; hands appear; round playable | ☐ Director |
| RT-4 | Capture on failure | Screenshot + `phase`, hand counts, event order (see `P0_ROUND_TRANSITION_INVESTIGATION.md`) | N/A |

**Automated proxy:** Cluster A defensive finalize in `GameScreen.tsx`; `quick-private-2h` + `private-reconnect` gates green on RC scope run.

---

## Rankings — Human QA checklist

From `studio/delegations/rankings-qa-package.md`. Production URL: https://shifuguru.github.io/ps_and_as/

| # | Scenario | Pass criteria | Status |
|---|----------|---------------|--------|
| R-1 | Last-hand reveal before rankings | Rankings modal **after** last-hand moment completes | ☐ Director |
| R-2 | Rankings content at ROUND_COMPLETE | President → … → Asshole order correct; no empty modal | ☐ Director |
| R-3 | 10-rule pending at round end | Last player acts before rankings | ☐ Director |
| R-4 | Reconnect during ROUND_COMPLETE (seated) | Same finish order + ready map via joinRoom / requestGameState | ☐ Director (Test 3b automated PASS) |

---

## On Top — live gameplay smoke

Automated core + trace green. **Live multiplayer smoke still required** before calling On Top fully verified in production:

| # | Step | Pass criteria | Status |
|---|------|---------------|--------|
| OT-1 | Private room — play higher/lower 10, others pass | Winner gets On Top; can play or pass | ☐ Director |
| OT-2 | Winner passed early in trick (online sync) | Not blocked by pass guard; server accepts action | ☐ Director |
| OT-3 | Beat on-top pile | Valid beat plays; invalid rejected | ☐ Director |

Reference: `ON_TOP_FIX_VERIFICATION.md`

---

## D-010 — Find Game BOTOPN hide

| # | Check | Expected | Status |
|---|-------|----------|--------|
| D10-1 | Find Game with only BOTOPN listed | **No Public Games Available** — no BOTOPN row | ☐ Director (code shipped) |
| D10-2 | Join by code `BOTOPN` | Error: no public games available | ☐ Director (code shipped) |
| D10-3 | Human public lobby | Normal join row visible | ☐ Director |

---

## Director signoff

| Area | Director | Date | Notes |
|------|----------|------|-------|
| Round transition RT-1–RT-3 | ☐ | | |
| Rankings R-1–R-3 | ☐ | | |
| On Top OT-1–OT-3 | ☐ | | |
| D-010 Find Game hide | ☐ | | |
| **Accept RC ship with automated + partial Human QA** | ☐ | | |

**Recommendation:** Automated slice is green for round transition proxies and rankings ordering. **Director Human QA (≈20 min)** on private room + Find Game still required for RC-M1 / RC-M3 signoff unless explicit waiver recorded.
