/**
 * Cloud profile normalize/merge helpers (server store).
 * Run: node ./scripts/test-player-profile-store.js
 */
const assert = require("assert");
const {
  normalizeProfile,
  mergeProfile,
  mergeStats,
  upsertPlayerStats,
  getPlayerStats,
} = require("../server/playerStatsStore");

// Isolate store file mutations by using a unique id and not relying on disk clean

assert.deepStrictEqual(
  normalizeProfile({
    displayName: "  Casey  ",
    appearance: "dark",
    textContrast: "auto",
    feltTint: "#0F5132",
    junk: true,
  }),
  {
    displayName: "Casey",
    appearance: "dark",
    textContrast: "auto",
    feltTint: "#0f5132",
  },
);

assert.strictEqual(normalizeProfile({ appearance: "neon" }), null);

assert.deepStrictEqual(
  mergeProfile(
    { displayName: "A", appearance: "light" },
    { displayName: "B", feltTint: "#112233" },
  ),
  {
    displayName: "B",
    appearance: "light",
    feltTint: "#112233",
  },
);

const id = `google:test-profile-${Date.now()}`;
const entry = upsertPlayerStats(
  id,
  { roundsPlayed: 3, xp: 120, tricksWon: 1 },
  { displayName: "Host", appearance: "dark", feltTint: "#0f5132" },
);
assert.ok(entry);
assert.strictEqual(entry.stats.xp, 120);
assert.strictEqual(entry.profile.displayName, "Host");

const merged = upsertPlayerStats(
  id,
  { roundsPlayed: 5, xp: 50 },
  { displayName: "Guest", textContrast: "light" },
);
assert.strictEqual(merged.stats.roundsPlayed, 5);
assert.strictEqual(merged.stats.xp, 120, "xp max-merged");
assert.strictEqual(merged.profile.displayName, "Guest");
assert.strictEqual(merged.profile.appearance, "dark");
assert.strictEqual(merged.profile.textContrast, "light");

const loaded = getPlayerStats(id);
assert.strictEqual(loaded.profile.feltTint, "#0f5132");
assert.strictEqual(loaded.stats.tricksWon, 1);

assert.deepStrictEqual(
  mergeStats({ xp: 10 }, { xp: 40, roundsPlayed: 2 }),
  mergeStats({ xp: 40, roundsPlayed: 2 }, { xp: 10 }),
);

// Anti-exploit: syncing must take the higher XP, never total both sides.
const maxed = mergeStats(
  { xp: 1000, roundsPlayed: 20 },
  { xp: 800, roundsPlayed: 15 },
);
assert.strictEqual(maxed.xp, 1000, "must not sum XP on sync");
assert.notStrictEqual(maxed.xp, 1800);

const xpId = `google:xp-max-${Date.now()}`;
upsertPlayerStats(xpId, { xp: 500, roundsPlayed: 5 }, null);
const afterHigher = upsertPlayerStats(xpId, { xp: 900, roundsPlayed: 8 }, null);
assert.strictEqual(afterHigher.stats.xp, 900);
const afterLower = upsertPlayerStats(xpId, { xp: 100, roundsPlayed: 2 }, null);
assert.strictEqual(
  afterLower.stats.xp,
  900,
  "lower XP upload must not reduce or sum career XP",
);
assert.strictEqual(afterLower.stats.roundsPlayed, 8);

console.log("test-player-profile-store: all assertions passed");
