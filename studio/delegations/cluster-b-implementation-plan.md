# Cluster B — Implementation Plan (Spectator → Seated Promotion)

**Agent:** Implementation  
**Status:** **Approved for implementation planning** (Director 2026-06-20)  
**Gates:** `spectator-promote` (FAIL), `botopn-stall-live` (live HANG)  
**Do not implement until Director activates Implementation Agent**

---

## Problem statement

Spectators who click **Ready** between rounds are not observed as seated in gate tests. Promotion is **deferred entirely to `startNextRound`**, but `tryStartNextRoundIfReady` can fire when **only seated players** are ready — starting the next round **before** a spectator’s ready arrives. The spectator then misses the promotion snapshot until the following round end.

### Evidence (ordering bug)

`scripts/test-multiplayer-matrix.mjs` (`ONLY=2hs`, `ROUNDS=1`):

1. `playRounds` sends `playerReadyForNextRound` for **seated humans only** at round end (~344–346).
2. That can immediately satisfy `allPlayersReadyForNextRound` → `startNextRound` (~681–691 in `server/index.js`).
3. `claimDeadHandForReadySpectator` runs with **no ready spectator yet** (~171–183 in `server/tableRoster.js`).
4. Test sends spectator ready **after** `playRounds` returns (~452–456) — too late; `canSpectatorReady` may fail once the new round is in progress.

BOTOPN live hang (`test-cpu-stall-botopn.mjs`): human must appear in `gameState.players` with `hand.length > 0` — requires **promotion + `startNextRound` deal**. Same promotion-at-boundary dependency.

---

## Files affected

| File | Role | Change type |
|------|------|-------------|
| `server/index.js` | `playerReadyForNextRound`, `startNextRound`, `tryStartNextRoundIfReady` | **Modify** (~40–55 lines) |
| `server/tableRoster.js` | `claimDeadHandForReadySpectator`, shared promotion helper | **Modify** (~15–25 lines) |
| `server/botHostedRooms.js` | `promoteReadySpectators` | **Modify** (~10–20 lines) |
| `server/gameStateView.js` | `broadcastGameState`, optional targeted emit | **Modify** (~5–15 lines) |
| `src/game/socketAdapter.ts` | Optional `spectatorPromoted` event | **Optional** (~10 lines) — only if server adds explicit event |
| `src/screens/GameScreen.tsx` | `setSpectatorMode` on promotion sync | **Optional** (~5–10 lines) — if not covered by existing `gameStateSync.spectator` |

**Out of scope for Cluster B:** D-008 App.tsx navigation (mid-match Join) — adjacent but separate work item `wi-spectator-join`.

---

## Expected code changes

### 1. Immediate between-rounds promotion (core fix)

Add server helper (location: `tableRoster.js` or `index.js`):

```text
promoteReadySpectatorsBetweenRounds(room) → promoted[]
```

- Preconditions: `isRoundComplete(gs) && !tenRulePending`.
- Private rooms: `claimDeadHandForReadySpectator` (existing logic).
- BOTOPN: delegate to `botHosted.promoteReadySpectators` (existing logic).
- Idempotent: skip players already `!isSpectator`.

Call from **`playerReadyForNextRound`** after marking ready and **before** `tryStartNextRoundIfReady`:

1. If spectator marked ready and between rounds → run promotion helper.
2. On any promotion: `broadcastGameState`, `lobbyUpdate`, and per-promoted-member **`connected`** payload refresh with `isSpectator: false` (or rely on sync if proven sufficient in gate).

Keep **`startNextRound`** promotion call for rosterChanged / finish-order logic, but make it idempotent (already-promoted players no-op).

### 2. Sync visibility

Ensure promoted member receives **`gameStateSync`** with `spectator: false` immediately (`gameStateView.viewForMember` / `memberInRound` already derives this — verify emit to promoted socket after lobby flag flip).

Optional: emit `nextRoundStarting`-style `promotedPlayerIds` on immediate promotion so React client clears spectator mode without waiting for round start.

### 3. Ready gate (optional tightening)

**Alternative / additive:** Do not call `tryStartNextRoundIfReady` from seated-only ready until BOTOPN auto-start timer or explicit policy — **not recommended** as primary fix (changes UX countdown). Prefer immediate promotion.

### 4. BOTOPN live path

Same immediate promotion when human spectator ready between rounds on BOTOPN. Ensures human is in roster **before** `startNextRound` deals, so `test-cpu-stall-botopn.mjs` seated check can succeed once next round starts.

---

## Estimated line count

| Area | Lines |
|------|-------|
| Promotion helper + exports | 20–30 |
| `playerReadyForNextRound` integration | 15–20 |
| `startNextRound` idempotency / rosterChanged | 10–15 |
| Sync / lobby emits | 10–15 |
| Client (if needed) | 0–15 |
| **Total** | **55–95** |

---

## Regression risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Double promotion / duplicate seats | High | Idempotent helper; unit-style script coverage |
| Promoting during active round (mid-trick) | High | Strict `betweenRounds` guard (already on `canSpectatorReady`) |
| Wrong finish order when promoted early | Medium | `replaceDeadHandInGameState` only between rounds; verify `finishOrderForNextRound` on following `startNextRound` |
| Two spectators ready — only one dead hand | Medium | Existing `slice(0, 1)` behavior preserved |
| BOTOPN bot eviction when 2 humans seated | Medium | Existing `countHumansSeated >= 2` bot removal unchanged |
| Rankings / ready map key remap | Low | Existing dead-hand remap in `replaceDeadHandInGameState` |

---

## Required tests

### Automated (must pass)

```bash
ONLY=2hs ROUNDS=1 node scripts/test-multiplayer-matrix.mjs          # spectator-promote gate
node scripts/test-bot-table-lifecycle.mjs                           # bot table human promotion block
node scripts/test-cpu-stall-botopn.mjs --headless                   # turn loop unchanged
node scripts/test-cpu-stall-botopn.mjs                              # live seating (may use SKIP_LIVE=1 in CI)
node scripts/test-reconnect-round-complete.mjs
ONLY=2h ROUNDS=2 node scripts/test-multiplayer-matrix.mjs           # seated multi-round unaffected
SKIP_OFFLINE=1 npm run test-release-gate
```

### Manual

- 2 humans + spectator private room: spectator Ready before seated ready → still promotes.
- BOTOPN: join as spectator, Ready between rounds → seated with cards next deal.

---

## Rollback plan

1. Revert server-only commit(s) — no client deploy required if client unchanged.
2. Restart server process (in-memory rooms reset).
3. Re-run `ONLY=2hs` matrix — expect prior fail state, not worse.
4. **Rollback trigger:** Seated players promoted incorrectly; dead-hand swap mid-round; standard 2h room breaks; bot table evicts wrong players.

---

## Acceptance criteria

- [ ] `spectator-promote` gate PASS
- [ ] `botopn-stall-live` live path seats human within 120s (or documented SKIP_LIVE with matrix coverage)
- [ ] `quick-private-2h`, `reconnect-rankings`, `private-reconnect` remain PASS
- [ ] No promotion during mid-round (`canSpectatorReady` false)

**Reference:** [gate-failure-correlation.md](./gate-failure-correlation.md) § Cluster B
