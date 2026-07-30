# Spectator auto-spectate — implementation plan (D-008)

**Agent:** Product  
**Work item:** `wi-spectator-join`  
**Date:** 2026-06-20  
**Status:** Ready for Director approval — **no code until approved**

---

## Decision

Director D-008: When a player **Joins** a room with an **active match**, automatically route to **Spectate** (live watch on GameScreen).

---

## Current behaviour

| Layer | Behaviour |
|-------|-----------|
| **Server** | `joinRoom` sets `isSpectator: true` via `shouldJoinAsSpectator()` when 2 seated + in-game. Emits `startGame` with `spectator: true` + `gameStateSync` on join (server/index.js ~1577–1592). |
| **App.tsx** | On `startGame` while `screen === "create"`: if `ev.state.spectator`, **returns early** — player **stays in lobby**, never reaches GameScreen. |
| **User impact** | Room-code Join mid-match → alone in lobby while game runs. |

Root cause is **client navigation**, not server sync.

---

## User flow (target)

```text
Find Game → Join with room code
  → Server: joinRoom (in-game, 2 seated)
  → Server: gameStateSync + startGame { spectator: true }
  → App: enterOnlineGame(members, name, id, asSpectator=true)
  → GameScreen: spectator mode, live table visible
```

Between-rounds join (ready for next round) remains unchanged — seated path when not forced spectator.

---

## Affected files

| File | Change |
|------|--------|
| `App.tsx` | **Primary** — `startGame` handler on create screen: replace early `return` on `spectator: true` with `enterOnlineGame(..., true)` |
| `App.tsx` | Ensure `connected` event `isSpectator` flag syncs before navigation (optional guard) |
| `server/index.js` | **Minor** — `startGame` replay when game already running (~1698): include `spectator` per requesting socket (today omits flag) |
| `studio/decisions.md` | Update D-003 note — superseded for mid-match Join by D-008 |

**Not in scope:** Server `shouldJoinAsSpectator` logic (already correct for standard rooms).

---

## Implementation proposal

### Step 1 — App.tsx `startGame` handler (create screen)

Replace:

```typescript
if (ev.state.spectator) {
  return;
}
```

With navigation equivalent to the non-create path:

```typescript
if (ev.state.spectator) {
  // D-008: mid-match Join → spectate live table
  const members = /* resolve from event + lobbyMembersRef (same as below) */;
  enterOnlineGame(members, displayName, localId, true);
  return;
}
```

Reuse member resolution from the existing handler (lines ~552–577) — extract small helper to avoid duplication.

### Step 2 — Server startGame replay parity

When `room.inGame` and client calls `startGame` (sync path ~1695–1703), include:

```javascript
spectator: !!room.players.find(p => p.socketId === socket.id)?.isSpectator,
```

Prevents ambiguous client state on manual resync.

### Step 3 — Verification

- Manual: 2 players in-game → 3rd joins via room code → lands on GameScreen as spectator.
- Release gate: `ONLY=2hs npm run test-multiplayer-matrix` (currently fails promotion path — separate from D-008; re-run after fix).

---

## Risk assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Accidental spectate when user expected seated (dead-hand open) | Low | Server already decides spectator; D-008 aligns UI with server intent |
| Double navigation / race with gameStateSync | Medium | Reuse existing `enter()` + sync waiter pattern; `screenRef` guard |
| CreateGame unmount before sync | Low | Global App handler already owns startGame for this reason |
| Regression on between-rounds seated join | Medium | Only auto-spectate when `ev.state.spectator === true` from server |

**Estimated scope:** ~30–50 lines in App.tsx + ~3 lines server. **1 Implementation Agent session** after Director approval.

---

## Acceptance criteria

- [ ] Mid-match room-code Join opens GameScreen in spectator mode with live state
- [ ] Between-rounds seated join still works when server assigns seated role
- [ ] No change to multiplayer authority or gameStateSync handling
- [ ] Document in What's New on ship (when implemented)
