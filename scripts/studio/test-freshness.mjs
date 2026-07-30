#!/usr/bin/env node
/**
 * Sanity checks for Mission Control freshness thresholds.
 *
 *   node ./scripts/studio/test-freshness.mjs
 */
import assert from "assert";
import {
  assessFreshness,
  buildFreshnessSnapshot,
  FRESHNESS_THRESHOLDS,
  formatRelativeAge,
} from "../../src/studio/freshness.ts";

const now = Date.now;

function isoHoursAgo(hours) {
  return new Date(now() - hours * 3_600_000).toISOString();
}

function isoDaysAgo(days) {
  return new Date(now() - days * 86_400_000).toISOString();
}

assert.strictEqual(
  assessFreshness(isoHoursAgo(2), FRESHNESS_THRESHOLDS.projectState).level,
  "fresh",
);
assert.strictEqual(
  assessFreshness(isoDaysAgo(2), FRESHNESS_THRESHOLDS.projectState).level,
  "warning",
);
assert.strictEqual(
  assessFreshness(isoDaysAgo(4), FRESHNESS_THRESHOLDS.projectState).level,
  "stale",
);

assert.strictEqual(
  assessFreshness(isoDaysAgo(3), FRESHNESS_THRESHOLDS.releaseGate).level,
  "fresh",
);
assert.strictEqual(
  assessFreshness(isoDaysAgo(10), FRESHNESS_THRESHOLDS.releaseGate).level,
  "warning",
);
assert.strictEqual(
  assessFreshness(isoDaysAgo(20), FRESHNESS_THRESHOLDS.releaseGate).level,
  "stale",
);

assert.strictEqual(assessFreshness("", FRESHNESS_THRESHOLDS.humanQa).level, "unknown");
assert.match(formatRelativeAge(isoHoursAgo(1)), /ago|just now/);

const snapshot = buildFreshnessSnapshot(
  {
    schemaVersion: 2,
    updatedAt: isoDaysAgo(4),
    projectStateUpdatedAt: isoDaysAgo(4),
    lastDeploymentAt: isoDaysAgo(1),
    lastReleaseGateAt: isoDaysAgo(10),
    lastHumanPlaytestAt: "",
    project: { name: "Test", version: "0.0.0", channel: "dev" },
    release: { status: "blocked", headline: "test" },
    objective: { title: "t", summary: "s" },
    priorities: { p0: { open: 0, items: [] }, p1: { open: 0, items: [] } },
    health: { game: "green", gameNote: "", studio: "green", studioNote: "" },
    nextActions: [],
    links: {},
  },
  {
    schemaVersion: 1,
    updatedAt: isoDaysAgo(1),
    deploy: { productionUrl: "", devUrl: "", ciRunsReleaseGate: false },
    gate: { command: "test", gates: [] },
    blockers: [],
  },
);

assert.strictEqual(snapshot.isProjectStateStale, true);
assert.strictEqual(snapshot.projectState.level, "stale");
assert.strictEqual(snapshot.releaseGate.level, "warning");
assert.strictEqual(snapshot.humanQa.level, "unknown");

console.log("freshness tests passed");
