/**
 * Remove exact card instances from a hand (consume-on-match).
 * Critical for the two identical jokers ({ suit: "joker", value: 16 }):
 * a suit+value `.filter` would delete both when taking one.
 */
function removeCardsFromHandConsume(hand, cards) {
  const remaining = (hand || []).slice();
  for (const card of cards || []) {
    const index = remaining.findIndex(
      (h) => h.suit === card.suit && h.value === card.value,
    );
    if (index !== -1) remaining.splice(index, 1);
  }
  return remaining;
}

module.exports = {
  removeCardsFromHandConsume,
};
