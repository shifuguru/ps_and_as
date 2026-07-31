/**
 * Regression: Leave must never appear in the ActionBar primary track.
 * Run: npx tsx ./scripts/test-action-bar-leave.ts
 */
import assert from "assert";
import { readFileSync } from "fs";
import { join } from "path";
import {
  actionBarTrackIncludesLeave,
  resolveActionBarTrackMode,
} from "../src/components/actionBarTrackMode";

function run() {
  assert.strictEqual(
    resolveActionBarTrackMode({}),
    "pass-play",
    "default track is Pass | Play",
  );
  assert.strictEqual(
    resolveActionBarTrackMode({ leaveOnly: true }),
    "empty",
    "leaveOnly hides the primary track (Leave is in HUD)",
  );
  assert.strictEqual(
    resolveActionBarTrackMode({
      skipGameOnly: true,
      hasSkipHandler: true,
    }),
    "skip",
    "spectator bot table shows Skip only",
  );
  assert.strictEqual(
    resolveActionBarTrackMode({
      skipGameOnly: true,
      hasSkipHandler: false,
    }),
    "pass-play",
    "skip mode without handler falls back to pass-play",
  );

  for (const mode of ["pass-play", "skip", "empty"] as const) {
    assert.strictEqual(
      actionBarTrackIncludesLeave(mode),
      false,
      `track mode ${mode} must never include Leave`,
    );
  }

  const actionBarSource = readFileSync(
    join(__dirname, "../src/components/ActionBar.tsx"),
    "utf8",
  );
  assert.ok(
    !actionBarSource.includes("Leave Game"),
    "ActionBar source must not render a Leave Game control",
  );
  assert.ok(
    !actionBarSource.includes(">Leave<") &&
      !actionBarSource.includes('{"Leave"}') &&
      !/>\s*Leave\s*</.test(actionBarSource),
    "ActionBar source must not contain a Leave label",
  );
  assert.ok(
    actionBarSource.includes("resolveActionBarTrackMode"),
    "ActionBar must use resolveActionBarTrackMode",
  );

  const hudSource = readFileSync(
    join(__dirname, "../src/gameplayPresentation/GameplayHud.tsx"),
    "utf8",
  );
  assert.ok(
    hudSource.includes("onLeave"),
    "GameplayHud must expose onLeave",
  );
  assert.ok(
    hudSource.includes('accessibilityLabel="Leave Game"'),
    "GameplayHud must expose Leave Game accessibility",
  );

  console.log("test-action-bar-leave: ok");
}

run();
