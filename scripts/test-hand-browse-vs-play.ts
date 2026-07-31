/**
 * Hand browse vs play eligibility — selection must stay gated by turn,
 * while browse semantics stay available off-turn.
 * Run: npx tsx ./scripts/test-hand-browse-vs-play.ts
 */
import assert from "assert";

/** Mirrors PlayerHand.handleCardPress gating. */
function resolveCardPressResult(opts: {
  disabled: boolean;
  focusedIndex: number;
  pressedIndex: number;
}): { browsed: boolean; selected: boolean } {
  const browsed = opts.pressedIndex !== opts.focusedIndex;
  if (opts.disabled) {
    return { browsed, selected: false };
  }
  return { browsed, selected: true };
}

const offTurnBrowse = resolveCardPressResult({
  disabled: true,
  focusedIndex: 2,
  pressedIndex: 5,
});
assert.strictEqual(offTurnBrowse.browsed, true);
assert.strictEqual(offTurnBrowse.selected, false, "off-turn cannot select");

const offTurnSameFocus = resolveCardPressResult({
  disabled: true,
  focusedIndex: 3,
  pressedIndex: 3,
});
assert.strictEqual(offTurnSameFocus.browsed, false);
assert.strictEqual(offTurnSameFocus.selected, false);

const onTurnSelect = resolveCardPressResult({
  disabled: false,
  focusedIndex: 1,
  pressedIndex: 1,
});
assert.strictEqual(onTurnSelect.selected, true, "on-turn can select");

const onTurnBrowseThenSelect = resolveCardPressResult({
  disabled: false,
  focusedIndex: 0,
  pressedIndex: 4,
});
assert.strictEqual(onTurnBrowseThenSelect.browsed, true);
assert.strictEqual(onTurnBrowseThenSelect.selected, true);

/** GameScreen playableIndices: all false when not human turn. */
function playableMask(isHumanTurn: boolean, handLen: number, canPlayAt: boolean[]) {
  return isHumanTurn
    ? canPlayAt
    : Array.from({ length: handLen }, () => false);
}

assert.deepStrictEqual(
  playableMask(false, 3, [true, false, true]),
  [false, false, false],
);
assert.deepStrictEqual(
  playableMask(true, 3, [true, false, true]),
  [true, false, true],
);

console.log("test-hand-browse-vs-play: ok");
