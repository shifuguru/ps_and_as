#!/usr/bin/env node
/**
 * Release gate summary — Mission Control render safety.
 *
 *   npx tsx ./scripts/studio/test-release-gate-summary.mjs
 */
import assert from "assert";
import { readFileSync } from "fs";
import { summarizeReleaseGateRun } from "../../src/studio/releaseGateSummary.ts";

function mustNotThrow(label, run) {
  const summary = summarizeReleaseGateRun(run);
  assert.ok(typeof summary.label === "string" && summary.label.length > 0, label);
  assert.ok(summary.tone, label);
}

mustNotThrow("missing run", undefined);
mustNotThrow("empty object", {});

mustNotThrow("legacy pass", {
  at: "2026-01-01T00:00:00.000Z",
  mode: "full",
  passed: ["core"],
  failed: [],
  skipped: [],
  durationMs: 1,
});
assert.strictEqual(
  summarizeReleaseGateRun({
    at: "2026-01-01T00:00:00.000Z",
    mode: "full",
    passed: ["core"],
    failed: [],
  }).label,
  "Pass",
);

mustNotThrow("legacy fail", {
  at: "2026-01-01T00:00:00.000Z",
  mode: "full",
  passed: [],
  failed: [{ id: "core", message: "fail" }],
});
assert.strictEqual(
  summarizeReleaseGateRun({
    at: "2026-01-01T00:00:00.000Z",
    mode: "full",
    failed: [{ id: "core", message: "fail" }],
  }).label,
  "1 failed",
);

const live = JSON.parse(
  readFileSync("studio/release_status.json", "utf8"),
).gate.lastRun;
mustNotThrow("live release_status.json lastRun", live);
const liveSummary = summarizeReleaseGateRun(live);
assert.notStrictEqual(liveSummary.label, "Unknown");
assert.match(liveSummary.label, /Partial|failed|server/i);

mustNotThrow("malformed", {
  at: "2026-01-01T00:00:00.000Z",
  mode: "full",
});
assert.strictEqual(
  summarizeReleaseGateRun({ at: "2026-01-01T00:00:00.000Z", mode: "full" }).label,
  "Unknown",
);

console.log("release gate summary tests passed", liveSummary);
