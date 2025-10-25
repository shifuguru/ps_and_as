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
  pileOwners?: string[]; // parallel array to pileHistory recording which player played each entry
  tableStacks?: Card[][]; // completed trick plays stacked/face-down
  tableStackOwners?: (string | null)[];
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
  fourOfAKindChallenge?: {
    active: boolean;
    value: number; // rank value of the four-of-a-kind that started the challenge
    starterIndex: number; // player index who started the 4-of-a-kind
  };
  // Tracks the last clearing play type within the current trick so we can
  // enforce precedence (joker > four-of-a-kind challenge > two)
  lastClear?: {
    type: "joker" | "two" | "four" | null;
    value?: number;
    playerIndex?: number;
  };
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
  pileOwners: [],
    tableStacks: [],
    tableStackOwners: [],
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

  // If the player already passed in the current trick, they have forfeited
  // the rest of this trick and cannot play again until the pile is cleared
  // and a new trick begins. We check currentTrick actions for a prior pass.
  if (state.currentTrick && state.currentTrick.actions.some(a => a.type === 'pass' && a.playerId === playerId)) {
    // invalid: player already passed this trick
    return state;
  }

  const player = state.players[pIndex];
  // check that player has all cards
  for (const c of cards) {
    const found = player.hand.findIndex((h) => h.suit === c.suit && h.value === c.value);
    if (found === -1) return state;
  }

  // Special validation for the very first play of the entire game only.
  // Previously this checked only for an empty pile/pileHistory which caused
  // later trick-clears (four-of-a-kind/2/joker) to be mistaken for the game's
  // opening play. To avoid that, require that there is no trick history and
  // the current trick has no recorded actions.
  const isFirstPlay =
    state.pile.length === 0 &&
    (!state.pileHistory || state.pileHistory.length === 0) &&
    (!state.trickHistory || state.trickHistory.length === 0) &&
    (!!state.currentTrick && state.currentTrick.actions.length === 0);

  if (isFirstPlay) {
    // First play must include the 3 of clubs
    const hasThreeOfClubs = cards.some((c) => c.value === 3 && c.suit === "clubs");
    if (!hasThreeOfClubs) return state;

    // All cards must be 3s (can play 3♣ alone or with other 3s)
    const allThrees = cards.every((c) => c.value === 3);
    if (!allThrees) return state;
  }

  // all played cards must have the same value OR be a valid run
  const isPlayRun = isRun(cards);
  if (!allSameValue(cards) && !isPlayRun) return state;

  // Compute effective pile/run for contextual rule checks (e.g., tens shouldn't
  // trigger the ten-rule when the active pile is a run formed by consecutive
  // single-card plays).
  const effPileForContext = effectivePile(state.pile, state.pileHistory);
  const isPileRunForContext = effPileForContext && effPileForContext.length >= 3 && isRun(effPileForContext);

  // Validate play type: must play same number of cards as pile (unless pile is empty)
  // Enforce clear precedence: if this play is a 2 and the current trick already
  // contains a Joker or an active four-of-a-kind clear, reject it. We also use
  // state.lastClear to track the highest-clear type in the current trick.
  if (containsTwo(cards)) {
    if (state.lastClear?.type === "joker" || state.lastClear?.type === "four") {
      return state; // 2 cannot override a Joker or a four-of-a-kind clear in the same trick
    }
  }

  if (!isValidPlay(cards, state.pile, state.tenRule, state.pileHistory, state.fourOfAKindChallenge)) return state;

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

  // Two and single Joker still immediately end/clear the pile. Four-of-a-kind
  // starts a special challenge: the next player must play another set of four
  // of a higher rank or a Joker to beat it. We therefore don't automatically
  // end the trick on a four-of-a-kind; instead we activate a challenge state.
  let trickEnded = false;
  // Only a single Joker is an absolute clear type, but to make the UI more
  // pleasant we don't finalize the trick immediately. Instead we record the
  // Joker as the last clear and leave it on the pile so other players can
  // visibly see it and choose to pass before the trick is concluded.

  // Check if 10 was played - will need user input for direction
  const playedTen = containsTen(cards);
  // Do not activate the 10-rule when the active pile is a run. Tens are
  // explicitly excluded from influencing runs.
  if (playedTen && !state.tenRule?.active && !isPileRunForContext) {
    // 10 rule is being activated - add cards to pile but pause for player input
    state.pile = cards;
    state.pileHistory = state.pileHistory || [];
    state.pileHistory.push(cards.slice());
    state.pileOwners = state.pileOwners || [];
    state.pileOwners.push(player.id);
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
    // set lastClear to two (unless a higher clear is already present, which
    // should have been rejected earlier)
    state.lastClear = { type: "two", value: 2, playerIndex: pIndex };
    // Clear the physical pile so subsequent plays start from empty, but do
    // not immediately finalize the trick. Advance to the next active player
    // so they may choose to play or pass. This prevents an automatic win/lock
    // when a 2 is played and gives human players the option to pass.
    state.pile = [];
    state.pileHistory = [];
    state.pileOwners = [];
    state.passCount = 0;
    // When a 2 clears the pile we treat the table as reset: previous pass
    // records should no longer block players from playing again. To achieve
    // that we reset the currentTrick to a fresh, empty trick. This keeps the
    // UI/gameflow consistent: players who passed earlier can now play after
    // the clear.
    state.currentTrick = { trickNumber: (state.trickHistory?.length || 0) + 1, actions: [] };
    state.currentPlayerIndex = nextActivePlayerIndex(state, pIndex);
    state.mustPlay = false;
  } else if (isFourOfAKind(cards)) {
    // Start or respond to a four-of-a-kind challenge.
    // If a challenge is already active, a higher four-of-a-kind beats it.
    if (state.fourOfAKindChallenge && state.fourOfAKindChallenge.active) {
      const challengeVal = state.fourOfAKindChallenge.value;
      const playRank = rankIndex(cards[0].value);
      const challengeRank = rankIndex(challengeVal);
      if (playRank > challengeRank) {
  // This higher four-of-a-kind beats the challenge: clear the pile and end trick
  state.lastClear = { type: "four", value: cards[0].value, playerIndex: pIndex };
  state.pile = [];
  state.pileHistory = [];
  state.pileOwners = [];
        state.passCount = 0;
        state.currentPlayerIndex = pIndex;
        state.mustPlay = true;
        // deactivate challenge (we will finalize winner below via trickEnded handling)
        state.fourOfAKindChallenge = undefined;
        trickEnded = true;
      } else {
        // Not high enough to beat the current challenge -> invalid, but should
        // have been rejected already by isValidPlay. Return state defensively.
        return state;
      }
    } else {
      // No active challenge: activate one. The next player must respond with a
      // higher four-of-a-kind or a Joker.
  state.pile = cards;
  state.pileHistory = state.pileHistory || [];
  state.pileHistory.push(cards.slice());
  state.pileOwners = state.pileOwners || [];
  state.pileOwners.push(player.id);
      state.passCount = 0;
      state.fourOfAKindChallenge = { active: true, value: cards[0].value, starterIndex: pIndex };
      // record that a four-of-a-kind clear is the last clear in this trick
      state.lastClear = { type: "four", value: cards[0].value, playerIndex: pIndex };
      // advance to next player who must play according to the challenge
      state.currentPlayerIndex = nextActivePlayerIndex(state, pIndex);
      state.mustPlay = true;
      // do not finalize trick here; wait for response or passes
      return { ...state };
    }
  } else if (isSingleJoker(cards)) {
    // Single joker: beats an active four-of-a-kind challenge immediately
    // (joker > four-of-a-kind). For that case we should finalize the trick
    // now so the joker player wins the trick. Otherwise, place the joker on
    // the pile and allow visible passing by other players.
    if (state.fourOfAKindChallenge && state.fourOfAKindChallenge.active) {
      // Joker resolves the challenge and ends the trick in favor of the joker player
      state.lastClear = { type: "joker", value: 15, playerIndex: pIndex };
      state.pile = cards;
      state.pileHistory = state.pileHistory || [];
      state.pileHistory.push(cards.slice());
      state.pileOwners = state.pileOwners || [];
      state.pileOwners.push(player.id);
      state.passCount = 0;
      // Clear the challenge state; will be finalized below by trickEnded handling
      state.fourOfAKindChallenge = undefined;
      trickEnded = true;
      // ensure winner selection logic uses the joker player (pIndex)
      state.currentPlayerIndex = pIndex;
      state.mustPlay = true;
    } else {
      // Place the joker on the pile/history so UI can show it and allow visible passing
      state.lastClear = { type: "joker", value: 15, playerIndex: pIndex };
      state.pile = cards;
      state.pileHistory = state.pileHistory || [];
      state.pileHistory.push(cards.slice());
      state.pileOwners = state.pileOwners || [];
      state.pileOwners.push(player.id);
      state.passCount = 0;
      // Advance to the next active player so they can respond or pass
      state.currentPlayerIndex = nextActivePlayerIndex(state, pIndex);
      // Do not force mustPlay: allow visible passing
      state.mustPlay = false;
    }
  } else {
    // normal play replaces the pile
    state.pile = cards;
    // record this play in history
    state.pileHistory = state.pileHistory || [];
  state.pileHistory.push(cards.slice());
  state.pileOwners = state.pileOwners || [];
  state.pileOwners.push(player.id);
    state.passCount = 0;
    // advance from the player who just played
    state.currentPlayerIndex = nextActivePlayerIndex(state, pIndex);
    state.mustPlay = false;
  }

  // if trick ended with special card, record winner and start new trick
  if (trickEnded) {
    try { console.log(`[core] trickEnded in playCards by playerIndex=${pIndex} playerId=${player.id} playerName=${player.name} lastPlayPlayerIndex=${state.lastPlayPlayerIndex}`); } catch (e) {}
    state.currentTrick.winnerId = player.id;
    state.currentTrick.winnerName = player.name;
    state.trickHistory = state.trickHistory || [];
    // Move any existing visible pile plays into the table stack (face-down)
    if (state.pileHistory && state.pileHistory.length > 0) {
      state.tableStacks = state.tableStacks || [];
      state.tableStackOwners = state.tableStackOwners || [];
      for (let i = 0; i < state.pileHistory.length; i++) {
        state.tableStacks.push(state.pileHistory[i]);
        state.tableStackOwners.push((state.pileOwners && state.pileOwners[i]) ? state.pileOwners[i] : null);
      }
      state.pileHistory = [];
      state.pileOwners = [];
    }
    state.trickHistory.push(state.currentTrick);
    state.currentTrick = { trickNumber: state.trickHistory.length + 1, actions: [] };
    // Ensure the winner leads the next trick
    try { console.log(`[core] setting currentPlayerIndex to winner pIndex=${pIndex} (playerId=${player.id})`); } catch(e){}
    state.currentPlayerIndex = pIndex;
    state.mustPlay = true;
    // Clear lastClear as the trick has concluded
    state.lastClear = undefined;
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

// Determine the effective pile for run detection: either the current pile if it
// is already a run of length>=3, or the concatenation of last single-card plays
// from pileHistory (chronological) if those form a run. This lets sequences like
// [3],[4],[5] be treated as an active 3-card run even though state.pile is [5].
export function effectivePile(pile: Card[], pileHistory?: Card[][]): Card[] {
  try {
    if (pile && pile.length >= 3 && isRun(pile)) return pile;
    if (!pileHistory || pileHistory.length === 0) return pile;

    const collected: Card[] = [];
    // walk backwards through history collecting consecutive single-card plays
    for (let i = pileHistory.length - 1; i >= 0; i--) {
      const entry = pileHistory[i];
      if (!entry || entry.length !== 1) break;
      const c = entry[0];
      // Ten and Joker cannot form part of a run
      if (c.value === 10 || c.value === 15) break;
      collected.push(c);
    }
    // collected is reverse chronological (newest first) -> reverse to chronological
    collected.reverse();
    if (collected.length >= 3 && isRun(collected)) {
      try { console.log(`[core] effectivePile detected run from pileHistory: ${collected.map(c=>c.value).join(',')}`); } catch (e) {}
      return collected;
    }
    return pile;
  } catch (e) {
    return pile;
  }
}

// Helper: compute next active player index given players array and finishedOrder
export function nextActiveIndexFromList(players: Player[], finishedOrder: string[], fromIndex: number) {
  const n = players.length;
  if (n === 0) return 0;
  for (let i = 1; i <= n; i++) {
    const idx = (fromIndex + i) % n;
    const p = players[idx];
    if (!finishedOrder.includes(p.id)) return idx;
  }
  return fromIndex;
}

// Check whether a given player has already passed in the current trick
export function hasPassedInCurrentTrick(state: GameState, playerId: string) {
  if (!state.currentTrick) return false;
  return state.currentTrick.actions.some(a => a.type === 'pass' && a.playerId === playerId);
}

// Build an effective run formed by consecutive single-card plays from the current trick.
// We only consider the tail of currentTrick.actions where each action is a single-card play
// and each play was made by the next active player after the previous one.
export function runFromCurrentTrick(currentTrick?: TrickHistory, players?: Player[], finishedOrder: string[] = []): Card[] {
  if (!currentTrick || !players) return [];
  const actions = currentTrick.actions;
  if (!actions || actions.length === 0) return [];
  const collected: Card[] = [];
  const playerIdxs: number[] = [];

  // Iterate backwards over actions to build the tail of consecutive single-card plays.
  // We collect them in chronological order by prepending earlier actions.
  for (let i = actions.length - 1; i >= 0; i--) {
    const a = actions[i];
    // stop if not a single-card play
    if (a.type !== 'play' || !a.cards || a.cards.length !== 1) break;
    const card = a.cards[0];
    // Ten and Joker cannot form part of a run
    if (card.value === 10 || isJoker(card)) break;
    const pIndex = players.findIndex((p) => p.id === a.playerId);
    if (pIndex === -1) break;

    if (collected.length === 0) {
      // newest play -> will become the last element in chronological array
      collected.unshift(card);
      playerIdxs.unshift(pIndex);
    } else {
      // For the earlier action to be part of the run, its next active player
      // (skipping finished players) must equal the previously collected player's index
  const expectedNext = nextActiveIndexFromList(players, finishedOrder, pIndex);
  // The previously collected player's index (the one immediately after this action
  // in chronological order) will be at the front of the playerIdxs array because
  // we unshift earlier actions. Compare against the first element, not the last.
  if (expectedNext !== playerIdxs[0]) break;
      // prepend the earlier action so collected remains chronological
      collected.unshift(card);
      playerIdxs.unshift(pIndex);
    }
  }

  if (collected.length >= 3 && isRun(collected)) return collected;
  if (collected.length >= 3 && isRun(collected)) {
    try { console.log(`[core] runFromCurrentTrick detected run: ${collected.map(c=>c.value).join(',')} players=${playerIdxs.join(',')}`); } catch(e) {}
    return collected;
  }
  return [];
}

export function isValidPlay(cards: Card[], pile: Card[], tenRule?: { active: boolean; direction: "higher" | "lower" | null }, pileHistory?: Card[][], fourOfAKindChallenge?: { active: boolean; value: number; starterIndex: number }, currentTrick?: TrickHistory, players?: Player[], finishedOrder?: string[]) {
  // empty play not allowed
  if (!cards || cards.length === 0) return false;

  const playCount = getPlayCount(cards);
  const pileCount = getPlayCount(pile);

  // Defensive: prevent joker-on-joker plays. A single joker cannot beat an
  // active pile that already contains a joker.
  if (isSingleJoker(cards) && pileCount > 0 && pile.some(c => isJoker(c))) return false;

  // Check if it's a run
  const isPlayRun = isRun(cards);
  // detect runs that may be formed across recent single-card plays
  // Prefer run made by consecutive players in current trick; fall back to pileHistory heuristic
  let effPile: Card[] = effectivePile(pile, pileHistory);
  const trickRun = runFromCurrentTrick(currentTrick, players, finishedOrder || []);
  if (trickRun && trickRun.length >= 3) {
    effPile = trickRun;
  }
  const isPileRun = effPile.length >= 3 && isRun(effPile);

  // If a four-of-a-kind challenge is active, only allow another four-of-a-kind
  // that is strictly higher, or a single Joker. Everything else must pass.
  if (fourOfAKindChallenge?.active) {
    const challengeVal = fourOfAKindChallenge.value;
    // Joker beats the challenge
    if (isSingleJoker(cards)) return true;
    // only a 4-of-a-kind of the same count and higher rank can beat it
    if (isFourOfAKind(cards)) {
      const playRank = rankIndex(cards[0].value);
      const challengeRank = rankIndex(challengeVal);
      return playRank > challengeRank;
    }
    return false;
  }

  // Single joker can beat anything (including doubles, triples, quads)
  if (isSingleJoker(cards) && pileCount > 0) {
    // A joker cannot beat another joker. If the active pile already contains
    // a joker, reject another joker play. Otherwise a single joker beats
    // other plays.
    if (pile.some(c => isJoker(c))) return false;
    return true;
  }

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
    // Runs have extra restrictions: Ten and Joker cannot be used in runs
    if (cards.some(c => c.value === 10 || c.value === 15)) return false;

    // If the play is a run, it must match length and have a higher starting value
    if (isPlayRun) {
      if (playCount !== effPile.length) return false;
      // Compare starting values of runs using the minimal (start) rank index
      const pileStart = rankIndex(effPile[0].value);
      const playStart = rankIndex(cards[0].value);
      return playStart > pileStart;
    }

    // Allow single-card adjacency plays when the pile is a run: the single card
    // must be exactly one rank above or below the last card of the run.
    if (playCount === 1) {
      const lastCard = effPile[effPile.length - 1];
      const lastRank = rankIndex(lastCard.value);
      const playRank = rankIndex(cards[0].value);
      return Math.abs(playRank - lastRank) === 1;
    }

    return false;
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

// Validate a run according to the project's SPEC:
// - A run consists of L >= 3 distinct consecutive ranks
// - Each rank must appear with the same multiplicity m (e.g., singles, pairs, trips)
// - 2s, 10s and Jokers are not allowed in runs
// - Suits are irrelevant
// - No wrapping beyond Ace (K-A is allowed because rankIndex reflects A after K)
export function isRun(cards: Card[]): boolean {
  if (!cards || cards.length === 0) return false;

  // Build frequency map for each rank value
  const freq: { [value: number]: number } = {};
  for (const c of cards) {
    // Disallow tens and jokers (and 2s) from being part of runs
    if (c.value === 10 || c.value === 15 || c.value === 2) return false;
    freq[c.value] = (freq[c.value] || 0) + 1;
  }

  const uniqueValues = Object.keys(freq).map(Number);
  // Need at least 3 distinct ranks to form a run
  if (uniqueValues.length < 3) return false;

  // All multiplicities must be equal
  const multiplicities = Object.values(freq);
  const m = multiplicities[0];
  if (!multiplicities.every((x) => x === m)) return false;

  // Total cards must equal m * L
  const L = uniqueValues.length;
  if (cards.length !== m * L) return false;

  // Sort unique ranks by rankIndex and ensure they are consecutive
  const sortedUnique = uniqueValues.sort((a, b) => rankIndex(a) - rankIndex(b));
  for (let i = 1; i < sortedUnique.length; i++) {
    const prev = rankIndex(sortedUnique[i - 1]);
    const cur = rankIndex(sortedUnique[i]);
    if (cur !== prev + 1) return false;
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
export function findCPUPlay(hand: Card[], pile: Card[], tenRule?: { active: boolean; direction: "higher" | "lower" | null }, pileHistory?: Card[][], fourOfAKindChallenge?: { active: boolean; value: number; starterIndex: number }, currentTrick?: TrickHistory, players?: Player[], finishedOrder?: string[]): Card[] | null {
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
  
  // Check if pile is a run (consider run formed across pileHistory or current trick)
  let effPile = effectivePile(pile, pileHistory);
  const trickRun = runFromCurrentTrick(currentTrick, players, finishedOrder || []);
  if (trickRun && trickRun.length >= 3) effPile = trickRun;
  const isPileRun = effPile.length >= 3 && isRun(effPile);

  // If a four-of-a-kind challenge is active, only try to play a higher
  // four-of-a-kind or a Joker.
  if (fourOfAKindChallenge?.active) {
    const groupedVals = Object.keys(grouped).map(Number).sort((a, b) => rankIndex(a) - rankIndex(b));
    // Try to find any four-of-a-kind higher than the challenge
    const challengeRank = rankIndex(fourOfAKindChallenge.value);
    for (const v of groupedVals) {
      const cards = grouped[v];
      if (cards.length >= 4 && rankIndex(v) > challengeRank) {
        return cards.slice(0, 4);
      }
    }
    // If no higher set, play Joker if we have one
    const jokerCard = hand.find(c => isJoker(c));
    if (jokerCard) return [jokerCard];
    return null;
  }

  // Find valid plays: same count, higher rank
  const validPlays: Card[][] = [];
  
  // If pile is a run, we need to find runs in our hand
  if (isPileRun) {
    const runLength = effPile.length;
    const pileStartRank = rankIndex(effPile[0].value);
    
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

    // If no same-length run found, as a fallback allow single-card adjacency plays
    // where a single card must be exactly one rank above or below the last card
    // of the current run. Also, Ten and Joker are not allowed during runs.
    if (validPlays.length === 0) {
      const lastRank = rankIndex(effPile[effPile.length - 1].value);
      const adjCard = hand.find(c => {
        const r = rankIndex(c.value);
        if (c.value === 10 || c.value === 15) return false; // disallow ten/joker in runs
        return Math.abs(r - lastRank) === 1;
      });
  if (adjCard) validPlays.push([adjCard]);
    }
  } else {
    // Normal play: match count and beat value
    Object.keys(grouped).forEach(valueStr => {
      const value = Number(valueStr);
      const cards = grouped[value];
      // Skip joker group for normal grouped-matching logic. Jokers are handled as a
      // special single-card fallback (one joker is sufficient to beat any pile).
      if (value === 15) return;
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
    // Don't play a joker on top of an existing joker
    if (pile && pile.some(c => isJoker(c))) return null;
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

  try {
    console.log(`[core] passTurn ENTRY playerId=${playerId} currentPlayerIndex=${state.currentPlayerIndex} lastPlayPlayerIndex=${state.lastPlayPlayerIndex} passCount=${state.passCount}`);
    if (state.currentTrick) console.log(`[core] currentTrick.actions.length=${state.currentTrick.actions.length}`);
  } catch (e) {}

  // If the current player is required to play (leader), normally they cannot pass.
  // However, if they truly have no valid play available (e.g., mustPlay but no valid cards to beat the pile),
  // allow the pass to avoid deadlock. use findCPUPlay as a helper to detect any possible valid play.
  if (state.mustPlay) {
    const player = state.players[pIndex];
    // If mustPlay is set because of a Joker clear, allow players to pass
    // even if they technically have a valid play. This lets the Joker remain
    // visible and others to pass out, finalizing the trick in favor of the Joker.
    if (!(state.lastClear && state.lastClear.type === 'joker')) {
      const possible = findCPUPlay(player.hand, state.pile, state.tenRule, state.pileHistory, state.fourOfAKindChallenge, state.currentTrick, state.players, state.finishedOrder);
      if (possible === null) {
        // no valid plays available - allow pass to prevent the game getting stuck
        console.warn(`[core] mustPlay but no valid play for player ${player.name} (${player.id}) - allowing pass to avoid deadlock`);
        // continue to execute pass logic below
      } else {
        return state; // player has at least one valid play and therefore cannot pass
      }
    }
  }

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

  // Recompute passed players from currentTrick actions (distinct ids)
  const passedIds = new Set(state.currentTrick.actions.filter(a => a.type === 'pass').map(a => a.playerId));
  state.passCount = passedIds.size; // keep passCount in sync

  // Use nextActivePlayerIndex to skip finished players for the next turn (tentative)
  state.currentPlayerIndex = nextActivePlayerIndex(state, pIndex);

  // Determine active players for the trick (not finished)
  const activePlayerIds = state.players.filter(p => !state.finishedOrder.includes(p.id)).map(p => p.id);

  // Who last played? That player is considered the leader for this trick
  const leaderIndex = state.lastPlayPlayerIndex ?? null;
  const leaderId = (leaderIndex !== null && leaderIndex >= 0) ? state.players[leaderIndex].id : null;

  // If all other active players (i.e., everyone except the leader) have passed,
  // the trick ends: clear the pile, winner leads next trick, and record the trick.
  if (leaderId !== null) {
    const others = activePlayerIds.filter(id => id !== leaderId);
    const allOthersPassed = others.length === 0 || others.every(id => passedIds.has(id));
    // Debug: log pass/finalization decision
    try {
      console.log(`[core] passTurn debug: leaderIndex=${leaderIndex}, leaderId=${leaderId}, active=${JSON.stringify(activePlayerIds)}, passed=${JSON.stringify(Array.from(passedIds))}, others=${JSON.stringify(others)}, allOthersPassed=${allOthersPassed}`);
    } catch (e) {}
    if (allOthersPassed) {
        state.pile = [];
        state.passCount = 0;
        // Move any existing visible pile plays into the table stack (face-down)
        if (state.pileHistory && state.pileHistory.length > 0) {
          state.tableStacks = state.tableStacks || [];
          state.tableStackOwners = state.tableStackOwners || [];
          for (let i = 0; i < state.pileHistory.length; i++) {
            state.tableStacks.push(state.pileHistory[i]);
            state.tableStackOwners.push((state.pileOwners && state.pileOwners[i]) ? state.pileOwners[i] : null);
          }
          state.pileHistory = [];
          state.pileOwners = [];
        }
        // Clear per-trick 'clear' state so the next trick is evaluated fresh.
        // Previously leftover flags (e.g., lastClear === 'joker') could block
        // normal plays like a 2 on the next trick. Resetting them here prevents
        // stale state from leaking across trick boundaries.
        state.lastClear = undefined;
        state.fourOfAKindChallenge = undefined;
        state.tenRule = { active: false, direction: null };
        state.tenRulePending = false;
        // winner is the last player who played (leaderIndex)
        if (leaderIndex !== null && leaderIndex >= 0) {
          // Record the trick winner even if that player has just finished.
          const winnerPlayer = state.players[leaderIndex];
          state.currentTrick.winnerId = winnerPlayer.id;
          state.currentTrick.winnerName = winnerPlayer.name;
          state.trickHistory = state.trickHistory || [];
          state.trickHistory.push(state.currentTrick);
          state.currentTrick = { trickNumber: state.trickHistory.length + 1, actions: [] };
          // If the winner still has cards, they lead the next trick; otherwise
          // advance to the next active player after the winner.
          if (!state.finishedOrder.includes(winnerPlayer.id)) {
            state.currentPlayerIndex = leaderIndex;
            state.mustPlay = true;
          } else {
            // Advance from the winner's index to the next active player so the
            // next trick is led by the correct player (not an earlier passer).
            state.currentPlayerIndex = nextActivePlayerIndex(state, leaderIndex);
            state.mustPlay = false;
          }
        }
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
