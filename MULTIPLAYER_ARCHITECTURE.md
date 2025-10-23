# Multiplayer Architecture

## Overview
The Presidents & Assholes multiplayer system uses a **hybrid architecture** where the server manages connections, synchronization, and disconnection handling, while game logic runs on all clients in parallel with server-side validation.

## Architecture Components

### Server (server/index.js)
The Socket.IO server is the **source of truth** for:
- Room membership and player lists
- Connection states (connected/disconnected)
- Host identity and host migration
- Game action broadcasting and synchronization

### Client (SocketAdapter + GameScreen)
Each client:
- Runs the full game logic locally for immediate feedback
- Sends all game actions to the server for validation and broadcast
- Receives and applies actions from other players via server
- Maintains synchronized game state across all players

## Key Features

### 1. Host Migration
When the host disconnects:
- Server immediately assigns a new host (first available connected player)
- All players are notified via `hostMigrated` event
- New host gains control to start/manage game
- Original host can reconnect and rejoin (but may not regain host status)

**Implementation:**
```javascript
// Server automatically calls migrateHost() when host disconnects
function migrateHost(roomId) {
  const newHost = room.players.find(p => p.socketId && !p.disconnectedAt);
  room.host = newHost.socketId;
  io.to(roomId).emit('hostMigrated', { newHost, newHostName });
}
```

### 2. Disconnection Grace Period
Players who disconnect during an active game get **60 seconds** to reconnect:

- **During Grace Period:**
  - Player marked as `disconnected` but stays in game
  - Other players see "disconnected" indicator
  - Player's hand and position preserved
  - Game can continue (CPU can play for them, or turns are skipped)

- **After Grace Period:**
  - Player removed from game permanently
  - Other players notified via `playerRemoved` event
  - Game continues with remaining players

- **On Reconnection:**
  - Player's socket ID updated
  - `disconnectedAt` cleared
  - Current game state synced to reconnected player
  - Other players notified player is back

**Implementation:**
```javascript
// Server marks player as disconnected
player.disconnectedAt = Date.now();
io.to(roomId).emit('playerDisconnected', { playerId, playerName, gracePeriod: 60000 });

// After 60 seconds, remove if still disconnected
schedulePlayerRemoval(roomId, playerId, socketId);

// On reconnection before grace period expires
existingPlayer.disconnectedAt = null;
socket.emit('gameStateSync', { gameState: room.gameState });
```

### 3. Game Action Synchronization
All game actions flow through the server:

**Action Flow:**
1. Player makes move on their client (play cards/pass)
2. Client applies move locally for immediate feedback
3. Client sends action to server via `sendGameAction()`
4. Server validates player identity
5. Server broadcasts action to ALL players (including sender)
6. All clients apply the action to stay synchronized

**Benefits:**
- Prevents cheating (server validates all actions)
- Ensures all players see same game state
- Allows reconnected players to catch up
- Enables spectator mode (future feature)

**Client Code:**
```typescript
// Send action to server
adapter.sendGameAction(roomId, {
  type: 'play',
  cards: selectedCards,
  playerId: humanPlayer.id
});

// Receive and apply actions from server
adapter.on('message', (ev) => {
  if (ev.type === 'state' && ev.state.type === 'gameAction') {
    // Apply action from ANY player (including self)
    const nextState = playCards(state, ev.state.action.playerId, ev.state.action.cards);
    setState(nextState);
  }
});
```

### 4. Room State Management

**Room States:**
- **Lobby (`inGame: false`)**: Players joining, not yet started
  - Disconnected players removed immediately
  - No grace period
  - Host can kick players
  
- **In-Game (`inGame: true`)**: Game actively running
  - Disconnected players get 60s grace period
  - Host migration occurs immediately on disconnect
  - Game state tracked server-side

**Room Data Structure:**
```javascript
{
  players: [
    { 
      id: "socket-id",
      name: "Player 1", 
      socketId: "socket-id",
      ready: false,
      disconnectedAt: null // or timestamp
    }
  ],
  host: "socket-id",
  hostName: "Player 1",
  roomName: "My Game",
  gameState: { /* server-tracked state */ },
  inGame: false,
  isPublic: true
}
```

## Event Reference

### Server → Client Events

| Event | Data | Description |
|-------|------|-------------|
| `lobbyUpdate` | `{ players, host }` | Player list and host changed |
| `hostMigrated` | `{ newHost, newHostName }` | New host assigned |
| `playerDisconnected` | `{ playerId, playerName, gracePeriod }` | Player lost connection |
| `playerRemoved` | `{ playerId, playerName, reason }` | Player removed from game |
| `gameAction` | `{ playerId, playerName, action }` | Game move from any player |
| `gameStateSync` | `{ gameState }` | Full state sync on reconnect |
| `startGame` | `{ players }` | Game started by host |
| `kicked` | `{ message }` | You were kicked by host |

### Client → Server Events

| Event | Data | Description |
|-------|------|-------------|
| `createRoom` | `{ roomId, name, isPublic, roomName }` | Create new room |
| `joinRoom` | `{ roomId, name }` | Join existing room |
| `leaveRoom` | `{ roomId }` | Leave room |
| `startGame` | `{ roomId }` | Start game (host only) |
| `gameAction` | `{ roomId, action }` | Send game move |
| `requestGameState` | `{ roomId }` | Request state sync |
| `toggleReady` | `{ roomId, ready }` | Toggle ready status |
| `kickPlayer` | `{ roomId, playerName }` | Kick player (host only) |

## Client Integration

### GameScreen Changes Needed

To fully integrate the new multiplayer system, GameScreen.tsx needs:

1. **Listen for host migration:**
```typescript
if (ev.state.type === "hostMigrated") {
  setHostId(ev.state.newHost);
  // Update UI to show new host
}
```

2. **Handle player disconnections:**
```typescript
if (ev.state.type === "playerDisconnected") {
  // Show "Player X disconnected (60s to reconnect)" message
  // Gray out player or show reconnecting indicator
}
```

3. **Handle player removals:**
```typescript
if (ev.state.type === "playerRemoved") {
  // Remove player from game
  // Adjust turn order if needed
}
```

4. **Send all game actions through server:**
```typescript
// Instead of:
setState(playCards(state, playerId, cards));

// Do:
adapter.sendGameAction(roomId, {
  type: 'play',
  playerId,
  cards
});

// Then apply when server broadcasts back
```

5. **Sync state on reconnect:**
```typescript
if (ev.state.type === "gameStateSync") {
  setState(ev.state.gameState);
  // Restore UI to match synced state
}
```

## Testing Scenarios

### Scenario 1: Host Disconnects Mid-Game
1. Start game with 3 players (Host, Player 2, Player 3)
2. Host closes app/loses connection
3. **Expected:** Player 2 becomes host immediately, gets 60s to reconnect
4. Host reconnects within 60s
5. **Expected:** Host rejoins as regular player, Player 2 stays host

### Scenario 2: Non-Host Disconnects
1. Start game with 3 players
2. Player 2 disconnects
3. **Expected:** "Player 2 disconnected" message, gray out player, game continues
4. Player 2 reconnects within 30s
5. **Expected:** Player 2 rejoins, game state synced, continues normally

### Scenario 3: Grace Period Expires
1. Start game with 3 players
2. Player 2 disconnects
3. Wait 60 seconds
4. **Expected:** "Player 2 removed from game" message, game continues with 2 players
5. Player 2 tries to reconnect
6. **Expected:** Cannot rejoin (room full or game ended)

### Scenario 4: Multiple Disconnects
1. Start game with 4 players
2. Two players disconnect simultaneously
3. **Expected:** Both get grace periods, both shown as disconnected
4. One reconnects, one doesn't
5. **Expected:** Reconnected player syncs and continues, other removed after 60s

## Future Enhancements

- **Pause on Disconnect**: Optional setting to pause game when host disconnects
- **Vote to Kick**: Players vote to remove AFK player before grace period
- **Spectator Mode**: Allow disconnected players to watch as observers
- **Replay/Resume**: Save game state to resume after all players disconnect
- **Turn Timeout**: Automatically pass turn if player doesn't act within time limit
