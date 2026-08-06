/**
 * Card face metrics scale with laid-out width (hand vs pile).
 * Run: npx tsx ./scripts/test-card-face-metrics.ts
 */
import assert from "assert";
import {
  CARD_FACE_REF,
  HAND_CARD_WIDTH,
  resolveCardFaceMetrics,
} from "../src/components/cardDimensions";

function run() {
  const base = resolveCardFaceMetrics(HAND_CARD_WIDTH, 124);
  assert.strictEqual(base.cornerRank, CARD_FACE_REF.cornerRank);
  assert.strictEqual(base.value, CARD_FACE_REF.value);
  assert.strictEqual(base.suit, CARD_FACE_REF.suit);
  assert.strictEqual(base.scale, 1);

  // Pile cards are often larger than the hand reference — fonts must grow.
  const pile = resolveCardFaceMetrics(120, 173);
  assert.ok(pile.scale > 1);
  assert.ok(pile.cornerRank > base.cornerRank);
  assert.ok(pile.value > base.value);
  assert.ok(pile.suit > base.suit);

  // Compact hand shrinks chrome with the card.
  const tight = resolveCardFaceMetrics(67, 97);
  assert.ok(tight.scale < 1);
  assert.ok(tight.cornerRank < base.cornerRank);
  assert.ok(tight.value < base.value);

  // Same aspect scale keeps pile/hand proportions aligned.
  const ratioBase = base.value / base.cornerRank;
  const ratioPile = pile.value / pile.cornerRank;
  assert.ok(Math.abs(ratioBase - ratioPile) < 0.15);

  console.log("test-card-face-metrics: ok");
}

run();
