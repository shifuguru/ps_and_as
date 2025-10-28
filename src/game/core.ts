// core.ts
// Core game state and logic for Presidents & Assholes
import { Card, Player, createDeck, shuffleDeck, dealCards } from "./ruleset";

// RULE: Single-rank-per-turn variant (no multi-card straights as a single play)
export const SINGLE_RANK_PER_TURN = true;

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
    // Player already passed this trick — treat an attempted play as a no-op
    // and record a pass move instead to advance the turn and avoid callers
    // repeatedly attempting the same invalid play (which can cause loops
    // in automated simulations).
    return passTurn(state, playerId);
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

  // RULE: a single turn may ONLY play one rank repeated N times (1–4)
  if (!allSameValue(cards)) return state;

  // Compute effective pile/run for contextual rule checks (e.g., tens shouldn't
  // trigger the ten-rule when the active pile is a run formed by consecutive
  // single-card plays).
  const effPileForContext = effectivePile(state.pile, state.pileHistory);
  const isPileRunForContext = effPileForContext && effPileForContext.length >= 3 && isRunContextSequence(effPileForContext);

  // Validate play type: must play same number of cards as pile (unless pile is empty)
  // Enforce clear precedence: if this play is a 2 and the current trick already
  // contains a Joker or an active four-of-a-kind clear, reject it. We also use
  // state.lastClear to track the highest-clear type in the current trick.
  if (containsTwo(cards)) {
    if (state.lastClear?.type === "joker" || state.lastClear?.type === "four") {
      return state; // 2 cannot override a Joker or a four-of-a-kind clear in the same trick
    }
  }

  if (!isValidPlay(cards, state.pile, state.tenRule, state.pileHistory, state.fourOfAKindChallenge)) {
    // If the attempted play is invalid and the player is required to play,
    // check whether the player truly has any valid alternative play. If no
    // valid plays exist, convert this attempted play into a pass to avoid
    // infinite retry loops by automated callers (CPUs) that repeatedly
    // attempt the same invalid move.
    if (state.mustPlay) {
      const possible = findCPUPlay(
        player.hand,
        state.pile,
        state.tenRule,
        state.pileHistory,
        state.fourOfAKindChallenge,
        state.currentTrick,
        state.players,
        state.finishedOrder
      );
      // If no possible play, or the best possible play is also invalid,
      // allow the player to pass so the game can progress.
      if (possible === null || !isValidPlay(possible, state.pile, state.tenRule, state.pileHistory, state.fourOfAKindChallenge)) {
        return passTurn(state, playerId);
      }
    }
    return state;
  }

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
  } else if (
    // Closing to quads across turns: pile has 1-3 of a value, and we play the
    // remaining copies of the same value to reach exactly 4, which starts the
    // four-of-a-kind challenge.
    state.pile.length > 0 &&
    state.pile.length < 4 &&
    allSameValue(state.pile) &&
    allSameValue(cards) &&
    cards[0].value === state.pile[0].value &&
    (state.pile.length + cards.length === 4)
  ) {
    // combine to visible four-of-a-kind on the pile for UI clarity
    const combined = [...state.pile, ...cards];
    // record the play in history and ownership
    state.pileHistory = state.pileHistory || [];
    state.pileHistory.push(cards.slice());
    state.pileOwners = state.pileOwners || [];
    state.pileOwners.push(player.id);
    state.pile = combined;
    state.passCount = 0;
    // Activate challenge for next player
    state.fourOfAKindChallenge = { active: true, value: cards[0].value, starterIndex: pIndex };
    state.lastClear = { type: "four", value: cards[0].value, playerIndex: pIndex };
    state.currentPlayerIndex = nextActivePlayerIndex(state, pIndex);
    state.mustPlay = true;
    return { ...state };
  } else if (isSingleJoker(cards)) {
    // Single Joker sets a "highest clear" state but does not immediately
    // finalize the trick. Other players must actively pass; when all others
    // pass, the leader (joker player) wins via passTurn logic.
    state.lastClear = { type: "joker", value: 15, playerIndex: pIndex };
    state.pile = cards;
    state.pileHistory = state.pileHistory || [];
    state.pileHistory.push(cards.slice());
    state.pileOwners = state.pileOwners || [];
    state.pileOwners.push(player.id);
    state.passCount = 0;
    // Resolve any active four-of-a-kind challenge
    if (state.fourOfAKindChallenge && state.fourOfAKindChallenge.active) {
      state.fourOfAKindChallenge = undefined;
    }
    // Do NOT clear prior pass actions. Once a player has passed on this trick,
    // they remain ineligible to play until the trick ends.
    // Advance to next active player so others may pass
    state.currentPlayerIndex = nextActivePlayerIndex(state, pIndex);
    state.mustPlay = false;
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
    // Clear the visible pile immediately so the next trick starts clean
    state.pile = [];
    state.passCount = 0;
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
    // Reset any 10 rule/challenge markers so UI/game type doesn't stick
    state.tenRule = { active: false, direction: null };
    state.tenRulePending = false;
    state.fourOfAKindChallenge = undefined;
  }

  // if player emptied hand, add to finished
  if (player.hand.length === 0 && !state.finishedOrder.includes(player.id)) {
    state.finishedOrder.push(player.id);
  }

  // Defensive: if trick finalization or plays caused other players to have
  // empty hands but they weren't recorded (edge cases during multi-card
  // clears or mirrored runtime differences), ensure finishedOrder contains
  // every player who currently has an empty hand to prevent them remaining
  // active and producing infinite-pass loops in simulations.
  for (const p of state.players) {
    if (p.hand.length === 0 && !state.finishedOrder.includes(p.id)) {
      state.finishedOrder.push(p.id);
    }
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
      // Joker cannot form part of a run context; 10 is allowed for context
      if (c.value === 15) break;
      collected.push(c);
    }
    // collected is reverse chronological (newest first) -> reverse to chronological
    collected.reverse();
    if (collected.length >= 3 && isRunContextSequence(collected)) {
      try { console.log(`[core] effectivePile detected run (context) from pileHistory: ${collected.map(c=>c.value).join(',')}`); } catch (e) {}
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
  // Joker cannot form part of a run context; 10 is allowed for context
  if (isJoker(card)) break;
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

  if (collected.length >= 3 && isRunContextSequence(collected)) {
    try { console.log(`[core] runFromCurrentTrick detected run (context): ${collected.map(c=>c.value).join(',')} players=${playerIdxs.join(',')}`); } catch(e) {}
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

  // Enforce single-rank-per-turn: no multi-card straights allowed as a play
  if (!allSameValue(cards)) return false;
  // detect runs that may be formed across recent single-card plays
  // Prefer run made by consecutive players in current trick; fall back to pileHistory heuristic
  let effPile: Card[] = effectivePile(pile, pileHistory);
  const trickRun = runFromCurrentTrick(currentTrick, players, finishedOrder || []);
  if (trickRun && trickRun.length >= 3) {
    effPile = trickRun;
  }
  const isPileRun = effPile.length >= 3 && isRunContextSequence(effPile);

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

    // Single Joker handling: cannot beat 10s when direction is 'lower';
    // can beat when direction is 'higher'. Cannot beat another Joker.
    if (isSingleJoker(cards) && pileCount > 0) {
      if (pile.some(c => isJoker(c))) return false;
      if (tenRule?.active && tenRule.direction === 'lower') return false;
      return true;
    }

  // All cards must be the same value (single-rank-per-turn)
  if (!allSameValue(cards)) return false;

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

  // When a run is active (from history/trick), ONLY a single adjacent card may be played.
  if (isPileRun) {
    if (playCount !== 1) return false;
    if (isJoker(cards[0])) return false;
    const lastCard = effPile[effPile.length - 1];
    const lastRank = rankIndex(lastCard.value);
    const playRank = rankIndex(cards[0].value);
    // Adjacent up or down; K→A and A→2 allowed; 2→3 NOT allowed by rank order
    return Math.abs(playRank - lastRank) === 1;
  }

  // Special case: allow closing to four-of-a-kind across turns.
  // If the pile is a uniform set of value v with count 1-3, and the play is
  // the remaining number of cards of the same value to reach exactly 4,
  // allow it (even though counts don't match). This will trigger the
  // four-of-a-kind challenge in playCards.
  const pileIsUniform = allSameValue(pile);
  if (pileIsUniform && pileCount > 0 && pileCount < 4 && allSameValue(cards) && cards[0].value === pile[0].value) {
    if (playCount + pileCount === 4) return true;
  }

  // Special case: pile is uniform 2s. Allow escalation: a higher multiplicity
  // of 2s (e.g., double > single, triple > double, quad > triple) beats it.
  // A single Joker also beats any number of 2s. Otherwise, reject.
  const pileIsTwos = pileIsUniform && pile.length > 0 && pile[0].value === 2;
  if (pileIsTwos) {
    if (isSingleJoker(cards)) return true;
    if (allSameValue(cards) && cards[0].value === 2) {
      return playCount > pileCount; // strictly greater multiplicity required
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

// Context-only run detection for sequences formed via consecutive single-card plays.
// Allows 10s to appear in the sequence (they do not break the run), but still
// disallows Jokers and 2s. Requires that each adjacent pair differs by exactly 1
// in rank, for at least 3 cards total. Direction can change (e.g., 9-10-9) but
// typical gameplay will be monotonic except around 10 where either 9 or J is valid.
export function isRunContextSequence(cards: Card[]): boolean {
  if (!cards || cards.length < 3) return false;
  for (let i = 0; i < cards.length; i++) {
    const c = cards[i];
    if (isJoker(c)) return false; // allow 2 in context runs (K→A→2)
  }
  for (let i = 1; i < cards.length; i++) {
    const prev = rankIndex(cards[i - 1].value);
    const cur = rankIndex(cards[i].value);
    if (Math.abs(cur - prev) !== 1) return false;
  }
  return true;
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

  // If pile is empty, play the globally lowest-ranked card by rankIndex
  if (pile.length === 0) {
    return hand.reduce((best, c) => (rankIndex(c.value) < rankIndex(best.value) ? c : best), hand[0]);
  }

  const pileTopIdx = getHighestValue(pile); // already uses rankIndex
  const candidates = hand.filter(c => rankIndex(c.value) > pileTopIdx && !isJoker(c));
  if (candidates.length === 0) return null;

  // Play the lowest winning card by rankIndex
  const lowest = candidates.reduce((best, c) => (rankIndex(c.value) < rankIndex(best.value) ? c : best), candidates[0]);
  return lowest;
}

// AI function to find the best valid play for a CPU player
export function findCPUPlay(hand: Card[], pile: Card[], tenRule?: { active: boolean; direction: "higher" | "lower" | null }, pileHistory?: Card[][], fourOfAKindChallenge?: { active: boolean; value: number; starterIndex: number }, currentTrick?: TrickHistory, players?: Player[], finishedOrder?: string[]): Card[] | null {
  if (!hand || hand.length === 0) return null;

  const pileCount = pile.length;
  const jokerCard = hand.find(c => isJoker(c));

  // Group cards by value
  const grouped: { [key: number]: Card[] } = {};
  hand.forEach(card => {
    if (!grouped[card.value]) grouped[card.value] = [];
    grouped[card.value].push(card);
  });

  // If pile is empty, prefer 3♣ if present; else play the lowest rank index set (single-rank-per-turn)
  if (pileCount === 0) {
    const threeOfClubs = hand.find(c => c.value === 3 && c.suit === "clubs");
    if (threeOfClubs) return grouped[3] || [threeOfClubs];
    // choose the lowest rank by rankIndex
    const values = Object.keys(grouped).map(Number).sort((a, b) => rankIndex(a) - rankIndex(b));
    const v = values[0];
    return grouped[v];
  }

  // Effective run context: if active, only play a single adjacent card (no Joker here)
  let effPile = effectivePile(pile, pileHistory);
  const trickRun = runFromCurrentTrick(currentTrick, players, finishedOrder || []);
  if (trickRun && trickRun.length >= 3) effPile = trickRun;
  const isPileRun = effPile.length >= 3 && isRunContextSequence(effPile);
  if (isPileRun) {
    const lastRank = rankIndex(effPile[effPile.length - 1].value);
    const adjCard = hand.find(c => {
      if (isJoker(c)) return false;
      const r = rankIndex(c.value);
      return Math.abs(r - lastRank) === 1;
    });
    return adjCard ? [adjCard] : null;
  }

  // Four-of-a-kind challenge: try higher quads, else Joker
  if (fourOfAKindChallenge?.active) {
    const challengeRank = rankIndex(fourOfAKindChallenge.value);
    const values = Object.keys(grouped).map(Number).sort((a, b) => rankIndex(a) - rankIndex(b));
    for (const v of values) {
      const cards = grouped[v];
      if (cards.length >= 4 && rankIndex(v) > challengeRank) return cards.slice(0, 4);
    }
    if (jokerCard && !pile.some(c => isJoker(c))) return [jokerCard];
    return null;
  }

  // Normal play: match count and beat value (single-rank-per-turn)
  const pileRankIndex = rankIndex(pile[0].value);
  const validPlays: Card[][] = [];

  // Special: pile is uniform 2s — allow multiplicity escalation; Joker beats any number of 2s
  const pileIsUniform = allSameValue(pile);
  const pileIsTwos = pileIsUniform && pile[0].value === 2;
  if (pileIsTwos) {
    const twos = grouped[2];
    if (twos && twos.length > pileCount) {
      const toPlay = Math.min(twos.length, pileCount + 1);
      validPlays.push(twos.slice(0, toPlay));
    } else if (jokerCard && !pile.some(c => isJoker(c))) {
      validPlays.push([jokerCard]);
    }
  }

  // Close to quads across turns
  if (!pileIsTwos && pileIsUniform && pileCount > 0 && pileCount < 4) {
    const v = pile[0].value;
    const need = 4 - pileCount;
    const have = (grouped[v] || []).length;
    if (have >= need) validPlays.push((grouped[v] || []).slice(0, need));
  }

  // Same-count higher-value plays (respect 10 rule if active)
  if (!pileIsTwos) {
    Object.keys(grouped).forEach(valueStr => {
      const value = Number(valueStr);
      const cards = grouped[value];
      if (value === 15) return; // skip jokers here
      if (cards.length >= pileCount) {
        const valueRankIndex = rankIndex(value);
        if (tenRule?.active && tenRule.direction) {
          if (tenRule.direction === "higher" && valueRankIndex <= pileRankIndex) return;
          if (tenRule.direction === "lower" && valueRankIndex >= pileRankIndex) return;
        } else {
          if (valueRankIndex <= pileRankIndex) return;
        }
        validPlays.push(cards.slice(0, pileCount));
      }
    });
  }

  if (validPlays.length === 0 && jokerCard && !pile.some(c => isJoker(c))) return [jokerCard];
  if (validPlays.length === 0) return null;
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

  // Allow strategic passes even when a player has a valid play, with one exception:
  // the very first move of the entire game (the player holding 3♣ must open).
  if (state.mustPlay) {
    const isFirstPlay =
      state.pile.length === 0 &&
      (!state.pileHistory || state.pileHistory.length === 0) &&
      (!state.trickHistory || state.trickHistory.length === 0) &&
      (!!state.currentTrick && state.currentTrick.actions.length === 0);
    if (isFirstPlay) {
      return state; // opener cannot pass on the first move
    }
    // Otherwise, allow passing regardless of available plays.
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

  // Debugging detail: log current pass/finalization state to help diagnose
  // premature trick finalization. This prints active players, leader, others
  // set, passed ids, and the last few actions of currentTrick.
  try {
    const activePlayerIds = state.players.filter(p => !state.finishedOrder.includes(p.id)).map(p => p.id);
    const leaderIdx = state.lastPlayPlayerIndex ?? null;
    const leaderPid = (leaderIdx !== null && leaderIdx >= 0) ? state.players[leaderIdx].id : null;
    const othersDebug = activePlayerIds.filter(id => id !== leaderPid);
    const passedArray = Array.from(passedIds);
    const lastActions = state.currentTrick.actions.slice(-6);
    console.log(`[core DEBUG] passTurn status: active=${JSON.stringify(activePlayerIds)}, leader=${leaderPid}, others=${JSON.stringify(othersDebug)}, passed=${JSON.stringify(passedArray)}, lastActions=${JSON.stringify(lastActions)}`);
  } catch (e) {}

  // Use nextActivePlayerIndex to skip finished players for the next turn (tentative)
  state.currentPlayerIndex = nextActivePlayerIndex(state, pIndex);

  // Determine active players for the trick (not finished)
  const activePlayerIds = state.players.filter(p => !state.finishedOrder.includes(p.id)).map(p => p.id);

  // Who last played? That player is considered the leader for this trick.
  // Prefer state.lastPlayPlayerIndex, but fall back to the last 'play' action in currentTrick
  // to guard against any desyncs.
  let leaderIndex = state.lastPlayPlayerIndex ?? null as number | null;
  if ((leaderIndex === null || leaderIndex < 0) && state.currentTrick && state.currentTrick.actions.length > 0) {
    const lastPlay = [...state.currentTrick.actions].reverse().find(a => a.type === 'play');
    if (lastPlay) {
      const idx = state.players.findIndex(p => p.id === lastPlay.playerId);
      if (idx >= 0) leaderIndex = idx;
    }
  }
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
        state.lastClear = undefined;
        state.fourOfAKindChallenge = undefined;
        state.tenRule = { active: false, direction: null };
        state.tenRulePending = false;

        // Winner is the last player who successfully played (leaderIndex).
        if (leaderIndex !== null && leaderIndex >= 0) {
          const winnerPlayer = state.players[leaderIndex];
          state.currentTrick.winnerId = winnerPlayer.id;
          state.currentTrick.winnerName = winnerPlayer.name;
          state.trickHistory = state.trickHistory || [];
          state.trickHistory.push(state.currentTrick);
          state.currentTrick = { trickNumber: state.trickHistory.length + 1, actions: [] };
          // Defensive: ensure any players who now have empty hands are recorded
          for (const p of state.players) {
            if (p.hand.length === 0 && !state.finishedOrder.includes(p.id)) {
              state.finishedOrder.push(p.id);
            }
          }
          // If the winner still has cards, they lead the next trick; otherwise
          // advance to the next active player after the winner.
          if (!state.finishedOrder.includes(winnerPlayer.id)) {
            state.currentPlayerIndex = leaderIndex;
            state.mustPlay = true;
          } else {
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
