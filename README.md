# 🎮 Presidents & Assholes (Ps & As)

Cross‑platform card game built with Expo (React Native) and TypeScript, featuring hot‑seat play and optional Socket.IO multiplayer. This repo also showcases a pure functional rules engine with deterministic test harnesses.

> Built with Expo SDK 54, React Native 0.81.5 (New Architecture), and Socket.IO. Designed with an Art Deco aesthetic and a focus on clean game state transitions.

## ✨ Features

- Hot‑seat (local pass‑and‑play) mode
- Optional online multiplayer via Socket.IO server
- Pure, immutable game engine (TypeScript) with unit tests
- Full run logic, special rules, and trick lifecycle
  - Custom rank order: 3,4,5,6,7,8,9,10,J,Q,K,A,2,Joker
  - Runs with equal multiplicity (e.g., double/triple runs); 10s and Jokers excluded from runs
  - 2s clear the pile; four‑of‑a‑kind challenge; single Joker beats anything visible
  - “10‑rule” direction (higher/lower) when 10s are played — paused on active runs
- In‑app Debug Viewer for game/trick history, turn order, and placements
- Optional audio (graceful fallback if assets or deps missing)
- Centralized theming: Art Deco gold accents on noir backgrounds

## 🧠 Architecture (at a glance)

- Rules engine: `src/game/core.ts`
  - Pure functions for state transitions (`createGame`, `playCards`, `passTurn`)
  - Immutability by convention: no in‑place mutation of inputs
  - Helpers for runs, adjacency, and special rules enforcement
- Network adapters: `src/game/network.ts`, `src/game/socketAdapter.ts`
  - Event‑driven interface with a mock adapter for local testing
  - Socket.IO adapter is optional (dynamic require)
- UI: simple screen state in `App.tsx` (menu → create → game)
- Styling: `src/styles/theme.ts` centralizes colors/fonts
- Optional deps via dynamic imports: pattern used for audio and sockets
- Deterministic runtime for Node tests: `dist-scripts/src/game/core.js`

## 🗂 Project Structure

```
.
├─ App.tsx
├─ src/
│  ├─ game/
│  │  ├─ core.ts            # Rules engine (pure functions)
│  │  ├─ network.ts         # Adapter interface + mock
│  │  └─ socketAdapter.ts   # Socket.IO client (optional)
│  ├─ screens/              # Menu/Create/Game/etc.
│  ├─ components/           # Card, DebugViewer, etc.
│  ├─ hooks/                # useMenuAudio (optional dep)
│  └─ styles/               # theme.ts
├─ server/
│  └─ index.js              # Socket.IO lobby server
├─ scripts/
│  ├─ test-core.ts          # TS unit tests for engine
│  ├─ cpu-test.ts           # Simple CPU harness
│  └─ trace-game.js         # Trace helpers
└─ dist-scripts/
   ├─ src/game/core.js      # Deterministic JS runtime for Node tests
   └─ scripts/test-core.js  # Compiled runner
```

## 🚀 Getting Started

### Prerequisites

- Node.js (LTS recommended)
- npm
- Expo CLI

```powershell
npm install -g expo-cli
```

### Install

```powershell
npm install
```

### Run (Expo)

```powershell
npm start
# or
npm run android
npm run ios
npm run web
```

### Run unit tests (rules engine)

- TypeScript tests:

```powershell
npm run test-core
```

- Deterministic JS harness:

```powershell
node dist-scripts/scripts/test-core.js
```

## 🌐 Multiplayer Server (optional)

The Socket.IO server provides lobby/room management and simple relays.

```powershell
cd server
npm install
node index.js   # starts on http://localhost:3000
```

Point the client SocketAdapter at the server URL (defaults to localhost in development).

## 🃏 Game Rules (high level)

- Rank order: 3 < 4 < … < 10 < J < Q < K < A < 2 < Joker
- Plays: same‑value sets or valid runs
- Runs: ≥3 consecutive ranks with equal multiplicity (e.g., 3‑3,4‑4,5‑5). 10s and Jokers are excluded from runs
- Special clears:
  - 2s clear the pile and current player leads next
  - Four‑of‑a‑kind starts a “higher quads or Joker” challenge
  - Single Joker beats anything visible and typically ends the trick
- 10‑rule: when 10s are played as a set, choose “higher” or “lower” for the next plays; paused during active runs
- Trick lifecycle: players pass or play until all non‑leaders pass; winner leads the next trick

## 🧪 Quality & Tooling

- Pure functions with unit tests for core rules
- Deterministic Node harness for fast iteration
- Defensive guards for edge cases (joker‑on‑joker, run adjacency, etc.)
- Optional assets/deps handled by dynamic `require()` with graceful fallbacks

## 🎨 Design & Audio

- Art Deco theme with gold accents and noir backgrounds
- Background ambience and sfx via `expo-av` (optional; muted/persisted via AsyncStorage when available)

## ⚠️ Known Issues & Limitations

- Sound effects are stubbed (text placeholders in `assets/sounds/`)
- No persistent game state across app restarts
- Server focuses on lobby management; full state sync WIP
- Some advanced rule toggles are experimental

## 🛣 Roadmap

- More end‑to‑end tests and simulation coverage
- Enhanced CPU heuristics for autoplay and analysis
- Polished online flow (reconnects, role reassignment)
- Visual refinements and richer animations

## 📸 Screenshots / Demo

> Drop screenshots or a short GIF here (menu, in‑game, debug viewer).

## 🤝 Contributing

This repository is actively iterated. Issues/PRs are welcome once the project is public.

## 📄 License

This repository is currently private. Placeholder assets © their respective owners. A formal license will be added upon public release.

