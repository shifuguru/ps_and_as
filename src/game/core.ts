// core.ts
// Core game state and logic for Presidents & Assholes
import { Card, Player, createDeck, shuffleDeck, dealCards } from "./ruleset";

export type TrickAction = {
  type: "play" | "pass";
  playerId: string;
  playerName: string;
  cards?: Card[];
  timestamp: number;
  tenRuleDirection?: "higher" | "lower"; // Set when 10 is played and direction is chosen
};

export type TrickHistory = {
  trickNumber: number;
  actions: TrickAction[];
  winnerId?: string;
  winnerName?: string;
};

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
  trickHistory?: TrickHistory[];
  currentTrick?: TrickHistory;
  tenRule?: {
    active: boolean;
    direction: "higher" | "lower" | null;
  };
  tenRulePending?: boolean;
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
    trickHistory: [],
    currentTrick: { trickNumber: 1, actions: [] },
    tenRule: { active: false, direction: null },
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

  // Special validation for the very first play of the game
  const isFirstPlay = state.pile.length === 0 && (!state.pileHistory || state.pileHistory.length === 0);
  if (isFirstPlay) {
    // First play must include the 3 of clubs
    const hasThreeOfClubs = cards.some(c => c.value === 3 && c.suit === "clubs");
    if (!hasThreeOfClubs) return state;
    
    // All cards must be 3s (can play 3♣ alone or with other 3s)
    const allThrees = cards.every(c => c.value === 3);
    if (!allThrees) return state;
  }

  // all played cards must have the same value OR be a valid run
  const isPlayRun = isRun(cards);
  if (!allSameValue(cards) && !isPlayRun) return state;

  // Validate play type: must play same number of cards as pile (unless pile is empty)
  if (!isValidPlay(cards, state.pile, state.tenRule)) return state;

  // remove cards from player's hand
  player.hand = player.hand.filter((h) => !cards.some((c) => c.suit === h.suit && c.value === h.value));
  // record who played last
  state.lastPlayPlayerIndex = pIndex;

  // Track this action in current trick
  if (!state.currentTrick) {
    state.currentTrick = { trickNumber: (state.trickHistory?.length || 0) + 1, actions: [] };
  }
  state.currentTrick.actions.push({
    type: "play",
    playerId: player.id,
    playerName: player.name,
    cards: cards.slice(),
    timestamp: Date.now(),
  });

  const trickEnded = containsTwo(cards) || isFourOfAKind(cards) || isSingleJoker(cards);

  // Check if 10 was played - will need user input for direction
  const playedTen = containsTen(cards);
  if (playedTen && !state.tenRule?.active) {
    // 10 rule is being activated - add cards to pile but pause for player input
    state.pile = cards;
    state.pileHistory = state.pileHistory || [];
    state.pileHistory.push(cards.slice());
    state.passCount = 0;
    state.tenRule = { active: true, direction: null };
    return { ...state, tenRulePending: true } as GameState;
  }

  // If 10 rule was active and a valid play was made, deactivate it
  if (state.tenRule?.active && state.tenRule.direction) {
    state.tenRule = { active: false, direction: null };
  }

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

  // if trick ended with special card, record winner and start new trick
  if (trickEnded) {
    state.currentTrick.winnerId = player.id;
    state.currentTrick.winnerName = player.name;
    state.trickHistory = state.trickHistory || [];
    state.trickHistory.push(state.currentTrick);
    state.currentTrick = { trickNumber: state.trickHistory.length + 1, actions: [] };
  }

  // if player emptied hand, add to finished
  if (player.hand.length === 0) {
    state.finishedOrder.push(player.id);
  }

  return { ...state };
}

// Function to set the 10 rule direction after user chooses
export function setTenRuleDirection(state: GameState, direction: "higher" | "lower"): GameState {
  if (!state.tenRule?.active || state.tenRule.direction !== null) {
    return state; // Can only set if 10 rule is pending
  }
  
  state.tenRule.direction = direction;
  state.tenRulePending = false;
  
  // Find the most recent play action in currentTrick and add the direction
  if (state.currentTrick && state.currentTrick.actions.length > 0) {
    const lastAction = state.currentTrick.actions[state.currentTrick.actions.length - 1];
    if (lastAction.type === "play" && lastAction.cards?.some(c => c.value === 10)) {
      lastAction.tenRuleDirection = direction;
    }
  }
  
  // The pile with the 10s remains active
  // Now advance to the next player who must play according to the direction
  state.currentPlayerIndex = nextActivePlayerIndex(state, state.currentPlayerIndex);
  state.mustPlay = true;
  
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

export function isValidPlay(cards: Card[], pile: Card[], tenRule?: { active: boolean; direction: "higher" | "lower" | null }) {
  // empty play not allowed
  if (!cards || cards.length === 0) return false;

  const playCount = getPlayCount(cards);
  const pileCount = getPlayCount(pile);

  // Check if it's a run
  const isPlayRun = isRun(cards);
  const isPileRun = pile.length >= 3 && isRun(pile);

  // Single joker can beat anything (including doubles, triples, quads)
  if (isSingleJoker(cards) && pileCount > 0) return true;

  // all cards in the play must be the same value OR be a valid run
  if (!allSameValue(cards) && !isPlayRun) return false;

  // if pile is empty, any uniform play or run is allowed
  if (pileCount === 0) return true;

  // If 10 rule is active, check direction constraint
  if (tenRule?.active && tenRule.direction) {
    if (!allSameValue(cards)) return false; // 10 rule only applies to same-value plays
    const pileRank = rankIndex(pile[0].value);
    const playRank = rankIndex(cards[0].value);
    
    if (tenRule.direction === "higher") {
      return playRank > pileRank; // Must be strictly higher
    } else if (tenRule.direction === "lower") {
      return playRank < pileRank; // Must be strictly lower
    }
  }

  // Runs must match runs (same length, higher starting value)
  if (isPileRun) {
    if (!isPlayRun) return false;
    if (playCount !== pileCount) return false;
    
    // Compare starting values of runs
    const pileStart = rankIndex(pile[0].value);
    const playStart = rankIndex(cards[0].value);
    return playStart > pileStart;
  }

  // Regular play: must match the count
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

export function containsTen(cards: Card[]) {
  return cards.some((c) => c.value === 10);
}

export function isJoker(card: Card) {
  return card.value === 15 && card.suit === "joker";
}

export function isSingleJoker(cards: Card[]) {
  return cards.length === 1 && isJoker(cards[0]);
}

export function isFourOfAKind(cards: Card[]) {
  if (!cards || cards.length !== 4) return false;
  const v = cards[0].value;
  return cards.every((c) => c.value === v);
}

export function isRun(cards: Card[]): boolean {
  if (!cards || cards.length < 3) return false;
  
  // Sort cards by rank index
  const sorted = [...cards].sort((a, b) => rankIndex(a.value) - rankIndex(b.value));
  
  // Check if consecutive
  for (let i = 1; i < sorted.length; i++) {
    const prevRank = rankIndex(sorted[i - 1].value);
    const currRank = rankIndex(sorted[i].value);
    if (currRank !== prevRank + 1) return false;
  }
  
  return true;
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

// AI function to find the best valid play for a CPU player
export function findCPUPlay(hand: Card[], pile: Card[], tenRule?: { active: boolean; direction: "higher" | "lower" | null }): Card[] | null {
  if (!hand || hand.length === 0) return null;

  const pileCount = pile.length;
  
  // Check if we have a single joker - it can beat anything
  const jokerCard = hand.find(c => isJoker(c));
  if (jokerCard && pileCount > 0) {
    // Consider playing joker if we don't have better options
    // For now, save joker as last resort
  }
  
  // Group cards by value
  const grouped: { [key: number]: Card[] } = {};
  hand.forEach(card => {
    if (!grouped[card.value]) grouped[card.value] = [];
    grouped[card.value].push(card);
  });

  // If pile is empty, play lowest value cards
  // Special case: if we have 3 of clubs, we must play it (with other 3s if we have them)
  if (pileCount === 0) {
    const threeOfClubs = hand.find(c => c.value === 3 && c.suit === "clubs");
    if (threeOfClubs) {
      // Play all 3s we have
      return grouped[3] || [threeOfClubs];
    }
    
    const lowestValue = Math.min(...Object.keys(grouped).map(Number));
    const lowestCards = grouped[lowestValue];
    // Try to play as many of the lowest as possible (prioritize clearing cards)
    return lowestCards;
  }

  // Pile has cards - we need to match the count and beat the value
  const pileValue = pile[0].value;
  const pileRankIndex = rankIndex(pileValue);
  
  // Check if pile is a run
  const isPileRun = pile.length >= 3 && isRun(pile);

  // Find valid plays: same count, higher rank
  const validPlays: Card[][] = [];
  
  // If pile is a run, we need to find runs in our hand
  if (isPileRun) {
    const runLength = pile.length;
    const pileStartRank = rankIndex(pile[0].value);
    
    // Try to find consecutive runs of the required length
    const sortedHand = [...hand].sort((a, b) => rankIndex(a.value) - rankIndex(b.value));
    
    for (let i = 0; i <= sortedHand.length - runLength; i++) {
      const potentialRun = sortedHand.slice(i, i + runLength);
      if (isRun(potentialRun)) {
        const runStartRank = rankIndex(potentialRun[0].value);
        if (runStartRank > pileStartRank) {
          validPlays.push(potentialRun);
        }
      }
    }
  } else {
    // Normal play: match count and beat value
    Object.keys(grouped).forEach(valueStr => {
      const value = Number(valueStr);
      const cards = grouped[value];
      
      // Check if we have enough cards of this value
      if (cards.length >= pileCount) {
        const valueRankIndex = rankIndex(value);
        
        // Apply 10 rule constraints if active
        if (tenRule?.active && tenRule.direction) {
          if (tenRule.direction === "higher" && valueRankIndex <= pileRankIndex) {
            return; // Skip this value
          }
          if (tenRule.direction === "lower" && valueRankIndex >= pileRankIndex) {
            return; // Skip this value
          }
        } else {
          // Normal rule: check if this value beats the pile
          if (valueRankIndex <= pileRankIndex) {
            return; // Skip this value
          }
        }
        
        validPlays.push(cards.slice(0, pileCount));
      }
    });
  }
  
  // If no valid plays found and we have a joker, play it
  if (validPlays.length === 0 && jokerCard) {
    return [jokerCard];
  }

  if (validPlays.length === 0) return null;

  // Strategy: Play the lowest valid card to conserve high cards
  validPlays.sort((a, b) => rankIndex(a[0].value) - rankIndex(b[0].value));
  return validPlays[0];
}

export function passTurn(state: GameState, playerId: string): GameState {
  const pIndex = state.players.findIndex((p) => p.id === playerId);
  if (pIndex === -1) return state;
  if (state.currentPlayerIndex !== pIndex) return state;

  // If the current player is required to play (leader), they cannot pass
  if (state.mustPlay) return state;

  const player = state.players[pIndex];

  // Track this pass in current trick
  if (!state.currentTrick) {
    state.currentTrick = { trickNumber: (state.trickHistory?.length || 0) + 1, actions: [] };
  }
  state.currentTrick.actions.push({
    type: "pass",
    playerId: player.id,
    playerName: player.name,
    timestamp: Date.now(),
  });

  state.passCount += 1;
  // Use nextActivePlayerIndex to skip finished players
  state.currentPlayerIndex = nextActivePlayerIndex(state, pIndex);

  // if all other active players passed, clear the pile and winner leads next
  const activePlayers = state.players.filter(p => !state.finishedOrder.includes(p.id));
  if (state.passCount >= activePlayers.length - 1) {
    state.pile = [];
    state.passCount = 0;
    const winner = state.lastPlayPlayerIndex ?? null;
    if (winner !== null && winner >= 0 && !state.finishedOrder.includes(state.players[winner].id)) {
      state.currentPlayerIndex = winner;
      state.mustPlay = true;
      // End trick - winner is the last player who played
      const winnerPlayer = state.players[winner];
      state.currentTrick.winnerId = winnerPlayer.id;
      state.currentTrick.winnerName = winnerPlayer.name;
      state.trickHistory = state.trickHistory || [];
      state.trickHistory.push(state.currentTrick);
      state.currentTrick = { trickNumber: state.trickHistory.length + 1, actions: [] };
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
