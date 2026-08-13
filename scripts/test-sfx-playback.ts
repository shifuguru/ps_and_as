/**
 * Regression: SFX pool + pass-key observation helpers.
 * Run: npx tsx ./scripts/test-sfx-playback.ts
 */
import assert from "assert";
import {
  pickPoolSlot,
  collectNewPassKeys,
  resolveEffectVolume,
  passActionKey,
  SFX_POOL_SIZE,
} from "../src/audio/sfxPlayback";
import { playCardsSfxId } from "../src/audio/gameSfx";

assert.strictEqual(SFX_POOL_SIZE >= 2, true, "pool must allow overlap");

assert.strictEqual(resolveEffectVolume("turn_start"), 0.72);
assert.strictEqual(resolveEffectVolume("card_select"), 0.45);
assert.strictEqual(resolveEffectVolume("pass"), 0.5);
assert.strictEqual(resolveEffectVolume("card_play"), 0.68);
assert.strictEqual(resolveEffectVolume("click"), 0.7);

{
  const playing = [false, false, false];
  const a = pickPoolSlot(playing, 0);
  assert.strictEqual(a.slot, 0);
  playing[a.slot] = true;
  const b = pickPoolSlot(playing, a.nextIndex);
  assert.strictEqual(b.slot, 1, "prefer next free slot");
  playing[b.slot] = true;
  playing[2] = true;
  const c = pickPoolSlot(playing, b.nextIndex);
  assert.ok(c.slot >= 0 && c.slot < 3, "when full, still returns a slot");
}

{
  const empty = collectNewPassKeys([], new Set());
  assert.deepStrictEqual(empty.newKeys, []);
  assert.strictEqual(empty.nextHeard.size, 0);

  const first = collectNewPassKeys(
    [{ type: "pass", playerId: "p1" }],
    new Set(),
  );
  assert.deepStrictEqual(first.newKeys, [passActionKey(0, "p1")]);

  const same = collectNewPassKeys(
    [{ type: "pass", playerId: "p1" }],
    first.nextHeard,
  );
  assert.deepStrictEqual(same.newKeys, [], "no re-fire for same pass");

  const second = collectNewPassKeys(
    [
      { type: "pass", playerId: "p1" },
      { type: "play", playerId: "p2" },
      { type: "pass", playerId: "p3" },
    ],
    first.nextHeard,
  );
  assert.deepStrictEqual(second.newKeys, [passActionKey(2, "p3")]);

  const cleared = collectNewPassKeys(undefined, second.nextHeard);
  assert.strictEqual(cleared.nextHeard.size, 0, "new trick clears heard set");
}

/** Hydrate guard used by GameScreen: bulk first observation stays silent. */
function shouldPlayNewPassKeys(
  wasEmptyHeard: boolean,
  newKeyCount: number,
): boolean {
  if (newKeyCount === 0) return false;
  if (wasEmptyHeard && newKeyCount > 1) return false;
  return true;
}

assert.strictEqual(shouldPlayNewPassKeys(true, 1), true, "first live pass plays");
assert.strictEqual(
  shouldPlayNewPassKeys(true, 3),
  false,
  "reconnect bulk seed silent",
);
assert.strictEqual(
  shouldPlayNewPassKeys(false, 2),
  true,
  "batched ack passes still audible",
);

assert.strictEqual(playCardsSfxId(1), "card_play");
assert.strictEqual(playCardsSfxId(3), "card_play_multi");

import {
  nextTurnStartCue,
  type TurnStartCueState,
} from "../src/audio/sfxPlayback";

{
  let state: TurnStartCueState = { firedForAuthorityTurn: false };
  let step = nextTurnStartCue(state, {
    enabled: true,
    authority: true,
    presentable: false,
  });
  assert.strictEqual(step.fire, false);
  state = step.state;
  step = nextTurnStartCue(state, {
    enabled: true,
    authority: true,
    presentable: true,
  });
  assert.strictEqual(step.fire, true);
  state = step.state;
  step = nextTurnStartCue(state, {
    enabled: true,
    authority: true,
    presentable: false,
  });
  state = step.state;
  step = nextTurnStartCue(state, {
    enabled: true,
    authority: true,
    presentable: true,
  });
  assert.strictEqual(step.fire, false, "presentation flicker must not re-fire");
}

console.log("test-sfx-playback: ok");
