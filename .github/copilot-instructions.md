# Presidents & Assholes - AI Coding Agent Instructions

## Project Overview
React Native card game implementing "Presidents & Assholes" with both local hotseat and online multiplayer modes. Built with Expo SDK 54, TypeScript, and Socket.IO for networking.

## Architecture

### Game State Management (Pure Functions)
- **Core logic**: `src/game/core.ts` - Pure functions for game state transitions (`createGame`, `playCards`, `passTurn`)
- **Game state is immutable**: Always return new state objects, never mutate existing state
- **Card ranking**: Custom order defined in `RANK_ORDER` array - [3,4,5,6,7,8,9,10,J,Q,K,A,2,Joker]
- **Special rules**: 2s clear the pile, four-of-a-kind clears pile, both give the player another turn

### Network Abstraction Layer
- **Interface**: `src/game/network.ts` defines `NetworkAdapter` interface and `MockAdapter` for local testing
- **Socket.IO adapter**: `src/game/socketAdapter.ts` implements real networking (optional dependency)
- **Pattern**: Adapters use event-driven messaging; components subscribe via `adapter.on("message", callback)`
- **Server**: Node.js Socket.IO server in `server/index.js` handles lobby/room management

### UI Architecture
- **Navigation**: Manual screen state management in `App.tsx` (no React Navigation in active use despite dependencies)
- **Screens**: `menu` → `create` → `game` flow controlled by `screen` state variable
- **State flow**: App.tsx manages top-level screen transitions; GameScreen manages game state internally

## Key Patterns

### Dynamic Imports for Optional Dependencies
Components use try/catch + dynamic require() for optional libraries:
```typescript
// Pattern used in useMenuAudio.ts, socketAdapter.ts
try {
  const Module = require("optional-package");
  // use module
} catch (e) {
  console.warn("Package not available, falling back...");
}
```
This allows the app to run without socket.io-client or expo-av installed.

### Card Selection Logic (GameScreen.tsx)
- **Empty pile**: Select all cards of same rank when tapped
- **Non-empty pile**: Selection count must match pile count (e.g., if pile has 2 cards, select exactly 2 of same rank)
- Selection state stored as array of hand indices, not card objects

### Styling Convention
- **Theme**: `src/styles/theme.ts` exports centralized `styles`, `colors`, `fonts`
- **Art Deco aesthetic**: Gold (#d4af37) accents, dark noir backgrounds, subtle shadows
- **Local styles**: Components define `local` StyleSheet const for component-specific styles

### Audio Management
- **Hook**: `useMenuAudio.ts` manages background ambience and sound effects
- **Persistence**: Mute state persisted via AsyncStorage (optional dependency)
- **Sound files**: Currently `.txt` placeholders in `assets/sounds/` - replace with `.mp3` when available

## Development Workflows

### Running the App
```bash
npm start              # Start Expo dev server
npm run android        # Launch on Android
npm run ios            # Launch on iOS  
npm run web            # Launch in browser
```

### Testing Game Logic
```bash
npm run test-core      # Run unit tests in scripts/test-core.ts
```
Tests validate card validation logic, play rules, and special card behaviors.

### Running Multiplayer Server
```bash
cd server
npm install
node index.js          # Starts Socket.IO server on port 3000
```

### Debugging Patterns
- **Debug Viewer**: GameScreen includes collapsible DebugViewer component (top-right) showing:
  - Trick history with all plays and passes
  - Winner of each completed trick
  - Current round placements (finish order)
  - Player hand sizes and current turn indicator
  - Game state details (pass count, must play, current pile)
- **Game state inspection**: GameScreen displays `state.id` and `finishedOrder` in header
- **Network events**: Adapters log to console; check browser/terminal for connection issues
- **Missing sound**: Sound effects are stubbed out in useMenuAudio (commented block) until real audio files added

## Project-Specific Conventions

### File Organization
- **Parallel structures**: `src/game/` contains TS source; `dist-scripts/src/game/` contains compiled JS for Node.js testing
- **Scripts folder**: Contains test runners and CPU test harnesses (use ts-node)
- **Server is standalone**: Has its own package.json; not part of main Expo project

### Type System
- **Card type**: `{ suit: "hearts" | "diamonds" | "clubs" | "spades" | "joker", value: number }` (2-15)
- **GameState**: Central type exported from core.ts; contains players array, pile, turn tracking
- **NetworkEvent**: Discriminated union for all network messages

### Variable Naming
- `pIndex`: Player index in state.players array
- `idx`/`i`: Generic loop indices
- Avoid abbreviations except for standard React abbreviations (`e` for events, `p` for players in loops)

## Integration Points

### Expo SDK Dependencies
- **expo-av**: Audio playback (optional, gracefully degrades)
- **expo-status-bar**: Status bar styling
- React Native 0.81.5 with new architecture enabled (`newArchEnabled: true` in app.json)

### External Services
- Socket.IO server expected at `http://localhost:3000` (configurable in SocketAdapter constructor)
- No authentication/user management yet - players identified by socket IDs

## Common Tasks

### Adding New Card Rules
1. Update validation logic in `src/game/core.ts` (`isValidPlay` function)
2. Add helper functions below existing ones (e.g., `containsTwo`, `isFourOfAKind`)
3. Update `playCards` function to check for new special cases before normal play logic
4. Add test cases to `scripts/test-core.ts`

### Adding New Screens
1. Create component in `src/screens/`
2. Add screen state option to App.tsx `screen` state type union
3. Add conditional render block in App.tsx after menuVisible check
4. Add button handler in App.tsx or parent screen to transition

### Updating UI Theme
- Modify `src/styles/theme.ts` colors object
- Use existing style definitions where possible; avoid inline styles
- Follow Art Deco aesthetic: gold accents, deep blacks, subtle glows

## Known Issues & Limitations
- Sound effect playback is stubbed (audio files are .txt placeholders)
- No persistent game state (refreshing loses game progress)
- Server doesn't implement game state synchronization yet (only lobby management)
- Ready/unready logic in CreateGame is partially implemented
