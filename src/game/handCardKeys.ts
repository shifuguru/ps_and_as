import type { Card } from "./ruleset";

/** Stable identity for a hand card (matches play-flight concealment). */
export function handCardIdentity(card: Card): string {
  return `${card.suit}-${card.value}`;
}

/**
 * Per-slot identity for a card at `index` within an ordered hand.
 * A standard deck has two identical Jokers (same suit/value), so plain
 * `handCardIdentity` collides for them — React then reuses one Joker's
 * rendered/animated node for the other, producing a card that renders
 * behind/overlapping its neighbours. Disambiguate by occurrence order so
 * each duplicate-valued card keeps a distinct, stable key across reindexes
 * (stable because Array#sort preserves relative order of equal elements).
 */
export function handCardKeyAt(cards: Card[], index: number): string {
  const card = cards[index];
  const base = handCardIdentity(card);
  let occurrence = 0;
  for (let i = 0; i < index; i++) {
    if (handCardIdentity(cards[i]) === base) occurrence++;
  }
  return occurrence === 0 ? base : `${base}#${occurrence}`;
}
