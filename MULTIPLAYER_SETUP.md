# Multiplayer Auto-Search Setup Guide

## Overview
The Presidents & Assholes game now includes an **auto-search feature** that allows players to discover and join nearby games automatically. This feature uses Socket.IO for real-time game discovery and matchmaking.

## Features

### 1. **Find Game Screen**
- Automatically searches for available games every 3 seconds
- Shows real-time player counts and game age
- Clean, Art Deco-themed UI
- Manual refresh button for instant updates

### 2. **Server Discovery**
- Public room broadcasting
- Room capacity tracking (2-8 players)
- Host identification
- Real-time updates when players join/leave

### 3. **Smart Room Management**
- Automatic room cleanup when empty
- Full room detection
- Error handling for connection issues
- Graceful fallback to MockAdapter for testing

## Setup Instructions

### 1. Start the Server
```powershell
cd server
npm install
node index.js
```
The server will start on port 3000.

### 2. Configure Your Network

#### For Local WiFi Testing (2 iPhones):
1. Find your computer's local IP address:
   ```powershell
   ipconfig
   ```
   Look for "IPv4 Address" (e.g., `192.168.88.138`)

2. Update the server URL in `App.tsx` (line ~24):
   ```typescript
   const networkAdapter = useMemo(() => {
     try {
       return new SocketAdapter("http://YOUR_LOCAL_IP:3000", "main", "Host");
     } catch (e) {
       return null;
     }
   }, []);
   ```
   Replace `YOUR_LOCAL_IP` with your actual IP address.

3. Ensure both iPhones are on the same WiFi network as your computer.

### 3. Run the App
```powershell
npm start
```
Scan the QR code with Expo Go on both iPhones.

## Usage Flow

### Creating a Game (Host):
1. Tap **"Create Game"** on main menu
2. The game is automatically created as a public room
3. Wait for other players to join
4. Once all players are ready, tap **"Start Game"**

### Joining a Game (Guest):
1. Tap **"Find Game"** on main menu
2. Enter your player name
3. Wait for available games to appear (auto-refreshes every 3s)
4. Tap **"Join"** on the game you want to join
5. Wait in the lobby until host starts the game

## Technical Details

### Server API
The server exposes these Socket.IO events:

**Client → Server:**
- `discoverRooms` - Request list of available games
- `createRoom` - Create a new public room
- `joinRoom` - Join an existing room
- `leaveRoom` - Leave current room
- `startGame` - Start the game (host only)
- `toggleReady` - Toggle player ready status

**Server → Client:**
- `availableRooms` - List of discoverable games
- `lobbyUpdate` - Player list and ready states
- `startGame` - Game start confirmation
- `connected` - Connection confirmation with player ID
- `error` - Error messages

### Room Structure
```typescript
{
  roomId: string,
  players: [{id, name, socketId, ready}],
  host: string,  // socket ID of host
  hostName: string,
  createdAt: number,
  isPublic: boolean
}
```

### Network Architecture
```
FindGame Screen (Discovery)
    ↓ (creates adapter for specific room)
CreateGame Screen (Lobby)
    ↓ (all players ready)
GameScreen (Gameplay)
```

## Testing Without Real Devices

The `MockAdapter` also supports the discovery feature for local testing:

```typescript
const mockAdapter = new MockAdapter();
mockAdapter.createRoom("test-room", "Host Player");
mockAdapter.discoverRooms();
// Emits availableRooms event with test-room
```

## Troubleshooting

### "No games found nearby"
- Ensure the server is running
- Check that you're on the same WiFi network
- Verify the server URL uses your local IP, not `localhost`
- Try manually refreshing with the 🔄 button

### "Network Unavailable"
- Socket.IO client may not be installed: `npm install socket.io-client`
- Server might be down - restart it
- Firewall might be blocking port 3000

### Connection drops
- Ensure stable WiFi connection
- Server auto-cleans up disconnected players
- Players can rejoin by going back to Find Game

## Future Enhancements
- [ ] Player authentication
- [ ] Private rooms with codes
- [ ] Game invitations
- [ ] Nearby player distance estimation
- [ ] In-game chat
- [ ] Persistent game state sync during gameplay
- [ ] Reconnection support mid-game

## Architecture Notes

See `.github/copilot-instructions.md` for complete architecture documentation.

Key files:
- `server/index.js` - Socket.IO server with discovery
- `src/game/socketAdapter.ts` - Real network implementation
- `src/game/network.ts` - Network abstraction + MockAdapter
- `src/screens/FindGame.tsx` - Discovery UI
- `src/screens/CreateGame.tsx` - Lobby UI
- `App.tsx` - Navigation and adapter management
