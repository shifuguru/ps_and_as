/**
 * Regression: turn-start cue + flight SFX timing helpers.
 * Run: npx tsx ./scripts/test-turn-start-cue.ts
 */
import assert from "assert";
import {
  nextTurnStartCue,
  type TurnStartCueState,
} from "../src/audio/sfxPlayback";
import { playCardsSfxId } from "../src/audio/gameSfx";

function createTurnStartGate() {
  let state: TurnStartCueState = { firedForAuthorityTurn: false };
  let fires = 0;
  return {
    get fires() {
      return fires;
    },
    update(authority: boolean, presentable: boolean, enabled = true) {
      const next = nextTurnStartCue(state, {
        enabled,
        authority,
        presentable,
      });
      state = next.state;
      if (next.fire) fires += 1;
    },
  };
}

const gate = createTurnStartGate();
gate.update(false, false);
assert.strictEqual(gate.fires, 0);

// Opponent play resolves → authority flips to you while flights still hold.
gate.update(true, false);
assert.strictEqual(gate.fires, 0, "authority alone does not fire");

gate.update(true, true);
assert.strictEqual(gate.fires, 1, "fires when presentable");

// Presentation flicker mid-ownership (flight hold → unlock) must not re-fire.
gate.update(true, false);
gate.update(true, true);
assert.strictEqual(gate.fires, 1, "no double-fire on presentable flicker");

gate.update(false, false);
assert.strictEqual(gate.fires, 1);

gate.update(true, true);
assert.strictEqual(gate.fires, 2, "next turn fires again");

const disabled = createTurnStartGate();
disabled.update(true, true, false);
assert.strictEqual(disabled.fires, 0, "disabled skips fire");
disabled.update(true, true, true);
assert.strictEqual(disabled.fires, 1, "enable then active fires");

assert.strictEqual(playCardsSfxId(1), "card_play");
assert.strictEqual(playCardsSfxId(2), "card_play_multi");
assert.strictEqual(playCardsSfxId(4), "card_play_multi");

/** Flight SFX: throw on start; land thud only if start already played. */
function resolveFlightSfxEvents(
  startedKeys: Set<string>,
  playKey: string,
  phase: "started" | "landed",
): string[] {
  if (phase === "started") {
    if (startedKeys.has(playKey)) return []; // idempotent early+late notify
    startedKeys.add(playKey);
    return ["card_play"];
  }
  if (!startedKeys.has(playKey)) {
    return ["card_play"]; // instant / skipped flight
  }
  startedKeys.delete(playKey);
  return ["card_land"];
}

const flightKeys = new Set<string>();
assert.deepStrictEqual(
  resolveFlightSfxEvents(flightKeys, "p1", "started"),
  ["card_play"],
);
assert.deepStrictEqual(
  resolveFlightSfxEvents(flightKeys, "p1", "started"),
  [],
  "second started notify is silent",
);
assert.deepStrictEqual(
  resolveFlightSfxEvents(flightKeys, "p1", "landed"),
  ["card_land"],
);
assert.deepStrictEqual(
  resolveFlightSfxEvents(new Set(), "cpu", "landed"),
  ["card_play"],
  "instant land still gets a play cue",
);

console.log("test-turn-start-cue: ok");
