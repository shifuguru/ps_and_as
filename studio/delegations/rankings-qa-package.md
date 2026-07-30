# Rankings before last hand — verification package

**Agent:** Regression  
**Work item:** `wi-rankings-verify`  
**Date:** 2026-06-08 (RC closure sprint — regression rerun)  
**Recommendation:** **Signoff-ready checklist** — automated slice green; Director Human QA Tests 1–3 required for final ✅

---

## Gate correlation — rankings not implicated (2026-06-20)

New gate failures (`spectator-promote`, `botopn-lifecycle`, `botopn-stall-live`) are **orthogonal** to rankings:

| New failure | Touches rankings / round-end overlay? |
|-------------|----------------------------------------|
| `spectator-promote` | No — promotion at `startNextRound` |
| `botopn-lifecycle` | No — BOTOPN between-rounds server stall |
| `botopn-stall-live` (live) | No — spectator seating before play |

See [gate-failure-correlation.md](./gate-failure-correlation.md).

---

## Automated verification

| Test | Script | Result (2026-06-08) |
|------|--------|------------------------|
| Reconnect during rankings / ready replay | `node scripts/test-reconnect-round-complete.mjs` | **PASS** — Test 3a seated joinRoom, Test 3b requestGameState |
| Connected round-end overlay order (Test 1 proxy) | `node scripts/test-connected-round-end-order.mjs` | **PASS** — roundOver gated on roundEnded; no early rankings |
| Release gate `reconnect-rankings` | Part of `npm run test-release-gate` | **PASS** (2026-06-20 server slice; no regression) |

---

## Human QA Tests 1–3 checklist

Run on **production build** (https://shifuguru.github.io/ps_and_as/) with 3 humans in a private room.

### Test 1 — Rankings overlay order (connected client)

- [ ] Play a full round to completion with a visible last-hand moment (penultimate out on live pile preferred).
- [ ] **Pass:** Last-hand reveal plays before rankings modal appears.
- [ ] **Fail:** Rankings/scoreboard visible while last-hand cards still on table, or before reveal completes.
- [ ] Capture: screen recording + console if fail.

### Test 2 — Rankings content during ROUND_COMPLETE

- [ ] At round end, verify finish order matches server (President → … → Asshole).
- [ ] **Pass:** Order correct; no duplicate or missing seats.
- [ ] **Fail:** Wrong roles, empty rankings, or modal before round truly complete.

### Test 3 — Mid-round round-ending edge cases

- [ ] Scenario A: 10-rule pending when round ends — last player acts correctly before rankings.
- [ ] Scenario B: Reconnect during ROUND_COMPLETE (seated) — rankings replay via joinRoom / requestGameState.
- [ ] **Pass:** Reconnect shows same finish order and ready map; no stuck overlay.
- [ ] **Fail:** Rankings missing, wrong phase, or client stuck in ceremony/ready.

---

## Repro package (automated baseline)

```bash
# Terminal 1 — server on 4000
node server/index.js

# Terminal 2
node scripts/test-reconnect-round-complete.mjs
node scripts/test-connected-round-end-order.mjs
```

Expected: both exit 0 with PASS lines above.

---

## Pass/fail recommendation

| Layer | Status | Notes |
|-------|--------|-------|
| Automated reconnect + overlay order | **PASS** | Rerun 2026-06-08 |
| Human QA Tests 1–3 | **PENDING** | Director signoff — checklist below is **signoff-ready** |
| Gap `rankings-before-last-hand` | **Open** | Close after Human QA pass |
| New gate failures (BOTOPN) | **Not implicated** | Orthogonal per gate-failure-correlation.md |

**Regression Agent recommendation:** **Signoff-ready package** — attach this checklist to Director brief. Gap resolves when Tests 1–3 checked on production build (~20 min).

## Director signoff block

| Item | Director | Date |
|------|----------|------|
| Test 1 — overlay order | ☐ | |
| Test 2 — rankings content | ☐ | |
| Test 3 — edge cases / reconnect | ☐ | |
| Accept conditional pass for RC | ☐ | |
