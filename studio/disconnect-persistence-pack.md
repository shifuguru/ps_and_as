# Disconnect Persistence — Design Pack (Post-RC)

**Agent:** Architecture  
**Work item:** `wi-disconnect-persistence-pack`  
**Date:** 2026-06-08  
**Status:** **Design outline only — no implementation**  
**Authority:** Director **D-007** — post-RC scope

---

## Scope boundary

This pack covers **post-RC** gaps only:

| Gap | Priority | RC blocker? |
|-----|----------|-------------|
| CPU takeover after disconnect | P1 post-RC | **No** |
| Returning player after timeout | P1 post-RC | **No** |
| Disconnect timeout alignment (15s) | P1 post-RC | **No** |

**Not in scope:** Cluster C BOTOPN, round transition ceremony, rankings, spectator promotion (RC tracks).

---

## Current behaviour (RC ship baseline)

- Server removes disconnected players after grace (`IN_GAME_AWAY_GRACE` ~20–30s test / production TBD)
- No CPU replacement mid-round in standard rooms
- BOTOPN may demote human immediately — documented gap (`bot-open disconnect model`)
- Client shows disconnected state; no authoritative reclaim path

**RC known limitation (D-007):** Session may abort after timeout; no CPU takeover.

---

## Target behaviour (disconnect-persistence phase)

1. **Aligned timeout** — 15s grace server + UI countdown (single source of truth)
2. **CPU takeover** — optional bot fills seat after grace in standard rooms (configurable)
3. **Late reclaim** — returning player within window rejoins same seat with server hands
4. **BOTOPN** — explicit policy: spectate-only vs bot-fill (separate from standard rooms)

---

## Architecture intent (no code)

```text
Server                          Client
──────                          ──────
disconnect detected             presence → disconnected ring
start grace timer (15s)         show countdown (read-only)
grace expires                   ──
  ├─ standard: CPU takeover     render CPU seat
  └─ BOTOPN: policy TBD        spectate or wait
reconnect within window         resync gameStateSync
  └─ reclaim seat               restore hand from server
```

**Authority:** Server `gameState` + roster (`tableRoster.js`, `index.js`).  
**Non-goals for phase 1:** OAuth, cloud XP, cross-device identity (D-006).

---

## Files (future implementation touch list)

| Area | Files |
|------|-------|
| Grace / removal | `server/index.js` — away timers |
| CPU fill | `server/index.js`, `server/gameBridge.js` |
| Roster | `server/tableRoster.js` |
| Client presence | `GameScreen.tsx`, disconnect UI |
| Gaps register | `ARCHITECTURE_GAPS.md` |

**Estimated effort:** 3–5 days after RC exit — not estimated for RC sprint.

---

## Dependencies

- **Blocks on:** `rc-stability-exit` (Director signoff)
- **Does not block:** RC closure sprint

---

## Architecture Agent recommendation

**No RC expansion.** Deliver full design sections (API events, state machine, test plan) in a follow-up pass after RC ship. This outline satisfies sprint directive: remain focused on disconnect-persistence-pack **only**, no implementation.
