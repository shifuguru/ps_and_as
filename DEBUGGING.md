# Network Debugging Guide

## Overview
This guide helps you debug multiplayer networking issues in Presidents & Assholes using the built-in debug tools.

## Debug Panel

### Accessing the Debug Panel
Both **Find Game** and **Create Game** screens now have a debug panel:

1. Look for the **🔍 Debug** button in the top-right corner
2. Tap to expand the debug panel
3. View real-time connection info, room data, and error messages
4. Tap **✕** to collapse

### Debug Info Sections

#### Find Game Screen
- **Connection Status**
  - `status`: disconnected | connecting | connected
  - `playerId`: Your unique GameCenter or device ID
  - `adapterType`: SocketAdapter or MockAdapter
  
- **Discovery Info**
  - `roomsFound`: Number of available games
  - `isSearching`: Whether actively searching
  - `discoveryCount`: Total discovery requests made
  - `lastDiscovery`: Timestamp of last successful discovery

- **Available Rooms**
  - List of all discoverable games with host names and player counts

- **Error**
  - Last error message received

#### Create Game Screen
- **Connection Status**
  - `status`: disconnected | connecting | connected
  - `playerId`: Your GameCenter/device ID
  - `localId`: Socket ID assigned by server
  - `hostId`: Socket ID of game host
  - `isHost`: Whether you are the host
  - `roomCreated`: Whether room was successfully created

- **Lobby Info**
  - `playerCount`: Number of players in lobby
  - `players`: Array of player names
  - `localReady`: Your ready status

## Console Logging

All network operations are logged to the console with tagged prefixes:

```
[App] - App.tsx events
[FindGame] - Find Game screen events
[CreateGame] - Create Game screen events
[SocketAdapter] - Socket.IO adapter events
[GameCenter] - Player authentication events
```

### Viewing Console Logs

#### In Expo Dev Tools:
1. Start app: `npm start`
2. Look for logs in the terminal
3. Or open browser console at `http://localhost:8081/debugger-ui`

#### On Device (with React Native Debugger):
1. Shake device
2. Select "Debug"
3. View Chrome DevTools console

## Common Issues & Solutions

### Issue: "No games found nearby"

**Debug Steps:**
1. Open debug panel in Find Game
2. Check **Connection Status** → `status`
   - If `disconnected`: Server not reachable
   - If `connecting`: Still attempting connection
   - If `connected`: Successfully connected

3. Check **Discovery Info** → `discoveryCount`
   - If `0`: Discovery requests not being sent
   - If increasing: Requests are working

4. Check console for:
   ```
   [SocketAdapter] Connecting to: http://...
   [SocketAdapter] Connected! Socket ID: ...
   [SocketAdapter] Emitting discoverRooms...
   [SocketAdapter] Received availableRooms: [...]
   ```

**Solutions:**
- **Server not running**: Start server with `cd server && node index.js`
- **Wrong IP address**: Update IP in `App.tsx` line ~24
- **Firewall blocking**: Allow port 3000 in firewall
- **Network mismatch**: Ensure device and server on same WiFi

### Issue: Created game not appearing in Find Game

**Debug Steps:**
1. Create a game on Device A
2. Check debug panel:
   - `roomCreated`: should be `true`
   - `connectionStatus`: should be `"connected"`
   - `localId`: should have a value

3. On Device B, open Find Game
4. Check console on Device B:
   ```
   [FindGame] Available rooms: [...]
   ```

5. Check server console:
   ```
   conn <socket-id>
   createRoom event received
   ```

**Solutions:**
- **Room not public**: Ensure `isPublic: true` in createRoom call (default)
- **Server not broadcasting**: Restart server
- **Multiple server instances**: Kill old server processes
- **Adapter mismatch**: Ensure both devices use SocketAdapter, not MockAdapter

### Issue: "Connection failed" error

**Debug Steps:**
1. Check debug panel → Connection Status
2. Look for console error:
   ```
   [SocketAdapter] Connection error: ...
   ```

**Solutions:**
- **Server offline**: Verify server running with `netstat -an | findstr :3000`
- **CORS issue**: Server allows `origin: '*'` (already configured)
- **Timeout**: Increase connection timeout in SocketAdapter
- **SSL issue**: Use `http://` not `https://` for local connections

### Issue: GameCenter authentication failing

**Debug Steps:**
1. Check console:
   ```
   [GameCenter] Module loaded successfully
   [GameCenter] Player authenticated: {...}
   ```
   OR
   ```
   [GameCenter] Not available (expo-game-center not installed)
   [GameCenter] Using fallback ID: device-...
   ```

**Solutions:**
- **iOS only**: GameCenter only works on iOS, Android uses fallback
- **Not signed in**: Sign in to GameCenter in iOS Settings
- **Sandbox mode**: Use sandbox GameCenter account for development
- **Fallback is OK**: App works fine without GameCenter using device IDs

## Testing Checklist

### Local Network Test (2 Devices)
- [ ] Server running: `cd server && node index.js`
- [ ] Correct IP in App.tsx: `http://YOUR_IP:3000`
- [ ] Both devices on same WiFi
- [ ] Device A: Create Game → Debug shows "connected"
- [ ] Device B: Find Game → See Device A's game in list
- [ ] Device B: Join game → Both appear in Create Game lobby
- [ ] Device A: Start game → Game begins on both devices

### Debug Panel Test
- [ ] Debug button visible in top-right
- [ ] Panel expands when tapped
- [ ] Connection status updates in real-time
- [ ] Room count updates automatically
- [ ] Error messages appear when issues occur
- [ ] Panel can be collapsed

### Console Logging Test
- [ ] See `[FindGame]` logs when searching
- [ ] See `[CreateGame]` logs when creating
- [ ] See `[SocketAdapter]` logs for socket events
- [ ] See `[GameCenter]` logs on app launch
- [ ] Errors logged with full stack traces

## Advanced Debugging

### Manual Room Discovery
In Find Game screen, tap the **🔄 Refresh** button to manually trigger room discovery.

### Server-Side Debugging
In `server/index.js`, all socket events are logged:
```javascript
console.log('conn', socket.id);        // New connection
console.log('createRoom', roomId);     // Room created
console.log('joinRoom', roomId);       // Player joined
console.log('discoverRooms');          // Discovery requested
```

### Network Inspection
Use Reactotron or Flipper to inspect Socket.IO events:
1. Install Reactotron: `npm install --save-dev reactotron-react-native`
2. Add to socketAdapter.ts:
   ```typescript
   Reactotron.log('Socket Event', eventName, data);
   ```

### Mock Adapter Testing
To test without a server:
1. In `App.tsx`, replace SocketAdapter with MockAdapter
2. Create multiple MockAdapter instances for different "players"
3. Use `discoverRooms()` to see mock rooms

```typescript
const mockAdapter = new MockAdapter();
mockAdapter.createRoom("test-1", "Host Player");
mockAdapter.discoverRooms();
// Check console for availableRooms event
```

## Performance Monitoring

### Discovery Refresh Rate
Default: Every 3 seconds

To change, edit `FindGame.tsx`:
```typescript
const interval = setInterval(() => {
  // ...
}, 3000); // Change this value (milliseconds)
```

### Connection Timeout
Socket.IO default: 20 seconds

To change, edit `socketAdapter.ts`:
```typescript
this.socket = socketIo(this.url, {
  timeout: 10000 // 10 seconds
});
```

## Troubleshooting Flowchart

```
No games found?
  ├─ Server running? 
  │   ├─ No → Start server
  │   └─ Yes → Continue
  ├─ Connected? (Check debug panel)
  │   ├─ No → Check IP address, firewall
  │   └─ Yes → Continue
  ├─ Discovery count increasing?
  │   ├─ No → Check discoverRooms() implementation
  │   └─ Yes → Continue
  └─ Any games actually created?
      ├─ No → Create a game first!
      └─ Yes → Check server logs for broadcast
```

## Getting Help

When reporting issues, include:
1. Screenshot of debug panel
2. Console logs (last 50 lines)
3. Server console output
4. Device OS and network type
5. App version / commit hash

Example report:
```
Issue: No games appearing in Find Game

Debug Panel:
- Connection: connected
- Discovery count: 12
- Rooms found: 0

Console:
[SocketAdapter] Connected! Socket ID: abc123
[FindGame] Available rooms: []

Server:
conn abc123
discoverRooms received
Sending 0 rooms

Device: iPhone 13, iOS 17, WiFi
```

## Resources

- Socket.IO docs: https://socket.io/docs/v4/
- Expo networking: https://docs.expo.dev/guides/networking/
- React Native debugging: https://reactnative.dev/docs/debugging
