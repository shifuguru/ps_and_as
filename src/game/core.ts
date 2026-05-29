// core.ts
// Core game state and logic for Presidents & Assholes
import { Card, Player, createDeck, shuffleDeck, shuffleDeckSeeded, dealCards } from "./ruleset";
import {
  applyDeadHandAfterDeal,
  createDeadHandPlayer,
  isDeadHandPlayer,
  isRoundCompleteForLiving,
  livingPlayerHasRank,
  livingPlayerIds,
} from "./deadHand";
import {
  type DealerContext,
  resolveLeadPlayerIndexAfterTrades,
  resolveOpeningPlayerIndex,
} from "../utils/tableSeats";
import { applyFinishOrderRoles } from "../utils/roundRoles";

export {
  DEAD_HAND_ID,
  DEAD_HAND_NAME,
  createDeadHandPlayer,
  isDeadHandPlayer,
  livingPlayers,
  livingPlayerIds,
  livingFinishedOrder,
  isRoundCompleteForLiving,
  applyDeadHandAfterDeal,
  deadHandHoldsAllThrees,
  needsRoundOneDealerReshuffle,
} from "./deadHand";

export {
  resolveLeadPlayerIndexAfterTrades,
  resolveOpeningPlayerIndex,
  resolveDealerId,
  buildDealerContext,
} from "../utils/tableSeats";

// RULE: Single-rank-per-turn variant (no multi-card straights as a single play)
export const SINGLE_RANK_PER_TURN = true;

export type TrickAction = {
  type: "play" | "pass";
  playerId: string;
  playerName: string;
  cards?: Card[];
  timestamp: number;
  tenRuleDirection?: "higher" | "lower"; // Set when 10 is played and direction is chosen
  fourOfAKind?: boolean; // Set when part of a four-of-a-kind play
  runActive?: boolean; // Set when a run is active
  jokerPlayed?: boolean; // Set when a joker is played
};

export type TrickHistory = {
  trickNumber: number;
  actions: TrickAction[];
  winnerId?: string;
  winnerName?: string;
  /** Consecutive run length on the pile when this trick was won (0 if none). */
  runLength?: number;
};

export type FourOfAKindChallenge = {
  active: boolean;
  value: number;
  starterIndex: number;
  /** Cross-turn completion (e.g. one 3 + three 3s) — unbeatable, must pass. */
  completedAcrossTurns?: boolean;
};

/** Last run extender or double-10 leader may beat the pile once everyone else passes. */
export type RunOnTop = {
  active: boolean;
  playerIndex: number;
};

/** Pair of 10s on the pile — eligible for an on-top! turn after others pass. */
export function isDoubleTensPile(pile: Card[]): boolean {
  return (
    pile.length === 2 &&
    allSameValue(pile) &&
    pile[0].value === 10
  );
}

/** Pile contexts where the leader gets an on-top! turn before the trick clears. */
export function isOnTopEligiblePile(
  pile: Card[],
  pileHistory?: Card[][],
  currentTrick?: TrickHistory,
  players?: Player[],
  finishedOrder: string[] = [],
  tenRule?: { active: boolean; direction: "higher" | "lower" | null },
): boolean {
  const { inRunContext } = resolveRunContext(
    pile,
    pileHistory,
    currentTrick,
    players,
    finishedOrder,
  );
  if (inRunContext) return true;
  return !!(tenRule?.active && tenRule.direction && pile.length > 0);
}

export type GameState = {
  id: string;
  players: Player[];
  currentPlayerIndex: number;
  pile: Card[]; // last played cards on the pile
  pileHistory?: Card[][];
  pileOwners?: string[]; // parallel array to pileHistory recording which player played each entry
  tableStacks?: Card[][]; // completed trick plays stacked/face-down
  tableStackOwners?: (string | null)[];
  passCount: number; // distinct passes recorded in the current trick
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
  fourOfAKindChallenge?: FourOfAKindChallenge;
  /** Run or 10-rule (higher/lower) ended — leader gets one contextual beat ("on top!"). */
  runOnTop?: RunOnTop;
  // Tracks the last clearing play type within the current trick so we can
  // enforce precedence (joker > four-of-a-kind challenge > two)
  lastClear?: {
    type: "joker" | "two" | "four" | null;
    value?: number;
    playerIndex?: number;
  };
  /** Finish order from the previous round — used for dealer rotation & roles. */
  lastRoundOrder?: string[];
  /** Player who was Asshole on each of the last N consecutive rounds. */
  consecutiveAssholeId?: string | null;
  consecutiveAssholeCount?: number;
  /** Skips President↔Asshole trades this round (fourth round after triple Asshole). */
  freshRound?: boolean;
};

/** Keep passCount aligned with distinct pass actions in the current trick. */
function syncPassCountFromTrick(state: GameState): void {
  if (!state.currentTrick?.actions?.length) {
    state.passCount = 0;
    return;
  }
  const passedIds = new Set(
    state.currentTrick.actions
      .filter((a) => a.type === "pass")
      .map((a) => a.playerId),
  );
  state.passCount = passedIds.size;
}

/** When every other living player has gone out, place the last one (asshole). */
function finalizeLoneRemainingPlayer(state: GameState): void {
  const living = livingPlayerIds(state.players)
    .map((id) => state.players.find((p) => p.id === id))
    .filter((p): p is Player => !!p && !isDeadHandPlayer(p));
  const notYetPlaced = living.filter((p) => !state.finishedOrder.includes(p.id));
  if (notYetPlaced.length !== 1) return;
  const last = notYetPlaced[0];
  const allOthersPlaced = living
    .filter((p) => p.id !== last.id)
    .every((p) => state.finishedOrder.includes(p.id));
  if (allOthersPlaced) {
    state.finishedOrder.push(last.id);
  }
}

/** Sync finish order from empty hands and auto-place the last remaining player. */
export function syncFinishedFromEmptyHands(
  state: GameState,
  options?: { skipLoneFinalize?: boolean },
): void {
  const livingIds = new Set(livingPlayerIds(state.players));
  state.finishedOrder = state.finishedOrder.filter((id) => livingIds.has(id));

  for (const p of state.players) {
    if (isDeadHandPlayer(p)) continue;
    if (p.hand.length === 0 && !state.finishedOrder.includes(p.id)) {
      state.finishedOrder.push(p.id);
    }
  }

  if (
    !options?.skipLoneFinalize &&
    !state.tenRulePending &&
    !state.tenRule?.active
  ) {
    finalizeLoneRemainingPlayer(state);
  }
  applyFinishOrderRoles(state.players, state.finishedOrder);
}

/** Player who must pick higher/lower after playing a 10. */
export function tenRuleChooserIndex(state: GameState): number | null {
  if (!state.tenRulePending) return null;
  const idx = state.lastPlayPlayerIndex ?? state.currentPlayerIndex;
  return idx >= 0 && idx < state.players.length ? idx : null;
}

export function isPlayerStillIn(state: GameState, playerId: string): boolean {
  const player = state.players.find((p) => p.id === playerId);
  if (!player || isDeadHandPlayer(player)) return false;
  // Empty hand = out. Players auto-placed last while holding cards (asshole)
  // must still pass on the current trick before the round ends.
  return player.hand.length > 0;
}

/** Still competing this round — not placed out and still holding cards. */
export function isActiveInRound(state: GameState, playerId: string): boolean {
  if (state.finishedOrder.includes(playerId)) return false;
  return isPlayerStillIn(state, playerId);
}

const MAX_FIRST_ROUND_DEAL_ATTEMPTS = 64;

function buildInitialGameState(
  players: Player[],
  dealSeed?: number,
  dealerOptions?: DealerContext,
): GameState {
  const hasDeadHand = players.some(isDeadHandPlayer);
  const maxAttempts = hasDeadHand ? 1 : MAX_FIRST_ROUND_DEAL_ATTEMPTS;
  let openerIdx = -1;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    for (const p of players) {
      p.hand = [];
      if (isDeadHandPlayer(p)) {
        p.sidelinedHand = undefined;
      }
    }
    const attemptSeed =
      dealSeed != null ? ((dealSeed + attempt) >>> 0) : undefined;
    const deck =
      attemptSeed != null
        ? shuffleDeckSeeded(createDeck(), attemptSeed)
        : shuffleDeck(createDeck());
    dealCards(deck, players);
    if (hasDeadHand) {
      applyDeadHandAfterDeal(
        {
          players,
          finishedOrder: [],
          currentPlayerIndex: 0,
          mustPlay: false,
        },
        dealerOptions ?? {},
      );
    }
    openerIdx = resolveOpeningPlayerIndex(players, dealerOptions ?? {});
    if (openerIdx >= 0) break;
  }
  if (openerIdx < 0 && !hasDeadHand) {
    throw new Error(
      "Could not deal a valid round-1 opening after " +
        MAX_FIRST_ROUND_DEAL_ATTEMPTS +
        " attempts",
    );
  }
  if (openerIdx < 0) {
    openerIdx = players.findIndex((p) => !isDeadHandPlayer(p));
    if (openerIdx < 0) openerIdx = 0;
  }
  return {
    id: "game-" + Date.now(),
    players,
    currentPlayerIndex: openerIdx,
    pile: [],
    passCount: 0,
    finishedOrder: [],
    started: true,
    lastPlayPlayerIndex: null,
    mustPlay: true,
    pileHistory: [],
    pileOwners: [],
    tableStacks: [],
    tableStackOwners: [],
    trickHistory: [],
    currentTrick: { trickNumber: 1, actions: [] },
    tenRule: { active: false, direction: null },
  };
}

export function createGame(playerNames: string[]): GameState {
  const players: Player[] = playerNames.map((n, i) => ({
    id: String(i + 1),
    name: n,
    hand: [],
    role: "Neutral",
  }));
  return buildInitialGameState(players);
}

/** Create a game using lobby socket ids (online multiplayer). */
export function createGameFromLobby(
  lobbyPlayers: { id: string; name: string }[],
  dealSeed?: number,
  options?: { deadHand?: boolean; hostId?: string | null; lastRoundOrder?: string[] },
): GameState {
  const players: Player[] = lobbyPlayers.map((p) => ({
    id: p.id,
    name: p.name,
    hand: [],
    role: "Neutral",
  }));
  if (options?.deadHand && players.length === 2) {
    players.push(createDeadHandPlayer());
  }
  const dealerOptions: DealerContext = {
    hostId: options?.hostId ?? null,
    lastRoundOrder: options?.lastRoundOrder,
  };
  const state = buildInitialGameState(players, dealSeed, dealerOptions);
  return state;
}

function removeCardsFromHand(hand: Card[], cards: Card[]): Card[] {
  const remaining = hand.slice();
  for (const card of cards) {
    const index = remaining.findIndex(
      (h) => h.suit === card.suit && h.value === card.value,
    );
    if (index !== -1) {
      remaining.splice(index, 1);
    }
  }
  return remaining;
}

export function playCards(state: GameState, playerId: string, cards: Card[]): GameState {
  // Very small validation: ensure it's that player's turn and they have the cards
  const pIndex = state.players.findIndex((p) => p.id === playerId);
  if (pIndex === -1) return state;
  if (state.currentPlayerIndex !== pIndex) return state;
  const player = state.players[pIndex];

  if (!isPlayerStillIn(state, playerId)) {
    syncFinishedFromEmptyHands(state);
    state.currentPlayerIndex = nextActivePlayerIndex(state, pIndex);
    return { ...state };
  }

  // If the player already passed in the current trick, they have forfeited
  // the rest of this trick and cannot play again until the pile is cleared
  // and a new trick begins. We check currentTrick actions for a prior pass.
  if (state.currentTrick && state.currentTrick.actions.some(a => a.type === 'pass' && a.playerId === playerId)) {
    // Player already passed this trick — instead of invoking full
    // `passTurn` (which may finalize the trick immediately), record an
    // additional pass action and advance the turn. This keeps the new pass
    // visible in `currentTrick.actions` for callers/tests that expect it.
    state.currentTrick.actions.push({
      type: "pass",
      playerId: player.id,
      playerName: player.name,
      timestamp: Date.now(),
    });
    syncPassCountFromTrick(state);
    state.currentPlayerIndex = nextActivePlayerIndex(state, pIndex);
    return { ...state };
  }

  // check that player has all cards
  for (const c of cards) {
    const found = player.hand.findIndex((h) => h.suit === c.suit && h.value === c.value);
    if (found === -1) return state;
  }

  // NOTE: first-play (must include 3♣) validation is performed centrally in
  // `isValidPlay` so that all callers (including test helpers) can control
  // the context via the `trickHistory` parameter. Avoid duplicating that
  // logic here to prevent inconsistent behavior.

  // RULE: a single turn may ONLY play one rank repeated N times (1–4)
  if (!allSameValue(cards)) return state;

  try { console.log('[core DEBUG] playCards incoming cards', cards.map(c=>c.value), 'containsTwo=', containsTwo(cards), '__filename=', __filename); } catch(e) {}

  // Compute effective pile/run for contextual rule checks (e.g., tens shouldn't
  // trigger the ten-rule when the active pile is a run formed by consecutive
  // single-card plays).
  // Consider both historical pile context and the current trick's single-card
  // plays when deciding whether the active context is a run. Previously only
  // pileHistory was used which missed runs formed within the currentTrick
  // (e.g., player A plays 8, player B plays 9, player C plays 10 in the same
  // trick). In that case the 10 should NOT activate the ten-rule; we must
  // detect the run via runFromCurrentTrick as well.
  // Create a simulated trick with the current play added to check for run formation
  const simulatedTrick = state.currentTrick ? {
    ...state.currentTrick,
    actions: [...state.currentTrick.actions, {
      type: "play" as const,
      playerId: player.id,
      playerName: player.name,
      cards: cards.slice(),
      timestamp: Date.now(),
    }]
  } : undefined;

  const seqForTen = consecutiveSequenceInfo(
    state.pile,
    state.pileHistory,
    simulatedTrick,
    state.players,
    state.finishedOrder || [],
  );
  const isActiveRun = isRunContextSequence(seqForTen.repCards);
  const playedTen = containsTen(cards);
  const activatingTenRule =
    playedTen && !state.tenRule?.active && !isActiveRun;

  // Validate play type: must play same number of cards as pile (unless pile is empty)
  // Enforce clear precedence: if this play is a 2 and the current trick already
  // contains a Joker or an active four-of-a-kind clear, reject it. We also use
  // state.lastClear to track the highest-clear type in the current trick.
  // If the play is a 2, reject overriding an active Joker clear in this trick.
  if (containsTwo(cards)) {
    if (state.lastClear?.type === "joker") {
      return state;
    }
  }

  if (!isValidPlay(cards, state.pile, state.tenRule, state.pileHistory, state.trickHistory, state.fourOfAKindChallenge, state.currentTrick, state.players, state.finishedOrder, state.lastRoundOrder, state.players[state.currentPlayerIndex]?.id, state.runOnTop?.active && state.runOnTop.playerIndex === pIndex)) {
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
        state.finishedOrder,
        state.trickHistory,
        state.lastRoundOrder,
        player.id,
        state.runOnTop?.active && state.runOnTop.playerIndex === pIndex,
      );
      // If no possible play, or the best possible play is also invalid,
      // allow the player to pass so the game can progress.
      if (possible === null || !isValidPlay(possible, state.pile, state.tenRule, state.pileHistory, state.trickHistory, state.fourOfAKindChallenge, state.currentTrick, state.players, state.finishedOrder, state.lastRoundOrder, state.players[state.currentPlayerIndex]?.id, state.runOnTop?.active && state.runOnTop.playerIndex === pIndex)) {
        return passTurn(state, playerId);
      }
    }
    return state;
  }

  // remove cards from player's hand
  player.hand = removeCardsFromHand(player.hand, cards);
  const wasRunOnTop =
    state.runOnTop?.active && state.runOnTop.playerIndex === pIndex;
  if (wasRunOnTop) {
    state.runOnTop = undefined;
  }
  syncFinishedFromEmptyHands(state, {
    skipLoneFinalize: activatingTenRule,
  });
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
  try {
    console.log(
      `[core DEBUG] playCards context: playedTen=${playedTen}, runSeq=${(seqForTen.repCards || []).map((c) => c.value).join(",")}, isActiveRun=${isActiveRun}`,
    );
  } catch (e) {}
  // Do not activate the 10-rule when the active pile is a run. Tens are
  // explicitly excluded from influencing runs.
  if (activatingTenRule) {
    // 10 rule is being activated - add cards to pile but pause for player input
    state.pile = cards;
    state.pileHistory = state.pileHistory || [];
    state.pileHistory.push(cards.slice());
    state.pileOwners = state.pileOwners || [];
    state.pileOwners.push(player.id);
    syncPassCountFromTrick(state);
    state.tenRule = { active: true, direction: null };
    return { ...state, tenRulePending: true } as GameState;
  }

  // If 10 rule was active and a valid play was made, deactivate it.
  // Also clear when extending an active run (tens never govern runs).
  if (
    state.tenRule?.active &&
    (state.tenRule.direction || isActiveRun)
  ) {
    state.tenRule = { active: false, direction: null };
  }

  // Special rules first — 2s behave as high cards (not instant pile clears).
  const extendingQuadsRun = isExtendingQuadsRun(
    cards,
    state.pile,
    state.pileHistory,
    state.currentTrick,
    state.players,
    state.finishedOrder || [],
  );

  if (isFourOfAKind(cards) && !extendingQuadsRun) {
    // Single-play four-of-a-kind bomb — beatable by higher quads or joker
    state.lastClear = { type: "four", value: cards[0].value, playerIndex: pIndex };
    state.pile = cards;
    state.pileHistory = state.pileHistory || [];
    state.pileHistory.push(cards.slice());
    state.pileOwners = state.pileOwners || [];
    state.pileOwners.push(player.id);
    syncPassCountFromTrick(state);
    state.fourOfAKindChallenge = {
      active: true,
      value: cards[0].value,
      starterIndex: pIndex,
      completedAcrossTurns: false,
    };
    // Advance to next player
    state.currentPlayerIndex = nextActivePlayerIndex(state, pIndex);
    state.mustPlay = false;
  } else if (
    // Closing to quads across turns: combine pile + cards to form 4-of-a-kind
    state.pile.length > 0 &&
    state.pile.length < 4 &&
    allSameValue(state.pile) &&
    allSameValue(cards) &&
    cards[0].value === state.pile[0].value &&
    (state.pile.length + cards.length === 4) &&
    !isActiveRun
  ) {
    // Combine to visible four-of-a-kind on the pile
    const combined = [...state.pile, ...cards];
    state.pileHistory = state.pileHistory || [];
    state.pileHistory.push(cards.slice());
    state.pileOwners = state.pileOwners || [];
    state.pileOwners.push(player.id);
    state.pile = combined;
    syncPassCountFromTrick(state);
    // Cross-turn completion — unbeatable until everyone else passes
    state.fourOfAKindChallenge = {
      active: true,
      value: cards[0].value,
      starterIndex: pIndex,
      completedAcrossTurns: true,
    };
    state.lastClear = { type: "four", value: cards[0].value, playerIndex: pIndex };
    state.currentPlayerIndex = nextActivePlayerIndex(state, pIndex);
    state.mustPlay = false;
  } else if (isSingleJoker(cards)) {
    // Single Joker: highest card, but still requires others to pass
    state.lastClear = { type: "joker", value: 15, playerIndex: pIndex };
    state.pile = cards;
    state.pileHistory = state.pileHistory || [];
    state.pileHistory.push(cards.slice());
    state.pileOwners = state.pileOwners || [];
    state.pileOwners.push(player.id);
    syncPassCountFromTrick(state);
    // Resolve any active four-of-a-kind challenge
    if (state.fourOfAKindChallenge && state.fourOfAKindChallenge.active) {
      state.fourOfAKindChallenge = undefined;
    }
    // Advance to next active player so others can pass
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
    syncPassCountFromTrick(state);
    if (extendingQuadsRun) {
      state.fourOfAKindChallenge = undefined;
    }
    // advance from the player who just played
    state.currentPlayerIndex = nextActivePlayerIndex(state, pIndex);
    state.mustPlay = false;
  }

  syncFinishedFromEmptyHands(state);
  if (wasRunOnTop) {
    const winnerIndex = resolveTrickLeaderIndex(state) ?? pIndex;
    return finalizeTrickWin(state, winnerIndex);
  }
  if (isRoundCompleteForLiving(state)) {
    return { ...state };
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
  
  syncFinishedFromEmptyHands(state);

  // The pile with the 10s remains active — advance past the 10 player if they are out.
  if (isRoundCompleteForLiving(state)) {
    return { ...state };
  }
  const fromIndex = state.lastPlayPlayerIndex ?? state.currentPlayerIndex;
  state.currentPlayerIndex = nextActivePlayerIndex(state, fromIndex);
  state.mustPlay = true;

  return { ...state };
}

// Helpers for play validation
export function getPlayCount(cards: Card[]) {
  return cards.length;
}

/** How many cards of `playValue` must be played to answer the current pile. */
export function cardsNeededToPlay(pile: Card[], playValue: number): number {
  const pileCount = pile.length;
  if (pileCount === 0) return 1;
  const uniform = pile.every((c) => c.value === pile[0].value);
  if (uniform && pileCount < 4 && playValue === pile[0].value) {
    return 4 - pileCount;
  }
  return pileCount;
}

// Rank order (low -> high): 3,4,5,6,7,8,9,10,J(11),Q(12),K(13),A(14),2(15),Joker(16)
// Note: card numeric values use conventional face encodings for most cards
// (3..14 where 14=Ace). In this game's internal encoding, '2' is represented
// as 15 and Joker as 16. The RANK_ORDER array maps those encoded values to
// the game's rank ordering (index in the array is the relative rank). For
// example, indexOf(3) === 0 (lowest), indexOf(10) === 7, indexOf(14 /*A*/) === 11,
// indexOf(15 /*2*/) === 12, indexOf(16 /*Joker*/) === 13.
export const RANK_ORDER = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];

/** Consecutive plays required before run/adjacency rules replace beat-the-pile. */
export const MIN_RUN_CONTEXT_LENGTH = 3;

export function resolveRunContext(
  pile: Card[],
  pileHistory?: Card[][],
  currentTrick?: TrickHistory,
  players?: Player[],
  finishedOrder: string[] = [],
): { runSeq: Card[]; runMultiplicity: number; inRunContext: boolean } {
  const trickRunInfo = runFromCurrentTrickInfo(
    currentTrick,
    players,
    finishedOrder,
    pile,
  );
  const seqInfo = consecutiveSequenceInfo(
    pile,
    pileHistory,
    currentTrick,
    players,
    finishedOrder,
  );
  const runSeq =
    seqInfo.repCards.length >= trickRunInfo.repCards.length
      ? seqInfo.repCards
      : trickRunInfo.repCards;
  let runMultiplicity = 1;
  if (runSeq.length >= MIN_RUN_CONTEXT_LENGTH) {
    runMultiplicity =
      seqInfo.repCards.length >= trickRunInfo.repCards.length
        ? seqInfo.multiplicity
        : trickRunInfo.multiplicity || 1;
  } else if (runSeq.length >= 2) {
    runMultiplicity =
      seqInfo.repCards.length >= trickRunInfo.repCards.length
        ? seqInfo.multiplicity
        : trickRunInfo.multiplicity || 1;
  }
  return {
    runSeq,
    runMultiplicity,
    inRunContext: isRunContextSequence(runSeq),
  };
}

/** One rank away from a uniform pile top (run extensions use pile top, not run tail). */
export function isAdjacentToPileTop(pile: Card[], playValue: number): boolean {
  if (!pile?.length || !allSameValue(pile)) return false;
  return Math.abs(rankIndex(playValue) - rankIndex(pile[0].value)) === 1;
}

function runDirectionOfSeq(seq: Card[]): number {
  if (seq.length < 2) return 0;
  const step = rankIndex(seq[1].value) - rankIndex(seq[0].value);
  return Math.abs(step) === 1 ? step : 0;
}

function isMonotonicSequence(seq: Card[]): boolean {
  if (seq.length < 2) return true;
  const dir = runDirectionOfSeq(seq);
  if (dir === 0) return false;
  for (let i = 2; i < seq.length; i++) {
    if (rankIndex(seq[i].value) - rankIndex(seq[i - 1].value) !== dir) return false;
  }
  return true;
}

/** Longest strictly monotonic suffix ending at `endIdx` (length 2+). */
function monotonicSuffixEndingAt(chronology: Card[], endIdx: number): Card[] {
  if (endIdx < 0 || endIdx >= chronology.length) return [];
  let best: Card[] = [chronology[endIdx]];
  for (let start = 0; start <= endIdx; start++) {
    const suffix = chronology.slice(start, endIdx + 1);
    if (suffix.length >= 2 && isMonotonicSequence(suffix) && suffix.length > best.length) {
      best = suffix;
    }
  }
  return best;
}

function isStepBackPile(chronology: Card[], pile: Card[]): boolean {
  if (!pile?.length || !chronology.length) return false;
  const pileVal = pile[0].value;
  if (chronology[chronology.length - 1].value !== pileVal) return false;
  let count = 0;
  for (const c of chronology) {
    if (c.value === pileVal) count++;
  }
  return count >= 2;
}

/** Rank values a run extension may attach to (pile top, step-back tail, skip-over tail). */
function getRunExtensionAnchorValues(chronology: Card[], pile: Card[]): number[] {
  if (!pile?.length || !allSameValue(pile)) return [];
  const pileVal = pile[0].value;
  const anchors = new Set<number>([pileVal]);

  const n = chronology.length;
  if (n >= 2 && chronology[n - 1].value === pileVal) {
    const prevVal = chronology[n - 2].value;
    if (
      isStepBackPile(chronology, pile) &&
      Math.abs(rankIndex(prevVal) - rankIndex(pileVal)) === 1
    ) {
      anchors.add(prevVal);
      const stepBackRun = longestRunSuffixAtIndex(chronology, n - 2);
      if (stepBackRun.length >= 2) {
        anchors.add(stepBackRun[stepBackRun.length - 1].value);
      }
    }
    if (n >= 3) {
      const rVal = chronology[n - 2].value;
      const tVal = chronology[n - 3].value;
      if (
        rVal !== pileVal &&
        Math.abs(rankIndex(rVal) - rankIndex(tVal)) === 1 &&
        Math.abs(rankIndex(pileVal) - rankIndex(tVal)) === 1
      ) {
        anchors.add(tVal);
      }
    }
  }
  return [...anchors];
}

function buildSameMultiplicityChronologyFromHistory(
  pileHistory?: Card[][],
): Card[] {
  if (!pileHistory?.length) return [];
  const mult = pileHistory[pileHistory.length - 1].length;
  const repCards: Card[] = [];
  for (let i = pileHistory.length - 1; i >= 0; i--) {
    const entry = pileHistory[i];
    if (!entry?.length || entry.some(isJoker)) break;
    if (entry.length !== mult) break;
    if (!allSameValue(entry)) break;
    repCards.unshift(entry[0]);
  }
  return repCards;
}

function buildSameMultiplicityChronologyFromTrick(
  currentTrick?: TrickHistory,
  _players?: Player[],
  _finishedOrder: string[] = [],
): Card[] {
  if (!currentTrick?.actions?.length) return [];
  const actions = currentTrick.actions;

  let lastPlayIndex = -1;
  for (let i = actions.length - 1; i >= 0; i--) {
    const a = actions[i];
    if (a.type === "play" && a.cards?.length && !a.cards.some(isJoker)) {
      lastPlayIndex = i;
      break;
    }
  }
  if (lastPlayIndex === -1) return [];

  let multiplicity: number | null = null;
  const collectedActions: Card[][] = [];
  for (let i = lastPlayIndex; i >= 0; i--) {
    const a = actions[i];
    if (a.type === "pass") continue;
    if (a.type !== "play" || !a.cards?.length) break;
    if (a.cards.some(isJoker)) break;
    if (multiplicity === null) multiplicity = a.cards.length;
    if (a.cards.length !== multiplicity) break;
    if (!allSameValue(a.cards)) break;
    collectedActions.unshift(a.cards.slice());
  }
  return collectedActions.map((arr) => arr[0]);
}

function buildSameMultiplicityChronology(
  pile: Card[],
  pileHistory?: Card[][],
  currentTrick?: TrickHistory,
  players?: Player[],
  finishedOrder: string[] = [],
): Card[] {
  const fromTrick = buildSameMultiplicityChronologyFromTrick(
    currentTrick,
    players,
    finishedOrder,
  );
  const fromHist = buildSameMultiplicityChronologyFromHistory(pileHistory);
  return fromTrick.length >= fromHist.length ? fromTrick : fromHist;
}

/** Whether a play extends an active or latent run (pile top, step-back, or skip-over). */
export function isValidRunExtension(
  playValue: number,
  pile: Card[],
  pileHistory?: Card[][],
  currentTrick?: TrickHistory,
  players?: Player[],
  finishedOrder: string[] = [],
): boolean {
  const chronology = buildSameMultiplicityChronology(
    pile,
    pileHistory,
    currentTrick,
    players,
    finishedOrder,
  );
  return getRunExtensionAnchorValues(chronology, pile).some(
    (anchor) => Math.abs(rankIndex(playValue) - rankIndex(anchor)) === 1,
  );
}

/** Playing four-of-a-kind to extend an active quads run (multiplicity 4). */
function isExtendingQuadsRun(
  cards: Card[],
  pile: Card[],
  pileHistory?: Card[][],
  currentTrick?: TrickHistory,
  players?: Player[],
  finishedOrder: string[] = [],
): boolean {
  if (!isFourOfAKind(cards)) return false;
  const { runSeq, runMultiplicity, inRunContext } = resolveRunContext(
    pile,
    pileHistory,
    currentTrick,
    players,
    finishedOrder,
  );
  if (!inRunContext || runMultiplicity !== 4) return false;
  return isAdjacentToPileTop(pile, cards[0].value);
}

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
function longestRunSubstring(chronology: Card[]): Card[] {
  if (!chronology?.length) return [];
  let best: Card[] = [];
  for (let start = 0; start < chronology.length; start++) {
    for (
      let end = start + MIN_RUN_CONTEXT_LENGTH - 1;
      end < chronology.length;
      end++
    ) {
      const sub = chronology.slice(start, end + 1);
      if (isRunContextSequence(sub) && sub.length > best.length) {
        best = sub;
      }
    }
  }
  return best;
}

function longestRunSuffixAtIndex(chronology: Card[], endIdx: number): Card[] {
  if (endIdx < 0 || endIdx >= chronology.length) return [];
  let best: Card[] = [];
  for (let start = 0; start <= endIdx; start++) {
    const suffix = chronology.slice(start, endIdx + 1);
    if (
      suffix.length >= MIN_RUN_CONTEXT_LENGTH &&
      isRunContextSequence(suffix)
    ) {
      if (suffix.length > best.length) best = suffix;
    }
  }
  return best;
}

/**
 * Longest monotonic run connected to the current pile.
 * Supports a single step-back rank (e.g. 5-6-7-8 then 7) without matching
 * unrelated earlier runs elsewhere in the trick.
 */
function resolveRunFromChronology(chronology: Card[], pile?: Card[]): Card[] {
  if (!chronology?.length) return [];
  if (!pile?.length || !allSameValue(pile)) {
    return longestRunSubstring(chronology);
  }

  const pileVal = pile[0].value;
  const n = chronology.length;
  if (chronology[n - 1].value !== pileVal) return [];

  let best = longestRunSuffixAtIndex(chronology, n - 1);

  // One-rank step back (e.g. …8 then 7) — run tail is the card before the step.
  if (n >= 2) {
    const prevVal = chronology[n - 2].value;
    if (Math.abs(rankIndex(prevVal) - rankIndex(pileVal)) === 1) {
      const stepBackRun = longestRunSuffixAtIndex(chronology, n - 2);
      if (stepBackRun.length > best.length) best = stepBackRun;
    }
  }

  // Skip-over step-back extension (e.g. J-Q-J then K extends from Q, not pile-top J).
  if (n >= 3) {
    const rVal = chronology[n - 2].value;
    const tVal = chronology[n - 3].value;
    if (
      pileVal !== rVal &&
      Math.abs(rankIndex(rVal) - rankIndex(tVal)) === 1 &&
      Math.abs(rankIndex(pileVal) - rankIndex(tVal)) === 1
    ) {
      const tailAtT = monotonicSuffixEndingAt(chronology, n - 3);
      if (tailAtT.length >= 2) {
        const dir = runDirectionOfSeq(tailAtT);
        const lastRank = rankIndex(tailAtT[tailAtT.length - 1].value);
        if (dir !== 0 && rankIndex(pileVal) - lastRank === dir) {
          const extended = [...tailAtT, { value: pileVal, suit: pile![0].suit }];
          if (isRunContextSequence(extended) && extended.length > best.length) {
            best = extended;
          }
        }
      }
    }
  }

  // Repeated step-back oscillation (e.g. 4-5-6-5-6, 10-J-Q-J-Q, J-Q-K-J-Q): the pile
  // bounces between adjacent ranks after a monotonic core — keep the longest core that
  // ends anywhere in the adjacent tail leading back to the pile.
  if (isStepBackPile(chronology, pile)) {
    for (let idx = n - 2; idx >= 0; idx--) {
      const core = longestRunSuffixAtIndex(chronology, idx);
      if (core.length > best.length) best = core;
    }
  }

  return best;
}

function collectConsecutiveFromHistory(
  pileHistory?: Card[][],
  pile?: Card[],
): { repCards: Card[]; multiplicity: number } {
  if (!pileHistory || pileHistory.length === 0) return { repCards: [], multiplicity: 1 };

  const repCards = buildSameMultiplicityChronologyFromHistory(pileHistory);
  if (repCards.length === 0) return { repCards: [], multiplicity: 1 };

  const multiplicity = pileHistory[pileHistory.length - 1]?.length || 1;
  const runSeq = resolveRunFromChronology(repCards, pile);
  if (runSeq.length >= MIN_RUN_CONTEXT_LENGTH) {
    return { repCards: runSeq, multiplicity };
  }
  return { repCards: [], multiplicity: 1 };
}

function collectConsecutiveFromTrick(
  currentTrick?: TrickHistory,
  players?: Player[],
  finishedOrder: string[] = [],
  pile?: Card[],
): { repCards: Card[]; multiplicity: number } {
  if (!currentTrick || !players) return { repCards: [], multiplicity: 1 };

  const repCards = buildSameMultiplicityChronologyFromTrick(
    currentTrick,
    players,
    finishedOrder,
  );
  if (repCards.length === 0) return { repCards: [], multiplicity: 1 };

  let multiplicity = 1;
  for (let i = currentTrick.actions.length - 1; i >= 0; i--) {
    const a = currentTrick.actions[i];
    if (a.type === "play" && a.cards?.length) {
      multiplicity = a.cards.length;
      break;
    }
  }

  const runSeq = resolveRunFromChronology(repCards, pile);
  if (runSeq.length >= MIN_RUN_CONTEXT_LENGTH) {
    return { repCards: runSeq, multiplicity };
  }
  return { repCards: [], multiplicity: 1 };
}

/** Consecutive run sequence from trick and/or pile history (3+ cards). */
export function consecutiveSequenceInfo(
  pile: Card[],
  pileHistory?: Card[][],
  currentTrick?: TrickHistory,
  players?: Player[],
  finishedOrder: string[] = [],
): { repCards: Card[]; multiplicity: number } {
  const fromTrick = collectConsecutiveFromTrick(
    currentTrick,
    players,
    finishedOrder,
    pile,
  );
  const fromHist = collectConsecutiveFromHistory(pileHistory, pile);
  const best =
    fromTrick.repCards.length >= fromHist.repCards.length ? fromTrick : fromHist;
  if (best.repCards.length >= MIN_RUN_CONTEXT_LENGTH) return best;

  // Special case: treat a single (or same-multiplicity) `pile` entry appended
  // to a recent `fromHist`/`fromTrick` sequence as a continuing run when
  // multiplicities match and ranks are consecutive. This allows contexts
  // like history [[8],[9]] with pile [10] to be recognized as a run.
  const sources = [fromTrick, fromHist];

  // Extra heuristic: if the last two entries in pileHistory form adjacent
  // ranks with equal multiplicity, and the current pile matches that
  // multiplicity and is adjacent to the most recent history entry, treat
  // the three as a potential run (covers history [[8],[9]] + pile [10]).
  if (pileHistory && pileHistory.length >= 2 && pile && pile.length > 0) {
    const e2 = pileHistory[pileHistory.length - 1];
    const e1 = pileHistory[pileHistory.length - 2];
    if (e1 && e2 && e1.length === e2.length && e1.length === pile.length) {
      if (e1.length > 0 && e2.length > 0) {
        const a = e1[0];
        const b = e2[0];
        const c = pile[0];
        if (!isJoker(a) && !isJoker(b) && !isJoker(c)) {
          if (Math.abs(rankIndex(b.value) - rankIndex(a.value)) === 1 && Math.abs(rankIndex(c.value) - rankIndex(b.value)) === 1) {
            const combined = [a, b, c];
            if (isRunContextSequence(combined)) {
              return { repCards: combined, multiplicity: e1.length };
            }
          }
        }
      }
    }
  }
  for (const src of sources) {
    if (src.repCards.length >= MIN_RUN_CONTEXT_LENGTH && pile && pile.length === src.multiplicity) {
      // Only consider non-joker adjacency which is validated by isRunContextSequence
      const last = src.repCards[src.repCards.length - 1];
      const candidate = pile[0];
      if (Math.abs(rankIndex(candidate.value) - rankIndex(last.value)) === 1) {
        const combined = [...src.repCards, candidate];
        const suffix = resolveRunFromChronology(combined, pile);
        if (suffix.length >= MIN_RUN_CONTEXT_LENGTH) {
          return { repCards: suffix, multiplicity: src.multiplicity };
        }
      }
    }
  }

  if (pile && pile.length >= 3 && isRun(pile)) {
    return { repCards: pile, multiplicity: pile.length };
  }
  return { repCards: [], multiplicity: 1 };
}

export function effectivePile(pile: Card[], pileHistory?: Card[][]): Card[] {
  try {
    if (pile && pile.length >= 3 && isRun(pile)) return pile;
    const fromHist = collectConsecutiveFromHistory(pileHistory, pile);
    if (fromHist.repCards.length >= 3) {
      try {
        console.log(
          `[core] effectivePile detected run (context) from pileHistory: ${fromHist.repCards.map((c) => c.value).join(",")}`,
        );
      } catch (e) {}
      return fromHist.repCards;
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
    if (!finishedOrder.includes(p.id) && p.hand.length > 0) return idx;
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
// New helper: detect runs formed by consecutive play actions in the current
// trick and return both the representative rank cards and the multiplicity.
// This lets callers distinguish between single runs and Runs*Doubles/Triples/Quads.
export function runFromCurrentTrickInfo(
  currentTrick?: TrickHistory,
  players?: Player[],
  finishedOrder: string[] = [],
  pile?: Card[],
): { repCards: Card[]; multiplicity: number | null } {
  const info = collectConsecutiveFromTrick(
    currentTrick,
    players,
    finishedOrder,
    pile,
  );
  if (info.repCards.length >= MIN_RUN_CONTEXT_LENGTH) {
    try {
      console.log(
        `[core] runFromCurrentTrick detected run (context): ${info.repCards.map((c) => c.value).join(",")} multiplicity=${info.multiplicity}`,
      );
    } catch (e) {}
    return { repCards: info.repCards, multiplicity: info.multiplicity };
  }
  return { repCards: [], multiplicity: null };
}

// Backwards-compatible wrapper returning the representative cards only
export function runFromCurrentTrick(
  currentTrick?: TrickHistory,
  players?: Player[],
  finishedOrder: string[] = [],
  pile?: Card[],
): Card[] {
  return runFromCurrentTrickInfo(currentTrick, players, finishedOrder, pile)
    .repCards;
}

export type RunPlayStep = { value: number; playerId: string };

function collectRunPlayStepsFromTrick(
  currentTrick?: TrickHistory,
  pile?: Card[],
): RunPlayStep[] {
  if (!currentTrick?.actions?.length) return [];

  const actions = currentTrick.actions;
  let lastPlayIndex = -1;
  for (let i = actions.length - 1; i >= 0; i--) {
    if (actions[i].type === "play") {
      lastPlayIndex = i;
      break;
    }
  }
  if (lastPlayIndex === -1) return [];

  const collected: RunPlayStep[] = [];
  let multiplicity: number | null = null;

  for (let i = lastPlayIndex; i >= 0; i--) {
    const a = actions[i];
    if (a.type === "pass") continue;
    if (a.type !== "play" || !a.cards?.length) break;
    if (a.cards.some(isJoker)) break;
    if (multiplicity === null) multiplicity = a.cards.length;
    if (a.cards.length !== multiplicity) break;
    if (collected.length > 0) {
      const immediateSuccessor = collected[0];
      if (
        Math.abs(rankIndex(a.cards[0].value) - rankIndex(immediateSuccessor.value)) !==
        1
      ) {
        break;
      }
    }
    collected.unshift({ value: a.cards[0].value, playerId: a.playerId });
  }

  return collected;
}

function collectRunPlayStepsFromHistory(
  pileHistory?: Card[][],
  pileOwners?: string[],
  pile?: Card[],
): RunPlayStep[] {
  if (!pileHistory?.length) return [];

  const collected: RunPlayStep[] = [];
  let multiplicity: number | null = null;
  for (let i = pileHistory.length - 1; i >= 0; i--) {
    const entry = pileHistory[i];
    if (!entry?.length) break;
    if (entry.some(isJoker)) break;
    if (multiplicity === null) multiplicity = entry.length;
    if (entry.length !== multiplicity) break;
    if (!allSameValue(entry)) break;
    const candidate = entry[0];
    const ownerId = pileOwners?.[i];
    if (!ownerId) break;
    if (collected.length > 0) {
      const immediateSuccessor = collected[0];
      if (
        Math.abs(rankIndex(candidate.value) - rankIndex(immediateSuccessor.value)) !==
        1
      ) {
        break;
      }
    }
    collected.unshift({ value: candidate.value, playerId: ownerId });
  }

  if (pile?.length && allSameValue(pile)) {
    const pileCard = pile[0];
    const last = collected[collected.length - 1];
    if (
      last &&
      last.value !== pileCard.value &&
      Math.abs(rankIndex(pileCard.value) - rankIndex(last.value)) === 1
    ) {
      const ownerId = pileOwners?.[pileHistory.length - 1];
      if (ownerId) {
        collected.push({ value: pileCard.value, playerId: ownerId });
      }
    }
  }

  return collected;
}

/** Chronological play steps forming the active consecutive chain. */
export function collectRunPlaySteps(
  state: Pick<
    GameState,
    "pile" | "pileHistory" | "pileOwners" | "currentTrick" | "players" | "finishedOrder"
  >,
): RunPlayStep[] {
  const fromTrick = collectRunPlayStepsFromTrick(state.currentTrick, state.pile);
  const fromHist = collectRunPlayStepsFromHistory(
    state.pileHistory,
    state.pileOwners,
    state.pile,
  );
  const trickInfo = collectConsecutiveFromTrick(
    state.currentTrick,
    state.players,
    state.finishedOrder ?? [],
    state.pile,
  );
  const histInfo = collectConsecutiveFromHistory(state.pileHistory, state.pile);
  return trickInfo.repCards.length >= histInfo.repCards.length ? fromTrick : fromHist;
}

/** Length of the active run (0 when not in run context). */
export function runContextLengthFromState(
  state: Pick<
    GameState,
    | "pile"
    | "pileHistory"
    | "pileOwners"
    | "currentTrick"
    | "players"
    | "finishedOrder"
  >,
): number {
  const { runSeq, inRunContext } = resolveRunContext(
    state.pile,
    state.pileHistory,
    state.currentTrick,
    state.players,
    state.finishedOrder ?? [],
  );
  return inRunContext ? runSeq.length : 0;
}

/** Bonus run steps beyond the 3-card minimum (0 for a 3-card run). */
export function runBonusStepsFromLength(runLength: number): number {
  if (runLength < MIN_RUN_CONTEXT_LENGTH) return 0;
  return runLength - MIN_RUN_CONTEXT_LENGTH;
}

/** Run bonus XP pool: one step per rank above the 3-card run opener. */
export function runTrickBonusXpAmount(
  runLength: number,
  xpPerStep: number,
): number {
  return runBonusStepsFromLength(runLength) * xpPerStep;
}

/** Live run bonus pool while a trick is in progress (0 until run length exceeds 3). */
export function activeRunXpPoolInfo(
  state: Pick<
    GameState,
    | "pile"
    | "pileHistory"
    | "pileOwners"
    | "currentTrick"
    | "players"
    | "finishedOrder"
    | "lastPlayPlayerIndex"
  >,
  xpPerStep: number,
): {
  runLength: number;
  poolXp: number;
  pileLeaderId: string | null;
} {
  const runLength = runContextLengthFromState(state);
  const poolXp = runTrickBonusXpAmount(runLength, xpPerStep);
  const leaderIdx = resolveTrickLeaderIndex(state as GameState);
  const pileLeaderId =
    leaderIdx != null && leaderIdx >= 0
      ? (state.players[leaderIdx]?.id ?? null)
      : null;
  return { runLength, poolXp, pileLeaderId };
}

/** Reconstruct run length from a completed trick (uses stored runLength when present). */
export function runLengthFromCompletedTrick(
  trick: TrickHistory,
  players: Player[],
  finishedOrder: string[] = [],
): number {
  if (typeof trick.runLength === "number") return trick.runLength;

  const playActions = trick.actions.filter(
    (a) => a.type === "play" && a.cards && a.cards.length > 0,
  );
  if (playActions.length === 0) return 0;

  let pile: Card[] = [];
  const pileHistory: Card[][] = [];
  const pileOwners: string[] = [];

  for (let i = 0; i < playActions.length; i++) {
    const cards = playActions[i].cards!;
    if (i > 0 && pile.length > 0) {
      pileHistory.push(pile);
      pileOwners.push(playActions[i - 1].playerId);
    }
    pile = cards;
  }

  return runContextLengthFromState({
    pile,
    pileHistory,
    pileOwners,
    currentTrick: trick,
    players,
    finishedOrder,
  });
}

export function isValidPlay(cards: Card[], pile: Card[], tenRule?: { active: boolean; direction: "higher" | "lower" | null }, pileHistory?: Card[][], trickHistory?: TrickHistory[], fourOfAKindChallenge?: FourOfAKindChallenge, currentTrick?: TrickHistory, players?: Player[], finishedOrder?: string[], lastRoundOrder?: string[], currentPlayerId?: string, runOnTop?: boolean) {
  // --- NZ Presidents & Arseholes Rules ---
  // 1. Empty play not allowed
  if (!cards || cards.length === 0) return false;
  const playCount = getPlayCount(cards);
  const pileCount = getPlayCount(pile);
  // 2. First round opening: player anticlockwise from dealer leads; if they hold
  // 3♣ they must open with 3s including it. Later rounds: any legal lead.
  const isRoundOpening =
    pileCount === 0 &&
    (!pileHistory || pileHistory.length === 0) &&
    (!currentTrick || currentTrick.actions.length === 0) &&
    (!trickHistory || trickHistory.length === 0);
  const isFirstRoundOfSession = !lastRoundOrder || lastRoundOrder.length < 2;
  const currentPlayer = currentPlayerId
    ? players?.find((p) => p.id === currentPlayerId)
    : undefined;
  const openerHoldsThreeClubs = !!currentPlayer?.hand?.some(
    (c) => c.value === 3 && c.suit === "clubs",
  );
  if (
    isRoundOpening &&
    isFirstRoundOfSession &&
    players &&
    livingPlayerHasRank(players, 3)
  ) {
    if (!allSameValue(cards) || cards[0].value !== 3) return false;
    if (openerHoldsThreeClubs) {
      const hasThreeClubs = cards.some(
        (c) => c.value === 3 && c.suit === "clubs",
      );
      if (!hasThreeClubs) return false;
    }
    return true;
  }
  // 3. Single-rank-per-turn: no multi-rank plays
  if (!allSameValue(cards)) return false;
  // Jokers beat any non-joker pile but may only be played one at a time
  if (isJoker(cards[0]) && cards.length > 1) return false;
  // 4. Defensive: prevent joker-on-joker plays
  if (isSingleJoker(cards) && pileCount > 0 && pile.some(c => isJoker(c))) return false;
  // 5. Run detection (consecutive single-card plays)
  const { runMultiplicity, inRunContext } = resolveRunContext(
    pile,
    pileHistory,
    currentTrick,
    players,
    finishedOrder || [],
  );
  const pileIsUniform = allSameValue(pile);
  const closesToQuad =
    pileIsUniform &&
    pileCount > 0 &&
    pileCount < 4 &&
    allSameValue(cards) &&
    cards[0].value === pile[0].value &&
    playCount + pileCount === 4;
  // 6. Four-of-a-kind challenge
  if (fourOfAKindChallenge?.active) {
    if (fourOfAKindChallenge.completedAcrossTurns) {
      return false;
    }
    // Single-play bomb — beatable by higher quads or joker (joker rules below)
    if (isFourOfAKind(cards)) {
      return rankIndex(cards[0].value) > rankIndex(fourOfAKindChallenge.value);
    }
    if (!isSingleJoker(cards)) {
      return false;
    }
  }
  // 7. Joker rules — a single joker beats any set on the pile (not during an active run)
  if (isSingleJoker(cards) && pileCount > 0) {
    if (inRunContext) return false;
    const pileItselfIsRun =
      pile.length >= MIN_RUN_CONTEXT_LENGTH && isRunContextSequence(pile);
    if (pileItselfIsRun) return false;
    if (pile.some((c) => isJoker(c))) return false;
    if (tenRule?.active && tenRule.direction === "lower") return false;
    return true;
  }
  // 8. If pile is empty, any uniform play or run is allowed
  if (pileCount === 0) return true;
  // 8b. Closing to four-of-a-kind across turns (before 10-rule — same-rank
  // completion must be allowed even when tens triggered higher/lower mode).
  if (closesToQuad && !inRunContext) return true;
  // 9. 10 Rule: only outside run contexts (including on top!)
  if (tenRule?.active && tenRule.direction && !inRunContext) {
    if (!allSameValue(cards)) return false;
    const pileRank = rankIndex(pile[0].value);
    const playRank = rankIndex(cards[0].value);
    if (tenRule.direction === "higher") {
      return playRank > pileRank;
    } else if (tenRule.direction === "lower") {
      return playRank < pileRank;
    }
  }
  // 10. Run logic: extend with an adjacent rank from the pile top.
  // Tens do not activate or override runs — only adjacency applies here.
  if (inRunContext && !isJoker(cards[0])) {
    if (playCount !== runMultiplicity) return false;
    if (!allSameValue(pile)) return false;
    return isAdjacentToPileTop(pile, cards[0].value);
  }
  // 10b. Skip-over run extension before a 3-card context exists (e.g. J-Q-J then K).
  if (
    !inRunContext &&
    playCount === pileCount &&
    pileIsUniform &&
    !isJoker(cards[0]) &&
    !isAdjacentToPileTop(pile, cards[0].value)
  ) {
    const chronology = buildSameMultiplicityChronology(
      pile,
      pileHistory,
      currentTrick,
      players,
      finishedOrder || [],
    );
    if (chronology.length >= 3) {
      const playVal = cards[0].value;
      const extendsFromAnchor = getRunExtensionAnchorValues(chronology, pile).some(
        (anchor) =>
          anchor !== pile[0].value &&
          Math.abs(rankIndex(playVal) - rankIndex(anchor)) === 1,
      );
      if (extendsFromAnchor) {
        const hypothetical = [...chronology, cards[0]];
        const run = resolveRunFromChronology(hypothetical, cards);
        if (run.length >= MIN_RUN_CONTEXT_LENGTH) return true;
      }
    }
  }
  // 11. Twos rule: only Joker or completing quad can beat 2s (not when 2 is run tail)
  const pileIsTwos =
    pileIsUniform && pile.length > 0 && pile[0].value === 15 && (!inRunContext || runOnTop);
  if (pileIsTwos) {
    if (isSingleJoker(cards)) return true;
    if (allSameValue(cards) && cards[0].value === 15 && pileCount + playCount === 4) {
      return true;
    }
    return false;
  }
  // 13. Regular play: must match count, must be strictly higher rank
  if (playCount !== pileCount) return false;
  if (!allSameValue(pile)) return false;
  const top = rankIndex(pile[0].value);
  const plTop = rankIndex(cards[0].value);
  return plTop > top;
}

// Context-only run detection for sequences formed via consecutive single-card plays.
// Allows 10s and 2s (e.g. K-A-2) in the sequence; jokers still break runs.
export function isRunContextSequence(cards: Card[]): boolean {
  if (!cards || cards.length < MIN_RUN_CONTEXT_LENGTH) return false;
  for (let i = 0; i < cards.length; i++) {
    if (isJoker(cards[i])) return false;
  }

  const firstStep = rankIndex(cards[1].value) - rankIndex(cards[0].value);
  if (Math.abs(firstStep) !== 1) return false;
  const direction = firstStep > 0 ? 1 : -1;

  // Strictly monotonic — rejects ping-pong like 6-7-6-7 or 10-9-10-9.
  for (let i = 1; i < cards.length; i++) {
    const prev = rankIndex(cards[i - 1].value);
    const cur = rankIndex(cards[i].value);
    if (cur - prev !== direction) return false;
  }

  const uniqueValues = [...new Set(cards.map((c) => c.value))];
  if (uniqueValues.length < MIN_RUN_CONTEXT_LENGTH) return false;
  const sortedUnique = uniqueValues.sort((a, b) => rankIndex(a) - rankIndex(b));
  for (let i = 1; i < sortedUnique.length; i++) {
    const prev = rankIndex(sortedUnique[i - 1]);
    const cur = rankIndex(sortedUnique[i]);
    if (cur !== prev + 1) return false;
  }
  return true;
}

/** +1 ascending, -1 descending — from the first two ranks of an established run. */
export function runDirection(runSeq: Card[]): number {
  if (!runSeq || runSeq.length < 2) return 1;
  const step = rankIndex(runSeq[1].value) - rankIndex(runSeq[0].value);
  return step > 0 ? 1 : -1;
}

// special helpers
export function containsTwo(cards: Card[]) {
  // Accept both legacy numeric-2 (2) and internal-two (15).
  return cards.some((c) => c.value === 15 || c.value === 2);
}

export function containsTen(cards: Card[]) {
  return cards.some((c) => c.value === 10);
}

export function isJoker(card: Card) {
  return card.suit === "joker" && card.value === 16;
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
// - Jokers are not allowed in runs; 2s may cap a sequence after Ace (K-A-2)
// - Suits are irrelevant
// - No wrapping beyond 2 (K-A-2 is the high end of the ladder)
export function isRun(cards: Card[]): boolean {
  if (!cards || cards.length === 0) return false;

  // Build frequency map for each rank value
  const freq: { [value: number]: number } = {};
  for (const c of cards) {
    // Disallow jokers from being part of runs
    if (c.value === 16) return false;
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

type CpuPlayContext = {
  pile: Card[];
  tenRule?: { active: boolean; direction: "higher" | "lower" | null };
  pileHistory?: Card[][];
  trickHistory?: TrickHistory[];
  fourOfAKindChallenge?: FourOfAKindChallenge;
  currentTrick?: TrickHistory;
  players?: Player[];
  finishedOrder?: string[];
  lastRoundOrder?: string[];
  currentPlayerId?: string;
  runOnTop?: boolean;
};

function cpuPlayIsValid(hand: Card[], cards: Card[] | null, ctx: CpuPlayContext): boolean {
  if (!cards || cards.length === 0) return false;
  for (const c of cards) {
    if (!hand.some((h) => h.suit === c.suit && h.value === c.value)) return false;
  }
  return isValidPlay(
    cards,
    ctx.pile,
    ctx.tenRule,
    ctx.pileHistory,
    ctx.trickHistory,
    ctx.fourOfAKindChallenge,
    ctx.currentTrick,
    ctx.players,
    ctx.finishedOrder,
    ctx.lastRoundOrder,
    ctx.currentPlayerId,
    ctx.runOnTop,
  );
}

/** Brute-force any legal play when heuristics miss (prevents CPU deadlocks). */
function enumerateValidCpuPlay(hand: Card[], ctx: CpuPlayContext): Card[] | null {
  if (!hand.length) return null;
  const grouped: Record<number, Card[]> = {};
  hand.forEach((card) => {
    if (!grouped[card.value]) grouped[card.value] = [];
    grouped[card.value].push(card);
  });

  const pileCount = ctx.pile.length;
  const candidates: Card[][] = [];

  if (pileCount === 0) {
    const threeOfClubs = hand.find((c) => c.value === 3 && c.suit === "clubs");
    if (threeOfClubs) candidates.push(grouped[3] ?? [threeOfClubs]);
    const values = Object.keys(grouped)
      .map(Number)
      .sort((a, b) => rankIndex(a) - rankIndex(b));
    for (const v of values) candidates.push(grouped[v]);
  } else {
    const joker = hand.find((c) => isJoker(c));
    if (joker) candidates.push([joker]);
    for (const value of Object.keys(grouped).map(Number)) {
      const need = cardsNeededToPlay(ctx.pile, value);
      const cards = grouped[value];
      if (cards && cards.length >= need) {
        candidates.push(cards.slice(0, need));
      }
    }
  }

  candidates.sort((a, b) => rankIndex(a[0].value) - rankIndex(b[0].value));
  for (const play of candidates) {
    if (cpuPlayIsValid(hand, play, ctx)) return play;
  }
  return null;
}

// AI function to find the best valid play for a CPU player
export function findCPUPlay(
  hand: Card[],
  pile: Card[],
  tenRule?: { active: boolean; direction: "higher" | "lower" | null },
  pileHistory?: Card[][],
  fourOfAKindChallenge?: FourOfAKindChallenge,
  currentTrick?: TrickHistory,
  players?: Player[],
  finishedOrder?: string[],
  trickHistory?: TrickHistory[],
  lastRoundOrder?: string[],
  currentPlayerId?: string,
  runOnTop?: boolean,
): Card[] | null {
  if (!hand || hand.length === 0) return null;

  const ctx: CpuPlayContext = {
    pile,
    tenRule,
    pileHistory,
    trickHistory,
    fourOfAKindChallenge,
    currentTrick,
    players,
    finishedOrder,
    lastRoundOrder,
    currentPlayerId,
    runOnTop,
  };

  const pileCount = pile.length;
  const jokerCard = hand.find((c) => isJoker(c));

  // Group cards by value
  const grouped: { [key: number]: Card[] } = {};
  hand.forEach((card) => {
    if (!grouped[card.value]) grouped[card.value] = [];
    grouped[card.value].push(card);
  });

  // If pile is empty, prefer 3♣ if present; else play the lowest rank index set (single-rank-per-turn)
  if (pileCount === 0) {
    const threeOfClubs = hand.find((c) => c.value === 3 && c.suit === "clubs");
    const emptyCandidates: Card[][] = [];
    if (threeOfClubs) emptyCandidates.push(grouped[3] || [threeOfClubs]);
    const values = Object.keys(grouped)
      .map(Number)
      .sort((a, b) => rankIndex(a) - rankIndex(b));
    for (const v of values) emptyCandidates.push(grouped[v]);
    for (const candidate of emptyCandidates) {
      if (cpuPlayIsValid(hand, candidate, ctx)) return candidate;
    }
    return enumerateValidCpuPlay(hand, ctx);
  }

  // Effective run context: extend with an adjacent card/group matching multiplicity
  const { runMultiplicity, inRunContext } = resolveRunContext(
    pile,
    pileHistory,
    currentTrick,
    players,
    finishedOrder || [],
  );
  if (inRunContext) {
    if (runMultiplicity === 1) {
      const adjCandidates = hand.filter((c) => {
        if (isJoker(c)) return false;
        return isAdjacentToPileTop(pile, c.value);
      });
      adjCandidates.sort((a, b) => rankIndex(a.value) - rankIndex(b.value));
      for (const adjCard of adjCandidates) {
        const candidate = [adjCard];
        if (cpuPlayIsValid(hand, candidate, ctx)) return candidate;
      }
    } else {
      const values = Object.keys(grouped).map(Number).sort((a, b) => rankIndex(a) - rankIndex(b));
      for (const v of values) {
        const cards = grouped[v];
        if (cards.length >= runMultiplicity) {
          if (isAdjacentToPileTop(pile, v)) {
            const candidate = cards.slice(0, runMultiplicity);
            if (cpuPlayIsValid(hand, candidate, ctx)) return candidate;
          }
        }
      }
    }
    return null;
  }

  // Completed four-of-a-kind across turns: unbeatable — CPU must pass
  if (fourOfAKindChallenge?.active && fourOfAKindChallenge.completedAcrossTurns) {
    return null;
  }

  // Normal play: match count and beat value (single-rank-per-turn)
  const pileRankIndex = rankIndex(pile[0].value);
  const validPlays: Card[][] = [];

  // Special: pile is uniform 2s — only Joker or completing quad allowed (not run tail)
  const pileIsUniform = allSameValue(pile);
  const pileIsTwos =
    pileIsUniform && pile.length > 0 && pile[0].value === 15 && (!inRunContext || runOnTop);
  if (pileIsTwos) {
    const twos = grouped[15];
    // Only allow completing quad (pile has 1-3 twos, play remaining to reach 4)
    if (twos && pileCount + twos.length === 4) {
      validPlays.push(twos.slice(0, 4 - pileCount));
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
    Object.keys(grouped).forEach((valueStr) => {
      const value = Number(valueStr);
      const cards = grouped[value];
      if (value === 16) return; // skip jokers here
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

  if (validPlays.length === 0 && jokerCard && !pile.some((c) => isJoker(c))) {
    validPlays.push([jokerCard]);
  }
  validPlays.sort((a, b) => rankIndex(a[0].value) - rankIndex(b[0].value));
  for (const candidate of validPlays) {
    if (cpuPlayIsValid(hand, candidate, ctx)) return candidate;
  }
  return enumerateValidCpuPlay(hand, ctx);
}

/** Apply one CPU turn: play (with 10-rule choice) or pass. Never no-ops unless truly stuck. */
export function applyCpuTurn(state: GameState, playerId: string): GameState {
  const pIndex = state.players.findIndex((p) => p.id === playerId);
  if (pIndex === -1 || state.currentPlayerIndex !== pIndex) return state;
  const player = state.players[pIndex];

  const runOnTop =
    !!state.runOnTop?.active && state.runOnTop.playerIndex === pIndex;

  const cpuPlay = findCPUPlay(
    player.hand,
    state.pile,
    state.tenRule,
    state.pileHistory,
    state.fourOfAKindChallenge,
    state.currentTrick,
    state.players,
    state.finishedOrder,
    state.trickHistory,
    state.lastRoundOrder,
    player.id,
    runOnTop,
  );

  if (cpuPlay && cpuPlay.length > 0) {
    const nextState = playCards(state, playerId, cpuPlay);
    if (nextState !== state) {
      if (nextState.tenRulePending) {
        const direction = Math.random() < 0.5 ? "higher" : "lower";
        return setTenRuleDirection(nextState, direction);
      }
      return nextState;
    }
  }

  const passed = passTurn(state, playerId);
  return passed;
}

/** Empty pile with no plays yet in the current trick (includes post-win leads). */
export function isTrickOpeningLead(state: GameState): boolean {
  return (
    state.pile.length === 0 &&
    (!state.pileHistory || state.pileHistory.length === 0) &&
    (!!state.currentTrick && state.currentTrick.actions.length === 0)
  );
}

/** First lead of the round (3♣ opener only). */
export function isRoundOpeningLead(state: GameState): boolean {
  return (
    isTrickOpeningLead(state) &&
    (!state.trickHistory || state.trickHistory.length === 0)
  );
}

/** Index of the player who last played on the current trick (pile leader). */
export function resolveTrickLeaderIndex(state: GameState): number | null {
  let leaderIndex = state.lastPlayPlayerIndex ?? null;
  if (
    (leaderIndex === null || leaderIndex < 0) &&
    state.currentTrick &&
    state.currentTrick.actions.length > 0
  ) {
    const lastPlay = [...state.currentTrick.actions]
      .reverse()
      .find((a) => a.type === "play");
    if (lastPlay) {
      const idx = state.players.findIndex((p) => p.id === lastPlay.playerId);
      if (idx >= 0) leaderIndex = idx;
    }
  }
  return leaderIndex;
}

/** Leader gets one on-top beat after everyone else passes on a run / 10-rule pile. */
function grantRunOnTopBeat(state: GameState, leaderIndex: number): GameState {
  syncFinishedFromEmptyHands(state);
  const leaderPlayer = state.players[leaderIndex];
  if (!isPlayerStillIn(state, leaderPlayer.id)) {
    return finalizeTrickWin(state, leaderIndex);
  }
  if (state.currentTrick?.actions?.length) {
    state.currentTrick.actions = state.currentTrick.actions.filter(
      (action) =>
        !(action.type === "pass" && action.playerId === leaderPlayer.id),
    );
    syncPassCountFromTrick(state);
  }
  state.runOnTop = { active: true, playerIndex: leaderIndex };
  state.currentPlayerIndex = leaderIndex;
  state.mustPlay = true;
  return { ...state };
}

/** Clear the pile and award the trick to the last player who played. */
function finalizeTrickWin(state: GameState, leaderIndex: number): GameState {
  const runLengthAtWin = runContextLengthFromState(state);
  state.pile = [];
  state.passCount = 0;
  state.runOnTop = undefined;
  state.lastPlayPlayerIndex = null;
  if (state.pileHistory && state.pileHistory.length > 0) {
    state.tableStacks = state.tableStacks || [];
    state.tableStackOwners = state.tableStackOwners || [];
    for (let i = 0; i < state.pileHistory.length; i++) {
      state.tableStacks.push(state.pileHistory[i]);
      state.tableStackOwners.push(
        state.pileOwners && state.pileOwners[i] ? state.pileOwners[i] : null,
      );
    }
    state.pileHistory = [];
    state.pileOwners = [];
  }
  state.lastClear = undefined;
  state.fourOfAKindChallenge = undefined;
  state.tenRule = { active: false, direction: null };
  state.tenRulePending = false;

  if (leaderIndex >= 0) {
    const winnerPlayer = state.players[leaderIndex];
    if (state.currentTrick) {
      state.currentTrick.runLength = runLengthAtWin;
      state.currentTrick.winnerId = winnerPlayer.id;
      state.currentTrick.winnerName = winnerPlayer.name;
      state.trickHistory = state.trickHistory || [];
      state.trickHistory.push(state.currentTrick);
      state.currentTrick = {
        trickNumber: state.trickHistory.length + 1,
        actions: [],
      };
    }
    syncFinishedFromEmptyHands(state);
    if (isRoundCompleteForLiving(state)) {
      return { ...state };
    }
    if (isPlayerStillIn(state, winnerPlayer.id)) {
      state.currentPlayerIndex = leaderIndex;
      state.mustPlay = true;
    } else {
      state.currentPlayerIndex = nextActivePlayerIndex(state, leaderIndex);
      state.mustPlay = false;
    }
  }
  return { ...state };
}

export function passTurn(state: GameState, playerId: string): GameState {
  const pIndex = state.players.findIndex((p) => p.id === playerId);
  if (pIndex === -1) return state;
  if (state.currentPlayerIndex !== pIndex) return state;

  if (state.tenRulePending) {
    return state;
  }

  if (!isPlayerStillIn(state, playerId)) {
    syncFinishedFromEmptyHands(state);
    state.currentPlayerIndex = nextActivePlayerIndex(state, pIndex);
    return { ...state };
  }

  try {
    console.log(`[core] passTurn ENTRY playerId=${playerId} currentPlayerIndex=${state.currentPlayerIndex} lastPlayPlayerIndex=${state.lastPlayPlayerIndex} passCount=${state.passCount}`);
    if (state.currentTrick) console.log(`[core] currentTrick.actions.length=${state.currentTrick.actions.length}`);
  } catch (e) {}

  // Trick / round opener with mustPlay cannot pass on an empty pile.
  if (state.mustPlay && isTrickOpeningLead(state)) {
    return state;
  }

  const player = state.players[pIndex];

  // Leader passes on their "on top!" beat — trick ends with them winning.
  if (state.runOnTop?.active && state.runOnTop.playerIndex === pIndex) {
    if (!state.currentTrick) {
      state.currentTrick = { trickNumber: (state.trickHistory?.length || 0) + 1, actions: [] };
    }
    state.currentTrick.actions.push({
      type: "pass",
      playerId: player.id,
      playerName: player.name,
      timestamp: Date.now(),
    });
    syncPassCountFromTrick(state);
    const leaderIndex =
      resolveTrickLeaderIndex(state) ?? state.runOnTop.playerIndex;
    state.runOnTop = undefined;
    syncFinishedFromEmptyHands(state);
    if (leaderIndex === null || leaderIndex < 0) {
      return { ...state };
    }
    return finalizeTrickWin(state, leaderIndex);
  }

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
  syncPassCountFromTrick(state);

  // Debugging detail: log current pass/finalization state to help diagnose
  // premature trick finalization. This prints active players, leader, others
  // set, passed ids, and the last few actions of currentTrick.
  try {
    const activePlayerIds = state.players.filter((p) => isPlayerStillIn(state, p.id)).map((p) => p.id);
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
  const activePlayerIds = state.players.filter((p) => isPlayerStillIn(state, p.id)).map((p) => p.id);

  const leaderIndex = resolveTrickLeaderIndex(state);
  const leaderId =
    leaderIndex !== null && leaderIndex >= 0
      ? state.players[leaderIndex].id
      : null;

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
      const onTopEligible = isOnTopEligiblePile(
        state.pile,
        state.pileHistory,
        state.currentTrick,
        state.players,
        state.finishedOrder || [],
        state.tenRule,
      );
      if (
        onTopEligible &&
        !state.runOnTop?.active &&
        leaderIndex !== null &&
        leaderIndex >= 0
      ) {
        return grantRunOnTopBeat(state, leaderIndex);
      }
      syncFinishedFromEmptyHands(state);
      return finalizeTrickWin(state, leaderIndex);
    }
  }

  // Safety net: every living player passed but the trick did not resolve above.
  const allActivePassed =
    activePlayerIds.length > 0 &&
    activePlayerIds.every((id) => passedIds.has(id));
  if (allActivePassed && leaderIndex !== null && leaderIndex >= 0) {
    if (state.runOnTop?.active) {
      syncFinishedFromEmptyHands(state);
      return finalizeTrickWin(state, leaderIndex);
    }
    const onTopEligible = isOnTopEligiblePile(
      state.pile,
      state.pileHistory,
      state.currentTrick,
      state.players,
      state.finishedOrder || [],
      state.tenRule,
    );
    if (onTopEligible) {
      return grantRunOnTopBeat(state, leaderIndex);
    }
    syncFinishedFromEmptyHands(state);
    return finalizeTrickWin(state, leaderIndex);
  }

  syncFinishedFromEmptyHands(state);
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
    if (isPlayerStillIn(state, p.id)) return idx;
  }
  return fromIndex;
}
