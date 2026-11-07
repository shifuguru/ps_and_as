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
import {
  resolveHandCarouselStep,
  resolveHandMetrics,
} from "../src/utils/compactGameLayout";
import { getCardFaceColors } from "../src/utils/cardFaceTheme";

function rgb(hex: string): number[] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
}

function luminance(channels: number[]): number {
  const linear = channels.map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrast(a: number[], b: number[]): number {
  const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (lighter + 0.05) / (darker + 0.05);
}

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

  for (const height of [568, 667, 720, 844, 932]) {
    const hand = resolveHandMetrics(height);
    for (const width of [320, 375, 430]) {
      assert.strictEqual(resolveHandCarouselStep(1, width, hand.cardWidth), hand.cardWidth);
      for (const count of [2, 8, 18]) {
        const step = resolveHandCarouselStep(count, width, hand.cardWidth);
        assert.ok(step >= 30 && step <= 36, `${width}x${height}, ${count} cards`);
        assert.ok(step > resolveCardFaceMetrics(hand.cardWidth, hand.cardHeight).cornerInsetSide);
      }
    }
  }

  for (const darkMode of [false, true]) {
    for (const disabled of [false, true]) {
      const colors = getCardFaceColors(darkMode, disabled);
      const face = rgb(colors.faceBg);
      const wash = colors.disabledWash.match(
        /^rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)$/,
      );
      assert.ok(wash, "disabled wash is an RGBA color");
      const alpha = disabled ? Number(wash[4]) : 0;
      const background = face.map((channel, i) =>
        channel * (1 - alpha) + Number(wash[i + 1]) * alpha,
      );
      for (const color of [colors.label, colors.redSuit, colors.blackSuit, colors.joker]) {
        assert.ok(
          contrast(rgb(color), background) >= 4.5,
          `${darkMode ? "dark" : "light"} ${disabled ? "unplayable" : "playable"} ${color}`,
        );
      }
    }
  }

  console.log("test-card-face-metrics: ok");
}

run();
