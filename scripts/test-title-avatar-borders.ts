import assert from "assert";
import Module from "module";
import type { PlayerStats } from "../src/services/playerStats";
import { TITLE_TRACKS } from "../src/rewards/titleTracks";

const originalLoad = (Module as unknown as { _load: Function })._load;
const stored = new Map<string, string>();
let failWrite = false;
(Module as unknown as { _load: Function })._load = function (
  request: string,
  parent: unknown,
  isMain: boolean,
) {
  if (request === "react-native") return { Platform: { OS: "web" } };
  if (request === "@react-native-async-storage/async-storage") {
    return {
      default: {
        getItem: async (key: string) => stored.get(key) ?? null,
        setItem: async (key: string, value: string) => {
          if (failWrite) throw new Error("storage failure");
          stored.set(key, value);
        },
        removeItem: async (key: string) => { stored.delete(key); },
      },
    };
  }
  return originalLoad.apply(this, [request, parent, isMain]);
};

async function run() {
  const { resolveAvatarBorder, resolveTitleAvatarBorder } = await import(
    "../src/rewards/avatarBorders"
  );
  const empty: PlayerStats = {
    roundsPlayed: 0, timesPresident: 0, timesVicePresident: 0,
    timesViceAsshole: 0, timesAsshole: 0, presidentStreak: 0,
    bestPresidentStreak: 0, xp: 0, tricksWon: 0, gamesWon: 0,
    gamesLost: 0, jokersReceivedInDeal: 0, jokersReceivedInTrade: 0,
    jokersGivenInTrade: 0,
  };
  const expectedKinds: Record<string, string> = {
    lucky: "clover",
    unlucky: "lightning",
    president: "wings",
    asshole: "flames",
    veteran: "laurel",
  };
  assert.strictEqual(resolveAvatarBorder(empty), null);
  for (const track of TITLE_TRACKS) {
    const kinds = new Set<string>();
    const colors = new Set<string>();
    assert.strictEqual(resolveTitleAvatarBorder(empty, track.id), null);
    track.tiers.forEach((tier, index) => {
      const stats = { ...empty };
      if (track.id === "lucky") stats.gamesWon = tier.threshold / 10_000;
      else if (track.id === "unlucky") stats.gamesLost = tier.threshold / 10_000;
      else if (track.counterField) stats[track.counterField] = tier.threshold;
      const border = resolveTitleAvatarBorder(stats, track.id);
      assert.ok(border, `${track.id} tier ${index + 1}`);
      assert.strictEqual(border.kind, expectedKinds[track.id]);
      assert.strictEqual(border.tier, index + 1);
      assert.ok(border.label.includes(tier.title));
      assert.deepStrictEqual(resolveAvatarBorder(stats, track.id), border);
      kinds.add(border.kind);
      colors.add(border.primaryColor);
    });
    assert.strictEqual(kinds.size, 1);
    assert.strictEqual(colors.size, 6, `${track.id} has six distinct tier colors`);
  }
  const legacy = { ...empty, timesPresident: 1 };
  assert.strictEqual(resolveAvatarBorder(legacy)?.id, "president");
  assert.strictEqual(resolveAvatarBorder(legacy, null)?.id, "president");
  assert.strictEqual(resolveAvatarBorder(legacy, "president")?.id, "president");
  assert.strictEqual(resolveAvatarBorder(legacy, "unknown")?.id, "president");
  assert.strictEqual(resolveTitleAvatarBorder(empty, "unknown"), null);

  const { readDisplayTitleTrackId, writeDisplayTitleTrackId, subscribeDisplayTitleTrack } =
    await import("../src/services/titlePreferences");
  let notifications = 0;
  const unsubscribe = subscribeDisplayTitleTrack(() => { notifications += 1; });
  await writeDisplayTitleTrackId("lucky");
  assert.strictEqual(await readDisplayTitleTrackId(), "lucky");
  assert.strictEqual(notifications, 1);
  await writeDisplayTitleTrackId(null);
  assert.strictEqual(await readDisplayTitleTrackId(), null);
  assert.strictEqual(notifications, 2);
  unsubscribe();
  await writeDisplayTitleTrackId("president");
  assert.strictEqual(notifications, 2);
  failWrite = true;
  const originalError = console.error;
  try {
    console.error = () => {};
    await assert.rejects(writeDisplayTitleTrackId("lucky"), /storage failure/);
  } finally {
    console.error = originalError;
  }
  assert.strictEqual(await readDisplayTitleTrackId(), "president");
  console.log("test-title-avatar-borders: ok");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
