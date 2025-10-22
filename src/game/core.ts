// core.ts
// Core game state and logic for Presidents & Assholes
import { Card, Player, createDeck, shuffleDeck, dealCards } from "./ruleset";

export type GameState = {
  id: string;
  players: Player[];
  currentPlayerIndex: number;
  pile: Card[]; // last played cards on the pile
  pileHistory?: Card[][];
  passCount: number; // consecutive passes
  finishedOrder: string[]; // player ids in order they finished
  started: boolean;
  lastPlayPlayerIndex?: number | null;
  mustPlay?: boolean;
};

export function createGame(playerNames: string[]): GameState {
  const players: Player[] = playerNames.map((n, i) => ({ id: String(i + 1), name: n, hand: [], role: "Neutral" }));
  const deck = shuffleDeck(createDeck());
  dealCards(deck, players);
  // Determine who has the 3 of clubs — that player starts. If none, default to 0.
  const threeOfClubsIndex = players.findIndex((p) => p.hand.some((c) => c.suit === "clubs" && c.value === 3));
  const startIndex = threeOfClubsIndex >= 0 ? threeOfClubsIndex : 0;
  return {
    id: "game-" + Date.now(),
    players,
    currentPlayerIndex: startIndex,
    pile: [],
    passCount: 0,
    finishedOrder: [],
    started: true,
    lastPlayPlayerIndex: null,
    // the player who holds the 3 of clubs must start and cannot pass
    mustPlay: threeOfClubsIndex >= 0 ? true : false,
    pileHistory: [],
  };
}

export function playCards(state: GameState, playerId: string, cards: Card[]): GameState {
  // Very small validation: ensure it's that player's turn and they have the cards
  const pIndex = state.players.findIndex((p) => p.id === playerId);
  if (pIndex === -1) return state;
  if (state.currentPlayerIndex !== pIndex) return state;

  const player = state.players[pIndex];
  // check that player has all cards
  for (const c of cards) {
    const found = player.hand.findIndex((h) => h.suit === c.suit && h.value === c.value);
    if (found === -1) return state;
  }

  // all played cards must have the same value
  if (!allSameValue(cards)) return state;

  // Validate play type: must play same number of cards as pile (unless pile is empty)
  if (!isValidPlay(cards, state.pile)) return state;

  // remove cards from player's hand
  player.hand = player.hand.filter((h) => !cards.some((c) => c.suit === h.suit && c.value === h.value));
  // record who played last
  state.lastPlayPlayerIndex = pIndex;

  // Special rules first
  // If any played card is a 2, it clears the pile immediately and the player who played it leads next
  if (containsTwo(cards)) {
    state.pile = [];
    state.pileHistory = [];
    state.passCount = 0;
    state.currentPlayerIndex = pIndex;
    state.mustPlay = true;
  } else if (isFourOfAKind(cards)) {
    // four of a kind clears the pile and the player who played it leads next
    state.pile = [];
    state.pileHistory = [];
    state.passCount = 0;
    state.currentPlayerIndex = pIndex;
    state.mustPlay = true;
  } else {
    // normal play replaces the pile
    state.pile = cards;
    // record this play in history
    state.pileHistory = state.pileHistory || [];
    state.pileHistory.push(cards.slice());
    state.passCount = 0;
    // advance from the player who just played
    state.currentPlayerIndex = nextActivePlayerIndex(state, pIndex);
    state.mustPlay = false;
  }
  // if player emptied hand, add to finished
  if (player.hand.length === 0) {
    state.finishedOrder.push(player.id);
  }

  return { ...state };
}

// Helpers for play validation
export function getPlayCount(cards: Card[]) {
  return cards.length;
}

// Rank order: 3,4,5,6,7,8,9,10,J(11),Q(12),K(13),A(14),2(2),Joker(15)
export const RANK_ORDER = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 2, 15];

export function rankIndex(value: number) {
  const idx = RANK_ORDER.indexOf(value);
  return idx >= 0 ? idx : -1;
}

export function getHighestValue(cards: Card[]) {
  if (!cards || cards.length === 0) return -1;
  return Math.max(...cards.map((c) => rankIndex(c.value)));
}

export function isValidPlay(cards: Card[], pile: Card[]) {
  // empty play not allowed
  if (!cards || cards.length === 0) return false;

  const playCount = getPlayCount(cards);
  const pileCount = getPlayCount(pile);

  // all cards in the play must be the same value
  if (!allSameValue(cards)) return false;

  // if pile is empty, any uniform play is allowed
  if (pileCount === 0) return true;

  // must match the count
  if (playCount !== pileCount) return false;

  // pile must also be uniform (defensive)
  if (!allSameValue(pile)) return false;

  // must have higher value than pile's value
  const top = rankIndex(pile[0].value);
  const plTop = rankIndex(cards[0].value);
  return plTop > top;
}

// special helpers
export function containsTwo(cards: Card[]) {
  return cards.some((c) => c.value === 2);
}

export function isFourOfAKind(cards: Card[]) {
  if (!cards || cards.length !== 4) return false;
  const v = cards[0].value;
  return cards.every((c) => c.value === v);
}

// find a simple valid single-card play from hand (used by hotseat auto-play)
export function findValidSingleCard(hand: Card[], pile: Card[]) {
  if (!hand || hand.length === 0) return null;
  const pileTop = getHighestValue(pile);
  // if pile empty, play the lowest value
  if (pile.length === 0) {
    return hand.reduce((min, c) => (c.value < min.value ? c : min), hand[0]);
  }
  // otherwise find lowest card greater than pileTop
  const candidates = hand.filter((c) => c.value > pileTop);
  if (candidates.length === 0) return null;
  return candidates.reduce((min, c) => (c.value < min.value ? c : min), candidates[0]);
}

export function passTurn(state: GameState, playerId: string): GameState {
  const pIndex = state.players.findIndex((p) => p.id === playerId);
  if (pIndex === -1) return state;
  if (state.currentPlayerIndex !== pIndex) return state;

  // If the current player is required to play (leader), they cannot pass
  if (state.mustPlay) return state;

  state.passCount += 1;
  state.currentPlayerIndex = (state.currentPlayerIndex + 1) % state.players.length;

  // if all other players passed, clear the pile and winner leads next
  if (state.passCount >= state.players.length - 1) {
    state.pile = [];
    state.passCount = 0;
    const winner = state.lastPlayPlayerIndex ?? null;
    if (winner !== null && winner >= 0 && !state.finishedOrder.includes(state.players[winner].id)) {
      state.currentPlayerIndex = winner;
      state.mustPlay = true;
    } else {
      state.currentPlayerIndex = nextActivePlayerIndex(state, state.currentPlayerIndex);
      state.mustPlay = false;
    }
  }

  return { ...state };
}

// helper: check all cards have same value
export function allSameValue(cards: Card[]) {
  if (!cards || cards.length === 0) return false;
  const v = cards[0].value;
  return cards.every((c) => c.value === v);
}

// helper: find next active player index skipping finished players
export function nextActivePlayerIndex(state: GameState, fromIndex: number) {
  const n = state.players.length;
  if (n === 0) return 0;
  for (let i = 1; i <= n; i++) {
    const idx = (fromIndex + i) % n;
    const p = state.players[idx];
    if (!state.finishedOrder.includes(p.id)) return idx;
  }
  return fromIndex;
}
