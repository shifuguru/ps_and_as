# Round Transition Verification Package

**Agent:** Regression  
**Sprint:** RC Closure  
**Date:** 2026-06-08  
**Work items:** `wi-round-transition`, `wi-rankings-verify`  
**Recommended signoff:** **Conditional pass — Director Human QA required**

---

## Scope

Verification for:

1. **Cluster A** — multiplayer round transition empty hands (`GameScreen` ceremony finalize)
2. **Rankings before last hand** — overlay order + reconnect replay
3. **Reconnect lifecycle** — seated join + `requestGameState` during `ROUND_COMPLETE`

---

## Pass/fail matrix (2026-06-08 rerun)

| ID | Test | Script / gate | Result | Cluster |
|----|------|---------------|--------|---------|
| RT-1 | Core rules + fresh round + ceremony merge | `npx tsx ./scripts/test-core.ts` | **PASS** | A |
| RT-2 | Connected round-end overlay order | `node scripts/test-connected-round-end-order.mjs` | **PASS** | Rankings proxy |
| RT-3 | Reconnect replay (joinRoom + requestGameState) | `node scripts/test-reconnect-round-complete.mjs` | **PASS** | Rankings |
| RT-4 | Private 2h × 3 rounds | `ONLY=2h ROUNDS=3 node scripts/test-multiplayer-matrix.mjs` | **PASS** (2026-06-20) | A regression |
| RT-5 | Release gate `quick-private-2h` | `npm run test-release-gate` | **PASS** (2026-06-20 slice) | A |
| RT-6 | Release gate `reconnect-rankings` | same | **PASS** | Rankings |
| RT-7 | Release gate `private-reconnect` | same | **PASS** | Reconnect |
| RT-8 | Production repro — 3× Asshole → round 4 empty hands | Human QA | **PENDING** | A |
| RT-9 | Rankings modal before last-hand reveal | Human QA Test 1 | **PENDING** | Rankings |
| RT-10 | Rankings content at ROUND_COMPLETE | Human QA Test 2 | **PENDING** | Rankings |
| RT-11 | Mid-round round-ending edge cases | Human QA Test 3 | **PENDING** | Rankings |

**Automated:** 7/7 green (including fresh 2026-06-08 core + reconnect + overlay scripts).  
**Human:** 0/4 complete.

---

## Cluster A — evidence summary

| Claim | Status |
|-------|--------|
| Fix implemented in working tree | **Yes** — `shouldFinalizeInstantTradesComplete`, `applyServerSync` defensive finalize |
| Double-finalize guarded | **Yes** — `ceremonyDoneForRoundRef` |
| Server deals correctly | **Supported** — RT-4, RT-5 PASS |
| Client shows empty hands | **Fixed in code** — not yet Human-verified on production repro |
| BOTOPN unaffected | **Yes** — socket-only; separate Cluster C |

**Regression recommendation:** **Keep** Cluster A implementation.

---

## Rankings — evidence summary

| Claim | Status |
|-------|--------|
| Early rankings modal | **Mitigated** — `roundOver` gated on `roundEnded` (automated RT-2) |
| Reconnect replay | **PASS** — RT-3, RT-6 |
| New gate failures implicate rankings | **No** — [gate-failure-correlation.md](./gate-failure-correlation.md) |
| Human UI order verified | **No** |

See [rankings-qa-package.md](./rankings-qa-package.md) for checklist.

---

## Reconnect lifecycle — evidence summary

| Scenario | Automated | Human |
|----------|-----------|-------|
| Seated `joinRoom` during ROUND_COMPLETE | PASS (Test 3a) | Pending Test 3B |
| Seated `requestGameState` replay | PASS (Test 3b) | Pending |
| Mid-turn disconnect + finish round | PASS (`private-reconnect` gate) | Spot-check recommended |
| Promotion after reconnect | PASS (`spectator-promote` post Cluster B) | — |

---

## Human QA checklist (Director signoff)

### Round transition (Cluster A)

- [ ] Private room, 3 humans, same player Asshole **3 consecutive rounds**
- [ ] Round 4 opens with **visible cards** in hand (not empty UI)
- [ ] Trades/ceremony completes or skips correctly per fresh-round rules
- [ ] Capture hand-count debug if fail

### Rankings Tests 1–3

Copy from [rankings-qa-package.md](./rankings-qa-package.md) — ~20 min on production build.

---

## Recommended signoff status

| Layer | Status | Signoff |
|-------|--------|---------|
| Automated regression | **PASS** | Regression Agent ✅ |
| Cluster A code review | **Keep** | Regression Agent ✅ |
| Cluster A production repro | **PENDING** | Director ☐ |
| Rankings Human QA 1–3 | **PENDING** | Director ☐ |
| **Overall RC-M1 / rankings gap** | **Conditional pass** | Ship only after Human QA or explicit waiver |

---

## Commands (repeatable baseline)

```bash
npx tsx ./scripts/test-core.ts
node scripts/test-connected-round-end-order.mjs
node scripts/test-reconnect-round-complete.mjs

# Server required
node server/index.js
ONLY=2h ROUNDS=3 node scripts/test-multiplayer-matrix.mjs
```

Expected: all exit 0 with PASS lines.
