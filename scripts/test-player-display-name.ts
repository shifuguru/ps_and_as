/**
 * First-launch display-name setup — unit coverage.
 * Run: npx tsx ./scripts/test-player-display-name.ts
 */
import assert from "assert";
import Module from "module";

type Store = Map<string, string>;

const memory: Store = new Map();

const asyncStorageMock = {
  async getItem(key: string) {
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
  const { getCachedPlayerName, cachePlayerName } = await import(
    "../src/services/gameCenter"
  );
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

  // 10. Chosen name reaches online presence fallback path
  const presence = withLocalPresenceFallback(
    parseOnlinePresencePayload({ activePlayers: 1 })!,
    "SmokeAlice",
  );
  assert.deepStrictEqual(presence.players, [{ displayName: "SmokeAlice" }]);

  const presenceFromServer = withLocalPresenceFallback(
    parseOnlinePresencePayload({
      activePlayers: 1,
      players: [{ displayName: "SmokeAlice" }],
    })!,
    "Ignored",
  );
  assert.deepStrictEqual(presenceFromServer.players, [
    { displayName: "SmokeAlice" },
  ]);

  console.log("test-player-display-name: ok");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
