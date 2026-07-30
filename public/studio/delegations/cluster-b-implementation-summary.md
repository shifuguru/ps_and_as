# Cluster B — Implementation Summary

**Work item:** `wi-spectator-promotion`  
**Date:** 2026-06-20  
**Status:** Implemented and validated (primary gate green)

---

## Summary

Fixed spectator **Ready → seated** promotion timing on the server:

1. **`canSpectatorMarkReadyForPromotion`** — allows ready between rounds **or** at round open when a dead-hand seat exists (covers late ready after seated players already advanced).
2. **`promoteReadySpectatorsBetweenRounds`** — immediate promotion on spectator ready (private dead-hand + BOTOPN paths).
3. **`notifyPromotedSpectators`** — `broadcastGameState`, `lobbyUpdate`, and targeted `connected` + `gameStateSync` with `isSpectator: false`.

`startNextRound` promotion remains idempotent for roster/finish-order logic.

---

## Files changed

| File | Change |
|------|--------|
| `server/index.js` | Promotion helpers; expanded spectator ready eligibility; immediate promote + notify in `playerReadyForNextRound` |

**Lines:** ~65 net

---

## Test results (server restarted after deploy)

| Test | Result |
|------|--------|
| `ONLY=2hs ROUNDS=1` matrix (`spectator-promote`) | **PASS** |
| `ONLY=2h ROUNDS=2` matrix | **PASS** |
| `node scripts/test-reconnect-round-complete.mjs` | **PASS** |
| `node scripts/test-cpu-stall-botopn.mjs --headless` | **PASS** |
| `node scripts/test-bot-table-lifecycle.mjs` | **FAIL** — bot solo next-round (Cluster C, not B) |
| `node scripts/test-cpu-stall-botopn.mjs` (live) | **Pending / may hang** — BOTOPN seating (Cluster C overlap) |

---

## Risk assessment

| Risk | Status |
|------|--------|
| Mid-round promotion | Mitigated — requires dead-hand seat in live state or round complete |
| Duplicate seating | Idempotent promotion helpers |
| D-008 navigation | **Unchanged** |
| Rankings / reconnect | **PASS** on regression scripts |

---

## Recommendation

**Keep** — `spectator-promote` gate passes with restarted server. BOTOPN lifecycle / live stall remain **Cluster C** investigation.

---

## Rollback

Revert `server/index.js` Cluster B hunks; restart server.
