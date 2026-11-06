# Multiplayer Architecture

## Overview

Multiplayer uses a **server-authoritative** model:

- The server holds the canonical `gameState`, roster, and turn order.
- Clients send **intents** (`play`, `pass`, `tenRule`, `ready`, etc.).
- The server applies `core` rules once, advances inactive seats, bumps a monotonic **`stateVersion`**, and broadcasts **`gameStateSync`** snapshots (with **`phase`** metadata).

Clients **do not** apply `playCards` / `passTurn` locally while online; they render the latest snapshot.
The client retries a lost server connection up to five times with increasing delays, then stops
automatic retries instead of logging connection failures indefinitely. A later explicit connection
attempt can start a fresh retry cycle.

## Modules (server)

| Module | Role |
|--------|------|
| `server/tableRoster.js` | Ring seat order, dead-hand claim, `buildLobbyPlayersForAuthoritativeRound`, `shouldUseDeadHandForDeal` |
| `server/gameSync.js` | `stateVersion`, `phase` (`LOBBY` / `DEALING` / `TRADES` / `PLAYING` / `ROUND_COMPLETE`) |
| `server/turnAdvance.js` | Shared `advancePastInactiveSeats` (dead hand, evicted bots, ack pass) |
| `server/gameStateView.js` | Per-member hidden hands + sync payload |
| `server/botHostedRooms.js` | Bot turn loop; uses roster + shared turn advance |

## Client

| Module | Role |
|--------|------|
| `src/game/multiplayerSync.js` | Ignore stale snapshots (`stateVersion`) |
| `src/game/socketAdapter.ts` | Socket events → adapter messages |
| `GameScreen` `applyServerSync` | Ceremony / trades / between-rounds (still local UX); live play from server only |

### Player identity

The client creates one persisted install ID before entering a game or lobby.
When no display name has been chosen, the shared profile derives a temporary
name from that install ID; it does not save the temporary name as a chosen
name. The hub, settings, practice game, presence and online adapter use that
identity without requiring an account. Explicit names and linked account IDs
remain authoritative.

An online lobby saves the name actually sent to the room and the original
profile ID, even if the server assigns a different seat ID. Rejoin uses the
saved name and reconnect secret; a name changed in Settings also updates the
saved lobby session.

## Dead hand

1. Human joins in progress as **spectator**.
2. At round end, taps **Ready** → `claimDeadHandForReadySpectator` / bot `promoteReadySpectators` (never `bots.pop()` for first human).
3. `replaceDeadHandInGameState` swaps `__dead_hand__` for the human in the between-rounds snapshot.
4. Next deal uses **ring order** from previous `gameState.players`, not lobby join order.

## Event flow (play)

1. Client: `gameAction` `{ type: 'play', cards }` (no local state mutation).
2. Server: validate seat + turn (`currentPlayerIndex`) → `playCards` / `passTurn` → `reconcileCurrentPlayerIndex` → `advancePastInactiveSeats` → `repairStuckTurnPointer` → `reconcileCurrentPlayerIndex` → `bumpStateVersion` → `gameStateSync`.
3. Client: `applyServerSync` if `stateVersion >= lastApplied`.

**Turn ownership:** Core mutators may leave `currentPlayerIndex` on an out or passed seat until the repair steps above. That is compensating behaviour, not the intended contract. See [ARCHITECTURE_GAPS.md](./ARCHITECTURE_GAPS.md) — **Turn Ownership Invariant** and [TURN_OWNERSHIP_INVESTIGATION.md](./TURN_OWNERSHIP_INVESTIGATION.md).

## Bot table

Same pipeline; `botHostedRooms` runs CPU steps on the server and uses the same `advancePastInactiveSeats` wrapper.

## Legacy note

Older docs described broadcasting raw `gameAction` for client replay. That path is **offline / deprecated** for online play; the server does not rely on clients replaying actions.

## Related docs

- [GAME_ARCHITECTURE.md](./GAME_ARCHITECTURE.md) — § Turn ownership (`currentPlayerIndex`)
- [ARCHITECTURE_GAPS.md](./ARCHITECTURE_GAPS.md) — gap register
- [TURN_OWNERSHIP_INVESTIGATION.md](./TURN_OWNERSHIP_INVESTIGATION.md) — invariant audit and investigation guide
- [CPU_STALL_INVESTIGATION.md](./CPU_STALL_INVESTIGATION.md) — bot loop stall when display ≠ authoritative turn
