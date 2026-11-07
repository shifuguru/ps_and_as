/**
 * First-launch display-name setup — unit coverage.
 * Run: npx tsx ./scripts/test-player-display-name.ts
 */
import assert from "assert";
import Module from "module";

type Store = Map<string, string>;

const memory: Store = new Map();
let failInstallIdRead = false;

const asyncStorageMock = {
  async getItem(key: string) {
    if (failInstallIdRead && key === "@player_install_id") {
      throw new Error("install ID read failed");
    }
    return memory.has(key) ? memory.get(key)! : null;
  },
  async setItem(key: string, value: string) {
    memory.set(key, value);
  },
  async removeItem(key: string) {
    memory.delete(key);
  },
  async clear() {
    memory.clear();
  },
};

const originalLoad = (Module as unknown as { _load: Function })._load;
(Module as unknown as { _load: Function })._load = function (
  request: string,
  parent: unknown,
  isMain: boolean,
) {
  if (request === "@react-native-async-storage/async-storage") {
    return { default: asyncStorageMock, ...asyncStorageMock };
  }
  if (request === "react-native") {
    return { Platform: { OS: "web", select: (x: Record<string, unknown>) => x.web } };
  }
  if (request === "expo-application") {
    return {
      getIosIdForVendorAsync: async () => null,
      androidId: null,
    };
  }
  if (request === "expo-game-center") {
    throw new Error("expo-game-center unavailable in tests");
  }
  if (request === "../services/wallpaper" || request.endsWith("/services/wallpaper")) {
    return { DEFAULT_FELT_COLOR: "#0f5132" };
  }
  return originalLoad.apply(this, [request, parent, isMain]);
};

async function run() {
  const {
    IMPLICIT_PLAYER_NAME_FALLBACK,
    PLAYER_NAME_CHOSEN_KEY,
    getDisplayNameChosen,
    markDisplayNameChosen,
    needsDisplayNameSetup,
    resolveDisplayNameSetupState,
    saveChosenDisplayName,
  } = await import("../src/services/playerDisplayName");
  const { getCachedPlayerName, cachePlayerName, getOrCreatePlayerId } = await import(
    "../src/services/gameCenter"
  );
  const { makeTemporaryPlayerName } = await import("../src/services/playerDisplayName");
  const { validateDisplayText } = await import("../src/utils/profanityFilter");
  const { createGameFromLobby } = await import("../src/game/core");
  const { saveLobbySession, getLobbySession, updateLobbySessionPlayerName } = await import("../src/services/lobbySession");
  (globalThis as { __DEV__?: boolean }).__DEV__ = false;
  const { SocketAdapter } = await import("../src/game/socketAdapter");
  const { parseOnlinePresencePayload, withLocalPresenceFallback } = await import(
    "../src/services/onlinePresence"
  );

  function resetStore() {
    memory.clear();
  }

  // 1. Fresh install → setup required
  assert.strictEqual(
    needsDisplayNameSetup({ cachedName: null, nameChosen: false }),
    true,
    "fresh install needs setup",
  );

  // 2. Chosen name → setup skipped
  assert.strictEqual(
    needsDisplayNameSetup({ cachedName: "Casey", nameChosen: true }),
    false,
    "chosen name skips setup",
  );

  // 3. Existing implicit "Player" → setup required
  assert.strictEqual(
    needsDisplayNameSetup({
      cachedName: IMPLICIT_PLAYER_NAME_FALLBACK,
      nameChosen: false,
    }),
    true,
    "legacy implicit Player needs setup",
  );

  // 4. Explicitly chosen "Player" → setup skipped
  assert.strictEqual(
    needsDisplayNameSetup({
      cachedName: IMPLICIT_PLAYER_NAME_FALLBACK,
      nameChosen: true,
    }),
    false,
    "explicit Player is a valid chosen name",
  );

  // Existing meaningful name without flag → skip (migration candidate)
  assert.strictEqual(
    needsDisplayNameSetup({ cachedName: "Alex", nameChosen: false }),
    false,
    "meaningful legacy name does not require setup UI",
  );

  // 5–7. Validation via saveChosenDisplayName
  resetStore();
  await assert.rejects(
    () => saveChosenDisplayName("   "),
    /cannot be empty/i,
    "empty name rejected",
  );
  await assert.rejects(
    () => saveChosenDisplayName("fuck"),
    /isn't allowed/i,
    "profane name rejected",
  );

  // 8. Successful setup persists name + chosen state
  const saved = await saveChosenDisplayName("  SmokeAlice  ");
  assert.strictEqual(saved, "SmokeAlice");
  assert.strictEqual(await getCachedPlayerName(), "SmokeAlice");
  assert.strictEqual(await getDisplayNameChosen(), true);
  assert.strictEqual(
    needsDisplayNameSetup({
      cachedName: await getCachedPlayerName(),
      nameChosen: await getDisplayNameChosen(),
    }),
    false,
  );

  // Explicit "Player" as a chosen name
  resetStore();
  const explicitPlayer = await saveChosenDisplayName("Player");
  assert.strictEqual(explicitPlayer, "Player");
  assert.strictEqual(await getDisplayNameChosen(), true);
  assert.strictEqual(
    needsDisplayNameSetup({
      cachedName: "Player",
      nameChosen: true,
    }),
    false,
  );

  // 9. Settings-style rename keeps chosen state valid
  await cachePlayerName("Renamed");
  await markDisplayNameChosen();
  assert.strictEqual(await getCachedPlayerName(), "Renamed");
  assert.strictEqual(await getDisplayNameChosen(), true);
  assert.strictEqual(
    needsDisplayNameSetup({
      cachedName: "Renamed",
      nameChosen: true,
    }),
    false,
    "settings rename keeps setup skipped",
  );

  // Migration: meaningful cached name without flag → resolve marks chosen
  resetStore();
  await asyncStorageMock.setItem("@player_name", "LegacyPat");
  await asyncStorageMock.setItem("@player_install_id", "install-test-1");
  const migrated = await resolveDisplayNameSetupState();
  assert.strictEqual(migrated.needsSetup, false);
  assert.strictEqual(migrated.displayName, "LegacyPat");
  assert.strictEqual(await getDisplayNameChosen(), true);
  assert.strictEqual(memory.get(PLAYER_NAME_CHOSEN_KEY), "1");

  // Legacy implicit Player without flag → setup still required
  resetStore();
  await asyncStorageMock.setItem("@player_name", "Player");
  await asyncStorageMock.setItem("@player_install_id", "install-test-2");
  const legacy = await resolveDisplayNameSetupState();
  assert.strictEqual(legacy.needsSetup, true);
  assert.strictEqual(legacy.displayName, null);
  assert.strictEqual(await getDisplayNameChosen(), false);

  // Fresh resolve
  resetStore();
  await asyncStorageMock.setItem("@player_install_id", "install-test-3");
  const fresh = await resolveDisplayNameSetupState();
  assert.strictEqual(fresh.needsSetup, true);
  assert.strictEqual(fresh.displayName, null);

  // Concurrent boot consumers share one install ID, and the same profile
  // is restored on a subsequent load without marking the name as chosen.
  resetStore();
  const concurrent = await Promise.all(
    Array.from({ length: 10 }, () => getOrCreatePlayerId()),
  );
  const profile = concurrent[0];
  assert.ok(concurrent.every((item) => item.id === profile.id));
  assert.ok(concurrent.every((item) => item.displayName === profile.displayName));
  assert.strictEqual(profile.displayName, makeTemporaryPlayerName(profile.installId));
  assert.strictEqual(memory.get("@player_install_id"), profile.installId);
  assert.strictEqual(await getCachedPlayerName(), null);
  assert.strictEqual(await getDisplayNameChosen(), false);
  assert.deepStrictEqual(await getOrCreatePlayerId(), profile);
  failInstallIdRead = true;
  await assert.rejects(() => getOrCreatePlayerId(), /install ID read failed/);
  failInstallIdRead = false;
  assert.deepStrictEqual(await getOrCreatePlayerId(), profile);

  // A legacy implicit fallback gets a temporary name; an explicitly chosen
  // "Player" and existing meaningful or linked names are never replaced.
  await asyncStorageMock.setItem("@player_name", "Player");
  assert.strictEqual((await getOrCreatePlayerId()).displayName, profile.displayName);
  await markDisplayNameChosen();
  assert.strictEqual((await getOrCreatePlayerId()).displayName, "Player");
  await saveChosenDisplayName("Casey");
  await asyncStorageMock.setItem("@player_linked_gc_id", "google:account");
  const linked = await getOrCreatePlayerId();
  assert.strictEqual(linked.id, "google:account");
  assert.strictEqual(linked.displayName, "Casey");

  // Names remain valid under the same filter used by online play.
  assert.strictEqual(validateDisplayText(makeTemporaryPlayerName("install-f4g"), "Player name").ok, true);
  for (let i = 0; i < 10000; i++) {
    assert.strictEqual(validateDisplayText(makeTemporaryPlayerName(`install-${i.toString(36)}`)).ok, true);
  }

  // The profile identity used by practice and lobby snapshots also survives
  // a saved lobby round trip, including its reconnect secret.
  resetStore();
  await asyncStorageMock.setItem("@player_install_id", "install-test-a3f9");
  const player = await getOrCreatePlayerId();
  const game = createGameFromLobby([
    { id: player.id, name: player.displayName },
    { id: "cpu-1", name: "CPU" },
  ]);
  assert.strictEqual(game.players[0].id, player.id);
  assert.strictEqual(game.players[0].name, player.displayName);
  await saveLobbySession({
    roomId: "ABCD",
    profileId: player.id,
    playerName: player.displayName,
    isHost: true,
    reconnectSecret: "test-secret",
  });
  const session = await getLobbySession();
  assert.strictEqual(session?.profileId, player.id);
  assert.strictEqual(session?.playerName, player.displayName);
  assert.strictEqual(session?.reconnectSecret, "test-secret");
  assert.strictEqual((await getOrCreatePlayerId()).displayName, session?.playerName);
  const emissions: { event: string; payload: Record<string, unknown> }[] = [];
  const socket = {
    connected: true,
    emit(event: string, payload: Record<string, unknown>) {
      emissions.push({ event, payload });
    },
  };
  const adapter = new SocketAdapter(undefined, "", player.displayName, player.id, false);
  adapter["socket"] = socket;
  adapter.createRoom("ABCD", player.displayName, "Test table");
  adapter["emitRegisterPresence"]();
  assert.strictEqual(emissions[0].event, "createRoom");
  assert.strictEqual(emissions[0].payload.name, player.displayName);
  assert.strictEqual(emissions[0].payload.profileId, player.id);
  assert.strictEqual(emissions[1].event, "registerPresence");
  assert.strictEqual(emissions[1].payload.displayName, player.displayName);
  adapter["profileId"] = "server-seat-id";
  assert.strictEqual(adapter.getPreferredProfileId(), player.id);
  adapter["reconnectSecret"] = "test-secret";
  await adapter["rejoinActiveRoom"]();
  assert.strictEqual(emissions[2].event, "joinRoom");
  assert.strictEqual(emissions[2].payload.name, player.displayName);
  assert.strictEqual(emissions[2].payload.profileId, "server-seat-id");
  assert.strictEqual(emissions[2].payload.reconnectSecret, "test-secret");
  adapter.updatePlayerName("ABCD", "Renamed");
  await adapter["rejoinActiveRoom"]();
  assert.strictEqual(emissions[3].payload.name, "Renamed");
  assert.strictEqual(emissions[4].payload.name, "Renamed");
  assert.strictEqual(await updateLobbySessionPlayerName("OTHER", "Renamed"), null);
  const updatedSession = await updateLobbySessionPlayerName("ABCD", "Renamed");
  assert.strictEqual(updatedSession?.playerName, "Renamed");
  assert.strictEqual(updatedSession?.profileId, player.id);
  assert.strictEqual(updatedSession?.reconnectSecret, "test-secret");
  assert.strictEqual(updatedSession?.savedAt, session?.savedAt);

  // 10. Chosen name reaches online presence fallback path
  const presence = withLocalPresenceFallback(
    parseOnlinePresencePayload({ activePlayers: 1 })!,
    "SmokeAlice",
  );
  assert.deepStrictEqual(presence.players, [{ id: "local", displayName: "SmokeAlice" }]);

  const presenceFromServer = withLocalPresenceFallback(
    parseOnlinePresencePayload({
      activePlayers: 1,
      players: [{ displayName: "SmokeAlice" }],
    })!,
    "Ignored",
  );
  assert.deepStrictEqual(presenceFromServer.players, [
    { id: "name:smokealice", displayName: "SmokeAlice" },
  ]);

  console.log("test-player-display-name: ok");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
