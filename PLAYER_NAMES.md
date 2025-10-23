# Player Name Storage Guide

## Overview
Player names are stored persistently using AsyncStorage to maintain identity across app sessions. The system has a priority hierarchy for retrieving player names.

## Storage Strategy

### Priority Hierarchy
1. **GameCenter** (iOS, authenticated) → GameCenter display name
2. **AsyncStorage** (cached) → Previously saved custom name
3. **Default** (fallback) → "Player"

### What Gets Stored

#### AsyncStorage Keys
- `@player_id` - Unique player identifier (GameCenter ID or device-generated)
- `@player_name` - Player's display name (editable by user)

#### Storage Flow
```
App Launch
    ↓
Check GameCenter
    ├─ Authenticated? → Use GameCenter name → Cache to AsyncStorage
    └─ Not authenticated? → Check AsyncStorage cache
                              ├─ Found? → Use cached name
                              └─ Not found? → Use "Player" default
```

## Implementation Details

### GameCenter Service (`src/services/gameCenter.ts`)

#### Core Functions

**`getOrCreatePlayerId()`**
- Main function called on app launch
- Returns both ID and displayName
- Caches both values to AsyncStorage

```typescript
const playerInfo = await getOrCreatePlayerId();
// playerInfo.id: "G:1234567890..." or "device-1234..."
// playerInfo.displayName: "John Doe" or cached name
```

**`cachePlayerName(name: string)`**
- Saves player name to AsyncStorage
- Called when user types name in FindGame or CreateGame
- Persists across app restarts

```typescript
await cachePlayerName("MyCustomName");
```

**`getCachedPlayerName()`**
- Retrieves stored name from AsyncStorage
- Returns `null` if not found

```typescript
const name = await getCachedPlayerName();
// Returns: "MyCustomName" or null
```

### Screen Integration

#### FindGame Screen
```typescript
// Load cached name on mount
useEffect(() => {
  const playerInfo = await getOrCreatePlayerId();
  setPlayerName(playerInfo.displayName); // From cache or GameCenter
}, []);

// Save as user types
<TextInput
  value={playerName}
  onChangeText={(text) => {
    setPlayerName(text);
    if (text.trim()) {
      cachePlayerName(text.trim()); // Auto-save
    }
  }}
/>
```

#### CreateGame Screen
- Same pattern as FindGame
- Name input at top of screen
- Auto-saves on text change
- Used when creating rooms

## User Experience

### First Time User
1. Opens app
2. GameCenter prompt (iOS) or default to "Player"
3. Can edit name in FindGame or CreateGame
4. Name saved immediately
5. Next launch: Name persists

### Returning User
1. Opens app
2. Name loaded from cache or GameCenter
3. Can change name anytime
4. New name saved automatically

### GameCenter User
1. Signs in to GameCenter
2. GameCenter name used automatically
3. Can override with custom name
4. Custom name persists even if GameCenter auth fails later

## Data Persistence

### When Name is Saved
- ✅ When user types in FindGame name field
- ✅ When user types in CreateGame name field
- ✅ When GameCenter authenticates (auto-cached)
- ❌ NOT when joining a room (already saved)
- ❌ NOT during gameplay (name is read-only in game)

### When Name is Retrieved
- ✅ App launch (all screens)
- ✅ FindGame screen mount
- ✅ CreateGame screen mount
- ✅ When creating/joining rooms

## Storage Format

### AsyncStorage Structure
```json
{
  "@player_id": "device-1698424800000-abc123xyz",
  "@player_name": "CoolPlayer99"
}
```

### GameCenter Override
```json
{
  "@player_id": "G:1234567890",
  "@player_name": "John Doe"
}
```

## Edge Cases

### Name Conflicts
- Multiple devices can have same name (server uses socket IDs)
- Display name is for UI only
- Unique player ID used for server logic

### Empty Names
- Text input validates `.trim()`
- Won't save empty strings
- Defaults to cached name or "Player"

### Name Changes Mid-Session
- Name can be changed in CreateGame before room created
- After room created, name is locked for that session
- New name applies to next game/session

### Cache Invalidation
- Cache never expires automatically
- Manual clear: App Settings → Storage → Clear Data
- Uninstalling app clears cache

## Privacy & Security

### What's Stored Locally
- Player ID (not sensitive)
- Display name (user-provided)
- NOT stored: Game history, match data, passwords

### What's Sent to Server
- Display name (visible to other players in room)
- Player ID (for session management)
- Room participation (temporary, not persisted server-side)

### GameCenter Privacy
- GameCenter ID stored only if user authenticates
- No GameCenter data sent to custom server
- GameCenter used only for local identity

## Debugging

### Check Stored Name
```typescript
import { getCachedPlayerName } from "./src/services/gameCenter";

const name = await getCachedPlayerName();
console.log("Stored name:", name);
```

### Clear Stored Name (for testing)
```typescript
import AsyncStorage from "@react-native-async-storage/async-storage";

await AsyncStorage.removeItem("@player_name");
await AsyncStorage.removeItem("@player_id");
```

### View All Storage
```typescript
const keys = await AsyncStorage.getAllKeys();
const values = await AsyncStorage.multiGet(keys);
console.log("AsyncStorage:", values);
```

## Migration from Old Versions

If you had an app version without name caching:

```typescript
// Check if old users have ID but no name
const id = await getCachedPlayerId();
const name = await getCachedPlayerName();

if (id && !name) {
  // Prompt user to set name
  await cachePlayerName("Returning Player");
}
```

## Testing

### Test Name Persistence
1. Open app → Enter name "TestPlayer"
2. Close app completely
3. Reopen app
4. ✅ Name should be "TestPlayer"

### Test GameCenter Priority
1. Sign out of GameCenter
2. Set name to "CustomName"
3. Sign in to GameCenter
4. ✅ GameCenter name overrides custom name
5. Sign out again
6. ✅ GameCenter name persists in cache

### Test Multiple Devices
1. Device A: Name "PlayerA"
2. Device B: Name "PlayerB"
3. Both join same room
4. ✅ Each sees their own name
5. ✅ Server distinguishes by socket ID

## Best Practices

### For Users
- Choose a unique name to avoid confusion
- Name appears to all players in your games
- Can change name anytime between games

### For Developers
- Always validate name input (trim whitespace)
- Save immediately on text change (no explicit "Save" button)
- Show current name in debug panel
- Log name changes for debugging

## API Reference

```typescript
// Get player info (ID + name)
const playerInfo = await getOrCreatePlayerId();
console.log(playerInfo.displayName);

// Cache custom name
await cachePlayerName("NewName");

// Retrieve cached name
const name = await getCachedPlayerName();

// Check if name is from GameCenter
if (playerInfo.source === "gamecenter") {
  console.log("Using GameCenter name");
}
```

## Related Documentation
- `GAMECENTER.md` - GameCenter integration details
- `MULTIPLAYER_SETUP.md` - Network setup
- `DEBUGGING.md` - Debug tools
