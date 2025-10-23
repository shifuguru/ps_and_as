# GameCenter Integration Guide

## Overview
The app uses GameCenter (iOS) for player identification, with graceful fallback to device IDs when GameCenter is unavailable (Android or not signed in).

## How It Works

### Player ID Priority
1. **GameCenter** (iOS, signed in) → Uses `gamePlayerID`
2. **Cached ID** (AsyncStorage) → Persistent across sessions
3. **Generated ID** (fallback) → `device-{timestamp}-{random}`

### Service API

```typescript
import { gameCenterService } from "./src/services/gameCenter";

// Get or create player ID (auto-handles all cases)
const playerInfo = await gameCenterService.getOrCreatePlayerId();
console.log(playerInfo.id);           // Unique player ID
console.log(playerInfo.displayName);  // Player's display name
console.log(playerInfo.isAuthenticated); // GameCenter status
console.log(playerInfo.source);       // "gamecenter" | "fallback"
```

## Setup for GameCenter (iOS)

### 1. Install expo-game-center (Optional)

```bash
npm install expo-game-center
```

The app works without this package - it just falls back to device IDs.

### 2. Configure App for GameCenter

Add to `app.json`:
```json
{
  "expo": {
    "ios": {
      "bundleIdentifier": "com.yourcompany.ps-and-as",
      "infoPlist": {
        "UIRequiresFullScreen": true
      }
    }
  }
}
```

### 3. Enable GameCenter in App Store Connect

1. Go to https://appstoreconnect.apple.com
2. Select your app
3. Go to **Features** → **Game Center**
4. Click **Enable Game Center**

### 4. Test in Development

#### Sandbox Testing:
1. On iOS device, go to **Settings** → **Game Center**
2. Sign out of production Game Center
3. Run your app in development
4. Sign in with Apple sandbox account when prompted

#### Create Sandbox Tester:
1. App Store Connect → **Users and Access** → **Sandbox Testers**
2. Click **+** to add tester
3. Use this account in your test device

## Implementation Details

### Authentication Flow

```typescript
// 1. Check if expo-game-center is installed
try {
  GameCenter = require("expo-game-center");
} catch {
  // Use fallback
}

// 2. Try to authenticate
const isAuth = await GameCenter.isAuthenticatedAsync();
if (!isAuth) {
  await GameCenter.authenticateAsync(); // Shows sign-in UI
}

// 3. Get player info
const player = await GameCenter.getPlayerAsync();
// player.gamePlayerID - Unique stable ID
// player.displayName - Display name
```

### Fallback Strategy

When GameCenter unavailable:
1. Check AsyncStorage for cached ID
2. If found, use it (maintains identity across sessions)
3. If not, generate new ID and cache it

```typescript
const cachedId = await AsyncStorage.getItem("@player_id");
if (!cachedId) {
  const newId = `device-${Date.now()}-${Math.random()}`;
  await AsyncStorage.setItem("@player_id", newId);
}
```

## Usage in App

### Find Game Screen
```typescript
// Automatically gets player ID on mount
useEffect(() => {
  const playerInfo = await getOrCreatePlayerId();
  setPlayerId(playerInfo.id);
  setPlayerName(playerInfo.displayName);
}, []);
```

### Server Integration
Player IDs are sent to server in all room operations:

```typescript
socket.emit("createRoom", { 
  roomId: "demo", 
  name: playerInfo.displayName,
  playerId: playerInfo.id  // Unique ID
});
```

## Testing Without GameCenter

### Method 1: Disable expo-game-center
```bash
npm uninstall expo-game-center
```
App will use device IDs automatically.

### Method 2: Force Fallback
Edit `src/services/gameCenter.ts`:
```typescript
let isAvailable = false; // Force disable
```

### Method 3: Mock IDs for Testing
```typescript
// In your test, override the service
import * as GameCenterService from "./src/services/gameCenter";
jest.spyOn(GameCenterService, 'getOrCreatePlayerId')
  .mockResolvedValue({
    id: "test-player-123",
    displayName: "Test Player",
    isAuthenticated: false,
    source: "fallback"
  });
```

## Debugging GameCenter

### Check Authentication Status
```typescript
import { isPlayerAuthenticated } from "./src/services/gameCenter";

const isAuth = await isPlayerAuthenticated();
console.log("GameCenter authenticated:", isAuth);
```

### Console Logs
GameCenter operations are logged:
```
[GameCenter] Module loaded successfully
[GameCenter] Checking authentication...
[GameCenter] Player authenticated: { id: "...", displayName: "..." }
```

Or:
```
[GameCenter] Not available (expo-game-center not installed)
[GameCenter] Using fallback ID: device-...
```

### Debug Panel
The Network Debug Panel shows player ID in **Connection Status**:
```
playerId: "G:1234567890..."    // GameCenter
playerId: "device-16984..."     // Fallback
```

## Production Considerations

### 1. Privacy Policy
If using GameCenter, disclose in privacy policy:
> "We use GameCenter to identify players in multiplayer games. Your GameCenter display name and player ID are shared with other players in your game."

### 2. Player ID Stability
- **GameCenter IDs**: Stable forever (tied to Apple ID)
- **Device IDs**: Stable until app reinstall or cache clear

### 3. Migration Strategy
If adding GameCenter to existing app with device IDs:
```typescript
// Check if user has old device ID
const oldId = await AsyncStorage.getItem("@player_id");
const gameCenterId = await authenticatePlayer();

if (oldId && gameCenterId.source === "gamecenter") {
  // Migrate progress from oldId to gameCenterId
  await migratePlayerData(oldId, gameCenterId.id);
}
```

### 4. Android Alternative
For parity on Android, consider Google Play Games:
```bash
npm install expo-google-play-games-services
```
Similar API, replace GameCenter checks with platform detection.

## API Reference

### `authenticatePlayer()`
Authenticate with GameCenter or return fallback.

**Returns:** `Promise<PlayerInfo>`

### `isPlayerAuthenticated()`
Check authentication without prompting.

**Returns:** `Promise<boolean>`

### `getOrCreatePlayerId()`
Get stable player ID (GameCenter → cached → new).

**Returns:** `Promise<PlayerInfo>`

### `getCachedPlayerId()`
Get cached ID from AsyncStorage.

**Returns:** `Promise<string | null>`

### `cachePlayerId(id: string)`
Save ID to AsyncStorage.

**Returns:** `Promise<void>`

### PlayerInfo Interface
```typescript
interface PlayerInfo {
  id: string;              // Unique player ID
  displayName: string;     // Display name
  isAuthenticated: boolean; // GameCenter auth status
  source: "gamecenter" | "fallback"; // ID source
}
```

## Troubleshooting

### "GameCenter sign-in cancelled"
User dismissed sign-in prompt. App continues with device ID.

### "GameCenter unavailable in sandbox"
Ensure:
- Using iOS device (not simulator for production GameCenter)
- Signed in to sandbox Game Center account
- App has Game Center entitlement

### "Player ID changes on reinstall"
Expected behavior without GameCenter. Solution:
- Implement server-side account system
- Or require GameCenter authentication

### "Cannot read property 'gamePlayerID'"
GameCenter authenticated but player object missing expected fields.
Use fallback: `player.playerID || generateDeviceId()`

## Further Reading
- [expo-game-center docs](https://docs.expo.dev/versions/latest/sdk/game-center/)
- [Apple GameCenter Programming Guide](https://developer.apple.com/game-center/)
- [AsyncStorage API](https://react-native-async-storage.github.io/async-storage/)
