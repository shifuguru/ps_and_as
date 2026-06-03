# Multiplayer Architecture

## Overview

Multiplayer uses a **server-authoritative** model:

- The server holds the canonical `gameState`, roster, and turn order.
- Clients send **intents** (`play`, `pass`, `tenRule`, `ready`, etc.).
- The server applies `core` rules once, advances inactive seats, bumps a monotonic **`stateVersion`**, and broadcasts **`gameStateSync`** snapshots (with **`phase`** metadata).

Clients **do not** apply `playCards` / `passTurn` locally while online; they render the latest snapshot.

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

## Dead hand

1. Human joins in progress as **spectator**.
2. At round end, taps **Ready** → `claimDeadHandForReadySpectator` / bot `promoteReadySpectators` (never `bots.pop()` for first human).
3. `replaceDeadHandInGameState` swaps `__dead_hand__` for the human in the between-rounds snapshot.
4. Next deal uses **ring order** from previous `gameState.players`, not lobby join order.

## Event flow (play)

1. Client: `gameAction` `{ type: 'play', cards }` (no local state mutation).
2. Server: validate seat + turn → `playCards` → `advancePastInactiveSeats` → `bumpStateVersion` → `gameStateSync`.
3. Client: `applyServerSync` if `stateVersion >= lastApplied`.

## Bot table

Same pipeline; `botHostedRooms` runs CPU steps on the server and uses the same `advancePastInactiveSeats` wrapper.

## Legacy note

Older docs described broadcasting raw `gameAction` for client replay. That path is **offline / deprecated** for online play; the server does not rely on clients replaying actions.
