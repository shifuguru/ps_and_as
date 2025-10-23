# GameCenter Integration Setup

## Overview
The app now uses `react-native-cross-platform-game-services` to integrate with Apple GameCenter (iOS) and Google Play Games (Android) for player authentication and identity management.

## Current Implementation

### Library Used
- **Package**: `react-native-cross-platform-game-services` (already installed)
- **Platforms**: iOS (GameCenter), Android (Play Games Services)
- **Documentation**: https://github.com/alvinomeara/react-native-cross-platform-game-services

### How It Works
1. **Initial Load**: When CreateGame or FindGame screens mount, they call `getOrCreatePlayerId()`
2. **Authentication**: The service attempts to sign in to GameCenter/Play Games
3. **Player Info**: If successful, retrieves player ID and display name
4. **Fallback**: If authentication fails, uses cached data or generates a device ID
5. **Re-check**: After 2 seconds, attempts authentication again in case it was delayed
6. **Caching**: Player ID and name are cached in AsyncStorage for offline use

### Code Flow
```typescript
// src/services/gameCenter.ts
authenticatePlayer() 
  → GameServices.signIn()
  → GameServices.getCurrentPlayer()
  → Returns { id, displayName, isAuthenticated, source }
```

## iOS GameCenter Setup

### 1. Enable GameCenter in App Capabilities
1. Open Xcode project: `ios/psandas.xcworkspace`
2. Select your app target
3. Go to "Signing & Capabilities" tab
4. Click "+ Capability" and add "Game Center"

### 2. Configure App Store Connect
1. Go to https://appstoreconnect.apple.com
2. Select your app (or create a new app)
3. Go to "Services" → "Game Center"
4. Enable Game Center for your app
5. Configure leaderboards/achievements (optional for this app)

### 3. Update Info.plist (if needed)
Add GameCenter usage description:
```xml
<key>GKGameCenterUsageDescription</key>
<string>Connect with friends and track your game stats</string>
```

### 4. Build and Run on iOS Device
- GameCenter requires a **real iOS device** (doesn't work in simulator)
- Device must be signed in to iCloud/GameCenter in Settings
- First run will prompt user to sign in to GameCenter

## Android Play Games Setup

### 1. Create Play Games Services Project
1. Go to https://play.google.com/console
2. Select your app
3. Go to "Play Games Services" → "Setup and management" → "Configuration"
4. Create credentials and OAuth 2.0 client IDs

### 2. Add Configuration to android/app/src/main/res/values/strings.xml
```xml
<string name="app_id">YOUR_APP_ID</string>
<string name="game_services_project_id">YOUR_PROJECT_ID</string>
```

### 3. Update AndroidManifest.xml
```xml
<meta-data
    android:name="com.google.android.gms.games.APP_ID"
    android:value="@string/app_id" />
```

## Testing

### iOS Simulator
- **Limitation**: GameCenter doesn't work in iOS Simulator
- **Fallback**: App will use device ID and cached names
- **Testing**: Must use real iOS device

### iOS Device Testing
1. Ensure device is signed in to GameCenter (Settings → Game Center)
2. Install app on device: `npm run ios --device`
3. Launch app - should see GameCenter sign-in banner
4. Check console logs for `[GameCenter] Player authenticated:`
5. Player name should auto-populate from GameCenter profile

### Debug Console Logs
The service logs detailed information:
```
[GameCenter] GameServices module loaded successfully
[CreateGame] Initializing player authentication...
[GameCenter] Sign in result: { success: true }
[GameCenter] Current player: { playerId: "...", displayName: "..." }
[CreateGame] Player initialized: { id: "...", displayName: "...", source: "gamecenter" }
```

## Troubleshooting

### "Module not found: react-native-cross-platform-game-services"
- Run: `npm install react-native-cross-platform-game-services`
- Clean: `cd android && ./gradlew clean` (Android) or `cd ios && pod install` (iOS)
- Rebuild app

### Player Name Shows "Player" Instead of GameCenter Name
- Check console logs for authentication errors
- Verify GameCenter is enabled in device settings
- Make sure app has GameCenter capability in Xcode
- Try signing out and back in to GameCenter on device
- Check that App ID matches between Xcode and App Store Connect

### Authentication Takes Too Long
- The app re-checks after 2 seconds if initial auth fails
- GameCenter authentication can be slow on first launch
- User can manually edit name in text field as fallback

### "Sign in not successful"
- GameCenter requires app to be signed with valid provisioning profile
- Check App Store Connect configuration
- Verify bundle ID matches in all configs
- Test account must have GameCenter enabled

## Development vs Production

### Development
- Use Xcode automatic signing
- Test with sandbox GameCenter accounts
- May see more authentication prompts

### Production
- Proper App Store Connect configuration required
- App must be published (TestFlight or App Store)
- Users must have GameCenter account

## Fallback Behavior
If GameCenter fails:
1. Checks AsyncStorage for cached player name
2. Uses cached name if available
3. Generates random device ID as fallback
4. User can manually enter name in text field
5. Manual name is saved to AsyncStorage for future sessions

## API Reference

### Main Functions
```typescript
// Authenticate and get player info
authenticatePlayer(): Promise<PlayerInfo>

// Check if authenticated without prompting
isPlayerAuthenticated(): Promise<boolean>

// Get or create persistent player ID (with GameCenter priority)
getOrCreatePlayerId(): Promise<PlayerInfo>

// Cache management
getCachedPlayerName(): Promise<string | null>
cachePlayerName(name: string): Promise<void>
getCachedPlayerId(): Promise<string | null>
cachePlayerId(id: string): Promise<void>
```

### PlayerInfo Type
```typescript
{
  id: string;              // GameCenter player ID or device ID
  displayName: string;     // Player's display name
  isAuthenticated: boolean; // True if GameCenter authenticated
  source: "gamecenter" | "fallback"; // Where ID came from
}
```

## Next Steps

### For Full GameCenter Integration
1. Add leaderboards for game scores
2. Add achievements for game milestones
3. Add friend invites using GameCenter friends list
4. Add real-time matchmaking using GameCenter APIs

### Current Status
✅ Player authentication
✅ Display name retrieval
✅ Persistent ID management
✅ Fallback to device ID
✅ AsyncStorage caching
⏳ Leaderboards (not implemented)
⏳ Achievements (not implemented)
⏳ Friend invites (not implemented)
