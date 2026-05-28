# Presidents & Assholes (Ps & As)

Cross-platform card game built with **Expo (React Native)** and **TypeScript** — local Quick Game, hot-seat play, and optional **Socket.IO** multiplayer. The rules engine is pure functional TypeScript with deterministic test harnesses.

> Expo SDK 54 · React Native 0.81 · Art Deco felt-and-gold UI · Authoritative multiplayer server

## Features

- **Quick Game** — jump in solo against three CPUs from the main menu
- **Create / join online** — host a room, browse open lobbies, or join with a room code
- **Deal ceremony** — riffle shuffle animation and face-down dealing before each round
- **President / Asshole roles** — mandatory card trades after round 1+
- **Dead hand** — optional third seat in two-player games; special round-1 opening when the dead hand holds 3♣
- **Pure rules engine** (`src/game/core.ts`) — runs, twos, jokers, four-of-a-kind, 10-rule
- **In-app What's New** — changelog and known issues from the main menu
- **Crash recovery** — friendly error screen with **Attempt refresh** if something breaks
- **Auto-update prompt** on web when a newer build is deployed

## Getting started

### Prerequisites

- Node.js (LTS)
- npm

### Install & run

```powershell
npm install
npm start          # Expo dev server
npm run web        # browser
npm run android
npm run ios
```

### Game server (multiplayer)

```powershell
npm run server     # Socket.IO on http://localhost:3000
```

Set `EXPO_PUBLIC_SERVER_URL` in `.env` for production (e.g. Railway). Clients discover lobbies and sync game state through this server.

### Tests

```powershell
npm run test-core           # rules engine unit tests
npm run test-runs             # run-detection tests
npm run test-multiplayer      # 3-client smoke test (server must be running)
```

### Web production build

```powershell
npm run build:web
```

Output goes to `web-build/` (gitignored).

## Project structure

```
App.tsx                 # Navigation shell, menu, error boundary
src/
  game/                 # core.ts rules engine, network adapters, round prep
  screens/              # GameScreen, CreateGame, FindGame, UpdateLog, …
  components/           # Card, GameTable, DealCeremonyOverlay, …
  utils/                # table seats, trick display, layout
server/index.js         # Authoritative multiplayer server
scripts/                # test-core, test-multiplayer, …
```

## Game rules (summary)

| Topic | Rule |
|--------|------|
| Rank order | 3 … 10, J, Q, K, A, 2, Joker |
| Plays | Same-rank sets or valid runs (≥3 ranks, equal multiplicity) |
| 2s | Clear the pile; leader plays next |
| Joker | Beats a non-empty pile (one joker) |
| Four of a kind | Challenge — beat with higher quads or joker |
| 10-rule | After playing 10s, choose higher or lower for the trick |
| Round 1 | Must open with 3♣ (or 3♠ if dead hand holds 3♣) |

Full logic lives in `src/game/core.ts` and `src/utils/tableSeats.ts`.

## Multiplayer notes

- Server holds authoritative state; clients run deal ceremony locally then sync
- Disconnect grace (~20–30s) holds a seat for reconnect
- Mid-game rejoin skips deal animation and applies live state
- Spectators can claim the dead-hand seat next round

See **What's New** in the app (`updateLogContent.ts`) for recent fixes and known issues.

## Contributing

Issues and PRs welcome. Run `npm run test-core` and `npm run test-multiplayer` before submitting multiplayer changes.

## License

Private repository. Placeholder assets © their respective owners. License TBD for public release.
