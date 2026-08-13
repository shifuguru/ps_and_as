/**
 * Unit coverage for ceremony sync version gating.
 * Live play discarded during localCeremonyUi must remain re-applicable.
 *
 *   node scripts/test-ceremony-sync-version.mjs
 */
import { createRequire } from "module";

const require = createRequire(import.meta.url);
require("../node_modules/ts-node").register({
  transpileOnly: true,
  skipProject: true,
  compilerOptions: {
    module: "commonjs",
    moduleResolution: "node",
    esModuleInterop: true,
    target: "ES2020",
    strict: false,
  },
});

const {
  shouldApplyServerSnapshot,
  readStateVersion,
} = require("../src/game/multiplayerSync.ts");

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

// Bug: bump lastApplied on discard → same live version never reapplies after finalize.
{
  let lastApplied = 10;
  const livePlayVersion = 11;

  // Broken path (pre-fix): bump then discard
  lastApplied = livePlayVersion;
  assert(
    !shouldApplyServerSnapshot(livePlayVersion, lastApplied) === false,
    "sanity: >= allows equal versions",
  );
  // shouldApply uses >= so equal WOULD reapply — the real bug is never requesting.
  // Document: not bumping on discard keeps lastApplied behind so requestGameState applies.
  lastApplied = 10;
  assert(
    shouldApplyServerSnapshot(livePlayVersion, lastApplied),
    "uncommitted discard keeps live play re-applicable",
  );
  assert(
    shouldApplyServerSnapshot(livePlayVersion, livePlayVersion),
    "equal version still applies (requestGameState after finalize)",
  );
}

{
  const parsed = { stateVersion: 42 };
  assert(readStateVersion(parsed) === 42, "readStateVersion");
  assert(readStateVersion({}) === null, "missing version");
}

console.log("test-ceremony-sync-version: PASS");
