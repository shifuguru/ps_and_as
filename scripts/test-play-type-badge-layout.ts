import assert from "node:assert/strict";
import { playTypeBadgeBelowCardsTop } from "../src/utils/tableBadgeLayout";

const cardHeight = 120;
const gap = 16;
const positions = [{ top: 45 }, { top: 51 }, { top: 45 }];
assert.equal(playTypeBadgeBelowCardsTop(positions, cardHeight, gap), 187);
for (const position of positions) {
  assert.ok(playTypeBadgeBelowCardsTop(positions, cardHeight, gap) >= position.top + cardHeight + gap);
}

assert.equal(playTypeBadgeBelowCardsTop([{ top: 8 }], 180, gap), 204);
assert.equal(playTypeBadgeBelowCardsTop([{ top: -20 }, { top: -14 }], 90, gap), 92);

console.log("Play-type badges stay below all played cards");
