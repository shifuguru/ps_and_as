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

assert.deepStrictEqual(
  mergeProfile({ displayTitleTrackId: "lucky" }, { displayTitleTrackId: "president" }),
  { displayTitleTrackId: "president" },
);

assert.deepStrictEqual(
  mergeProfile({ displayTitleTrackId: "lucky" }, { displayTitleTrackId: null }),
  { displayTitleTrackId: null },
);

assert.deepStrictEqual(
  normalizeProfile({ displayTitleTrackId: null }),
  { displayTitleTrackId: null },
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

console.log("test-player-profile-store: all assertions passed");
