/**
 * Regression: turn-start cue fires once per false→true transition.
 * Run: npx tsx ./scripts/test-turn-start-cue.ts
 */
import assert from "assert";

/** Pure transition helper mirroring useTurnStartCue (no React). */
function createTurnStartGate() {
  let wasMyTurn = false;
  let fires = 0;
  return {
    get fires() {
      return fires;
    },
    update(isMyTurn: boolean, enabled = true) {
      if (!enabled) {
        wasMyTurn = false;
        return;
      }
      if (isMyTurn && !wasMyTurn) {
        wasMyTurn = true;
        fires += 1;
        return;
      }
      if (!isMyTurn) {
        wasMyTurn = false;
      }
    },
  };
}

const gate = createTurnStartGate();
gate.update(false);
assert.strictEqual(gate.fires, 0);

gate.update(true);
assert.strictEqual(gate.fires, 1, "first rise fires once");

gate.update(true);
gate.update(true);
assert.strictEqual(gate.fires, 1, "re-renders while active do not re-fire");

gate.update(false);
assert.strictEqual(gate.fires, 1);

gate.update(true);
assert.strictEqual(gate.fires, 2, "next turn fires again");

const disabled = createTurnStartGate();
disabled.update(true, false);
assert.strictEqual(disabled.fires, 0, "disabled skips fire");
disabled.update(true, true);
assert.strictEqual(disabled.fires, 1, "enable then active fires");

import { playCardsSfxId } from "../src/audio/gameSfx";
assert.strictEqual(playCardsSfxId(1), "card_play");
assert.strictEqual(playCardsSfxId(2), "card_play_multi");
assert.strictEqual(playCardsSfxId(4), "card_play_multi");

console.log("test-turn-start-cue: ok");
