import assert from "node:assert/strict";
import { tableCollectionOffsets } from "../src/utils/tableCollection";

// The theme imports the bundled felt image, which Node cannot load itself.
require.extensions[".webp"] = (module) => { module.exports = "felt"; };
const { hexToRgb, hslToHex, mixRgb, relativeLuminance, rgbToHex } =
  require("../src/utils/colorTheory") as typeof import("../src/utils/colorTheory");
const { buildAppTheme } = require("../src/styles/feltPalette") as typeof import("../src/styles/feltPalette");

function composite(color: string, background: string): string {
  const match = color.match(/^rgba\(\s*(\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\s*\)$/);
  if (!match) return color;
  const base = hexToRgb(background);
  assert.ok(base);
  return rgbToHex(mixRgb(base, { r: +match[1], g: +match[2], b: +match[3] }, +match[4]));
}

function contrast(a: string, b: string): number {
  const x = relativeLuminance(a);
  const y = relativeLuminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

for (let players = 2; players <= 8; players++) {
  const cards = Array.from({ length: players * 3 }, (_, i) => {
    const groupLeft = 18 + Math.floor(i / 3) * 28;
    const cardLeft = (i % 3) * 14;
    const groupTop = 90 + (i % 2) * 6;
    const move = tableCollectionOffsets(390, 280, 64, 90, groupLeft, groupTop, cardLeft);
    return { start: groupLeft + cardLeft, end: groupLeft + cardLeft + move.groupX + move.cardX, y: groupTop + move.groupY };
  }).sort((a, b) => a.start - b.start);
  for (const card of cards) {
    assert.equal(card.end, 163);
    assert.equal(card.y, 95);
  }
  for (let i = 1; i < cards.length; i++) {
    for (const progress of [0.25, 0.5, 0.75]) {
      const previous = cards[i - 1].start * (1 - progress) + cards[i - 1].end * progress;
      const current = cards[i].start * (1 - progress) + cards[i].end * progress;
      assert.ok(previous <= current, "cards should not cross while gathering");
    }
  }
}

for (let hue = 0; hue < 360; hue += 15) {
  for (const lightness of [12, 24, 60, 85]) {
    const theme = buildAppTheme(hslToHex(hue, 60, lightness), "light", "auto");
    const frost = `rgba(${theme.frostRgb}, ${theme.blur.chrome.webOpacity})`;
    for (const behind of ["#000000", "#ffffff"]) {
      const glass = composite(frost, behind);
      for (const color of [theme.textPrimary, theme.textSecondary, theme.textTertiary, theme.accent]) {
        const ratio = contrast(composite(color, glass), glass);
        assert.ok(ratio >= 4.5, `${color} on ${glass}: ${ratio.toFixed(2)}`);
      }
    }
    assert.ok(contrast("#ffffff", theme.accent) >= 7, "primary accent should support white text");
  }
}

console.log("test-ui-refinements: centered non-crossing stacks and light theme contrast passed");
