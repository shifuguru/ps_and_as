import type { Card } from "../game/ruleset";
import { formatCardRank } from "../game/ruleset";

const SUIT_GLYPH: Record<string, string> = {
  hearts: "♥",
  diamonds: "♦",
  clubs: "♣",
  spades: "♠",
  joker: "★",
};

export type HandGuidanceInput = {
  isHumanTurn: boolean;
  /**
   * True only when the round-opening 3 lead is required AND the player holds
   * that card. Must already be gated by the caller — never set from empty-pile
   * alone (that is true after every trick).
   */
  mustLeadOpening: boolean;
  openingLeadCard?: Card | null;
  noValidPlays: boolean;
  onTopTurn: boolean;
  selectedCount: number;
  pileTop?: Card | null;
  pileCount: number;
};

function formatCardShort(card: Card): string {
  return `${formatCardRank(card)}${SUIT_GLYPH[card.suit] ?? ""}`;
}

/**
 * Player-facing instruction for the hand guidance bar.
 * Presentation only — mirrors existing UI state; does not change rules.
 *
 * Priority (first match wins; each branch is fully gated):
 * 1. Not your turn
 * 2. Opening-3 lead (caller-gated round opener only)
 * 3. No valid plays → Pass / Skip
 * 4. On Top optional beat
 * 5. Selection ready to Play
 * 6. Empty pile lead (any rank)
 * 7. Beat pile top
 */
export function resolveHandGuidance(input: HandGuidanceInput): string {
  if (!input.isHumanTurn) return "Waiting for your turn";

  // Opening hint — excluded completely unless caller asserts full preconditions.
  if (input.mustLeadOpening) {
    const lead = input.openingLeadCard;
    if (lead) return `Lead with your ${formatCardShort(lead)}`;
    // Caller should not set mustLeadOpening without a card; refuse the generic
    // opening copy so mid-game forced leads never say "opening 3".
    return "Lead any rank";
  }

  if (input.noValidPlays) {
    return input.onTopTurn ? "No beat — tap Skip" : "No valid plays — tap Pass";
  }

  if (input.onTopTurn) {
    return "Optional beat — play higher or Skip";
  }

  if (input.selectedCount > 0) {
    return `Ready — tap Play (${input.selectedCount})`;
  }

  if (input.pileCount <= 0) {
    return "Lead any rank";
  }

  if (input.pileTop) {
    return `Beat ${formatCardShort(input.pileTop)}`;
  }

  return "Tap a card to play";
}
