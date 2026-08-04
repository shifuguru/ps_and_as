/**
 * Analytics store unit checks.
 * Run: node ./scripts/test-analytics-store.js
 */
const assert = require("assert");
const analytics = require("../server/analyticsStore");

analytics._resetForTests();

assert.strictEqual(analytics.isAllowedEvent("hub_viewed", "client"), true);
assert.strictEqual(analytics.isAllowedEvent("match_started", "client"), false);
assert.strictEqual(analytics.isAllowedEvent("match_started", "server"), true);
assert.strictEqual(analytics.isAllowedEvent("player_left_in_game", "server"), true);
assert.strictEqual(analytics.isAllowedEvent("evil_event", "server"), false);

assert.deepStrictEqual(
  analytics.sanitizeProps({
    kind: "standard",
    public: true,
    seats: 4,
    name: "ShouldNotMatterButOk",
    nested: { x: 1 },
    "bad key": 1,
  }),
  {
    kind: "standard",
    public: true,
    seats: 4,
    name: "ShouldNotMatterButOk",
  },
);

const fixed = new Date("2026-08-04T12:00:00.000Z");
assert.ok(analytics.track("hub_viewed", {}, { source: "client", at: fixed }));
assert.ok(
  analytics.track("match_started", { kind: "standard", public: false }, { at: fixed }),
);
assert.ok(
  analytics.track(
    "match_aborted",
    { kind: "standard", reason: "grace_expired" },
    { at: fixed },
  ),
);
assert.strictEqual(
  analytics.track("match_started", {}, { source: "client", at: fixed }),
  false,
  "clients cannot emit server events",
);

const summary = analytics.getSummary({ days: 7 });
assert.strictEqual(summary.today, "2026-08-04");
assert.strictEqual(summary.todayCounts.hub_viewed, 1);
assert.strictEqual(summary.todayCounts.match_started, 1);
assert.strictEqual(summary.todayCounts.match_aborted, 1);
assert.ok(summary.recent.length >= 3);
assert.strictEqual(summary.recent[0].name, "match_aborted");

analytics._resetForTests();
const empty = analytics.getSummary();
assert.deepStrictEqual(empty.todayCounts, {});
assert.deepStrictEqual(empty.recent, []);

console.log("test-analytics-store: all assertions passed");
