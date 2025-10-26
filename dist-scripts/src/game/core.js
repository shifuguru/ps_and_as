"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RANK_ORDER = void 0;
exports.createGame = createGame;
exports.playCards = playCards;
exports.setTenRuleDirection = setTenRuleDirection;
exports.getPlayCount = getPlayCount;
exports.rankIndex = rankIndex;
exports.getHighestValue = getHighestValue;
exports.effectivePile = effectivePile;
exports.nextActiveIndexFromList = nextActiveIndexFromList;
exports.hasPassedInCurrentTrick = hasPassedInCurrentTrick;
exports.runFromCurrentTrick = runFromCurrentTrick;
exports.isValidPlay = isValidPlay;
exports.containsTwo = containsTwo;
exports.containsTen = containsTen;
exports.isJoker = isJoker;
exports.isSingleJoker = isSingleJoker;
exports.isFourOfAKind = isFourOfAKind;
exports.isRun = isRun;
exports.findValidSingleCard = findValidSingleCard;
exports.findCPUPlay = findCPUPlay;
exports.passTurn = passTurn;
exports.allSameValue = allSameValue;
exports.nextActivePlayerIndex = nextActivePlayerIndex;
// core.ts
// Core game state and logic for Presidents & Assholes
const ruleset_1 = require("./ruleset");
function createGame(playerNames) {
    const players = playerNames.map((n, i) => ({ id: String(i + 1), name: n, hand: [], role: "Neutral" }));
    const deck = (0, ruleset_1.shuffleDeck)((0, ruleset_1.createDeck)());
    (0, ruleset_1.dealCards)(deck, players);
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
        trickHistory: [],
        currentTrick: { trickNumber: 1, actions: [] },
        tenRule: { active: false, direction: null },
    };
}
function playCards(state, playerId, cards) {
    var _a, _b, _c, _d, _e;
    // Very small validation: ensure it's that player's turn and they have the cards
    const pIndex = state.players.findIndex((p) => p.id === playerId);
    if (pIndex === -1)
        return state;
    if (state.currentPlayerIndex !== pIndex)
        return state;
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
        if (found === -1)
            return state;
    }
    // Special validation for the very first play of the entire game only.
    // Previously this checked only for an empty pile/pileHistory which caused
    // later trick-clears (four-of-a-kind/2/joker) to be mistaken for the game's
    // opening play. To avoid that, require that there is no trick history and
    // the current trick has no recorded actions.
    const isFirstPlay = state.pile.length === 0 &&
        (!state.pileHistory || state.pileHistory.length === 0) &&
        (!state.trickHistory || state.trickHistory.length === 0) &&
        (!!state.currentTrick && state.currentTrick.actions.length === 0);
    if (isFirstPlay) {
        // First play must include the 3 of clubs
        const hasThreeOfClubs = cards.some((c) => c.value === 3 && c.suit === "clubs");
        if (!hasThreeOfClubs)
            return state;
        // All cards must be 3s (can play 3♣ alone or with other 3s)
        const allThrees = cards.every((c) => c.value === 3);
        if (!allThrees)
            return state;
    }
    // all played cards must have the same value OR be a valid run
    const isPlayRun = isRun(cards);
    if (!allSameValue(cards) && !isPlayRun)
        return state;
    // Validate play type: must play same number of cards as pile (unless pile is empty)
    // Enforce clear precedence: if this play is a 2 and the current trick already
    // contains a Joker or an active four-of-a-kind clear, reject it. We also use
    // state.lastClear to track the highest-clear type in the current trick.
    if (containsTwo(cards)) {
        if (((_a = state.lastClear) === null || _a === void 0 ? void 0 : _a.type) === "joker" || ((_b = state.lastClear) === null || _b === void 0 ? void 0 : _b.type) === "four") {
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
            const possible = findCPUPlay(player.hand, state.pile, state.tenRule, state.pileHistory, state.fourOfAKindChallenge, state.currentTrick, state.players, state.finishedOrder);
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
        state.currentTrick = { trickNumber: (((_c = state.trickHistory) === null || _c === void 0 ? void 0 : _c.length) || 0) + 1, actions: [] };
    }
    state.currentTrick.actions.push({
        type: "play",
        playerId: player.id,
        playerName: player.name,
        cards: cards.slice(),
        timestamp: Date.now(),
    });
    // Joker is the highest card, players are given the chance to pass on it for visuals.
    // Twos are high, but 4x 2s are higher than 2s alone. Joker beats both.
    // Four-of-a-kind starts a special challenge: 
    // the next player must play another set of four of a higher
    // rank or a Joker to beat it. 
    // Do NOT finalize tricks immediately, allow players to respond or pass.
    // For a single Joker here: we want the Joker to remain visible so other
    // players can pass on it before the trick is finalized by passTurn.
    let trickEnded = false;
    // Check if 10 was played - will need user input for direction
    const playedTen = containsTen(cards);
    if (playedTen && !((_d = state.tenRule) === null || _d === void 0 ? void 0 : _d.active)) {
        // 10 rule is being activated - add cards to pile but pause for player input
        state.pile = cards;
        state.pileHistory = state.pileHistory || [];
        state.pileHistory.push(cards.slice());
        state.pileOwners = state.pileOwners || [];
        state.pileOwners.push(player.id);
        state.passCount = 0;
        state.tenRule = { active: true, direction: null };
        return { ...state, tenRulePending: true };
    }
    // If 10 rule was active and a valid play was made, deactivate it
    if (((_e = state.tenRule) === null || _e === void 0 ? void 0 : _e.active) && state.tenRule.direction) {
        state.tenRule = { active: false, direction: null };
    }
    // Special rules first
    // If any played card is a 2, it clears the pile immediately and the player who played it leads next
    if (containsTwo(cards)) {
        // set lastClear to two (unless a higher clear is already present, which
        // should have been rejected earlier)
        state.lastClear = { type: "two", value: 2, playerIndex: pIndex };
        state.pile = [];
        state.pileHistory = [];
        state.pileOwners = [];
        state.passCount = 0;
        state.currentPlayerIndex = pIndex;
        state.mustPlay = true;
    }
    else if (isFourOfAKind(cards)) {
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
            }
            else {
                // Not high enough to beat the current challenge -> invalid, but should
                // have been rejected already by isValidPlay. Return state defensively.
                return state;
            }
        }
        else {
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
    }
    else if (isSingleJoker(cards)) {
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
        }
        else {
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
    }
    else {
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
        state.currentPlayerIndex = pIndex;
        state.mustPlay = true;
        // Clear lastClear as the trick has concluded
        state.lastClear = undefined;
    }
    // if player emptied hand, add to finished
    if (player.hand.length === 0 && !state.finishedOrder.includes(player.id)) {
        state.finishedOrder.push(player.id);
    }

    // Defensive: ensure any players with empty hands are recorded as finished
    // to avoid them remaining active and producing infinite-pass loops.
    for (const p of state.players) {
        if (p.hand.length === 0 && !state.finishedOrder.includes(p.id)) {
            state.finishedOrder.push(p.id);
        }
    }
    return { ...state };
}
// Function to set the 10 rule direction after user chooses
function setTenRuleDirection(state, direction) {
    var _a, _b;
    if (!((_a = state.tenRule) === null || _a === void 0 ? void 0 : _a.active) || state.tenRule.direction !== null) {
        return state; // Can only set if 10 rule is pending
    }
    state.tenRule.direction = direction;
    state.tenRulePending = false;
    // Find the most recent play action in currentTrick and add the direction
    if (state.currentTrick && state.currentTrick.actions.length > 0) {
        const lastAction = state.currentTrick.actions[state.currentTrick.actions.length - 1];
        if (lastAction.type === "play" && ((_b = lastAction.cards) === null || _b === void 0 ? void 0 : _b.some(c => c.value === 10))) {
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
function getPlayCount(cards) {
    return cards.length;
}
// Rank order: 3,4,5,6,7,8,9,10,J(11),Q(12),K(13),A(14),2(2),Joker(15)
exports.RANK_ORDER = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 2, 15];
function rankIndex(value) {
    const idx = exports.RANK_ORDER.indexOf(value);
    return idx >= 0 ? idx : -1;
}
function getHighestValue(cards) {
    if (!cards || cards.length === 0)
        return -1;
    return Math.max(...cards.map((c) => rankIndex(c.value)));
}
// Determine the effective pile for run detection: either the current pile if it
// is already a run of length>=3, or the concatenation of last single-card plays
// from pileHistory (chronological) if those form a run. This lets sequences like
// [3],[4],[5] be treated as an active 3-card run even though state.pile is [5].
function effectivePile(pile, pileHistory) {
    try {
        if (pile && pile.length >= 3 && isRun(pile))
            return pile;
        if (!pileHistory || pileHistory.length === 0)
            return pile;
        const collected = [];
        // walk backwards through history collecting consecutive single-card plays
        for (let i = pileHistory.length - 1; i >= 0; i--) {
            const entry = pileHistory[i];
            if (!entry || entry.length !== 1)
                break;
            const c = entry[0];
            // Ten and Joker cannot form part of a run
            if (c.value === 10 || c.value === 15)
                break;
            collected.push(c);
        }
            // collected is reverse chronological (newest first) -> reverse to chronological
            collected.reverse();
            if (collected.length >= 3 && isRun(collected)) {
                try { console.log("[core] effectivePile detected run from pileHistory: " + collected.map(c => c.value).join(',')); } catch (e) { }
                return collected;
            }
            return pile;
    }
    catch (e) {
        return pile;
    }
}
// Helper: compute next active player index given players array and finishedOrder
function nextActiveIndexFromList(players, finishedOrder, fromIndex) {
    const n = players.length;
    if (n === 0)
        return 0;
    for (let i = 1; i <= n; i++) {
        const idx = (fromIndex + i) % n;
        const p = players[idx];
        if (!finishedOrder.includes(p.id))
            return idx;
    }
    return fromIndex;
}
// Check whether a given player has already passed in the current trick
function hasPassedInCurrentTrick(state, playerId) {
    if (!state.currentTrick)
        return false;
    return state.currentTrick.actions.some(a => a.type === 'pass' && a.playerId === playerId);
}
// Build an effective run formed by consecutive single-card plays from the current trick.
// We only consider the tail of currentTrick.actions where each action is a single-card play
// and each play was made by the next active player after the previous one.
function runFromCurrentTrick(currentTrick, players, finishedOrder = []) {
    if (!currentTrick || !players)
        return [];
    const actions = currentTrick.actions;
    if (!actions || actions.length === 0)
        return [];
    const collected = [];
    const playerIdxs = [];
    // Iterate backwards over actions to build the tail of consecutive single-card plays.
    // We collect them in chronological order by prepending earlier actions.
    for (let i = actions.length - 1; i >= 0; i--) {
        const a = actions[i];
        // stop if not a single-card play
        if (a.type !== 'play' || !a.cards || a.cards.length !== 1)
            break;
        const card = a.cards[0];
        // Ten and Joker cannot form part of a run
        if (card.value === 10 || isJoker(card))
            break;
        const pIndex = players.findIndex((p) => p.id === a.playerId);
        if (pIndex === -1)
            break;
        if (collected.length === 0) {
            // newest play -> will become the last element in chronological array
            collected.unshift(card);
            playerIdxs.unshift(pIndex);
        }
        else {
            // For the earlier action to be part of the run, its next active player
            // (skipping finished players) must equal the previously collected player's index
            const expectedNext = nextActiveIndexFromList(players, finishedOrder, pIndex);
            // The previously collected player's index (the one immediately after this action
            // in chronological order) will be at the front of the playerIdxs array because
            // we unshift earlier actions. Compare against the first element, not the last.
            if (expectedNext !== playerIdxs[0])
                break;
            // prepend the earlier action so collected remains chronological
            collected.unshift(card);
            playerIdxs.unshift(pIndex);
        }
    }
    if (collected.length >= 3 && isRun(collected)) {
        try { console.log("[core] runFromCurrentTrick detected run: " + collected.map(c => c.value).join(',') + " players=" + playerIdxs.join(',')); } catch (e) { }
        return collected;
    }
    return [];
}
function isValidPlay(cards, pile, tenRule, pileHistory, fourOfAKindChallenge, currentTrick, players, finishedOrder) {
    // empty play not allowed
    if (!cards || cards.length === 0)
        return false;
    const playCount = getPlayCount(cards);
    const pileCount = getPlayCount(pile);
    // Defensive: prevent joker-on-joker plays. A single joker cannot beat an
    // active pile that already contains a joker.
    if (isSingleJoker(cards) && pileCount > 0 && pile.some(c => isJoker(c)))
        return false;
    // Check if it's a run
    const isPlayRun = isRun(cards);
    // detect runs that may be formed across recent single-card plays
    // Prefer run made by consecutive players in current trick; fall back to pileHistory heuristic
    let effPile = effectivePile(pile, pileHistory);
    const trickRun = runFromCurrentTrick(currentTrick, players, finishedOrder || []);
    if (trickRun && trickRun.length >= 3) {
        effPile = trickRun;
    }
    const isPileRun = effPile.length >= 3 && isRun(effPile);
    // Determine run origin: was the active run played as a single multi-card play
    // (i.e. pile itself is a run) or was it formed across consecutive single-card
    // plays (pileHistory or currentTrick). If formed across single-card plays,
    // subsequent players may only play a single adjacency card, not a same-length run.
    const pileIsActualRun = pile && pile.length >= 3 && isRun(pile);
    const runFromTrick = !!(trickRun && trickRun.length >= 3);
    const runFromHistory = !runFromTrick && !pileIsActualRun && effPile.length >= 3 && isRun(effPile);
    // If a four-of-a-kind challenge is active, only allow another four-of-a-kind
    // that is strictly higher, or a single Joker. Everything else must pass.
    if (fourOfAKindChallenge === null || fourOfAKindChallenge === void 0 ? void 0 : fourOfAKindChallenge.active) {
        const challengeVal = fourOfAKindChallenge.value;
        // Joker beats the challenge
        if (isSingleJoker(cards))
            return true;
        // only a 4-of-a-kind of the same count and higher rank can beat it
        if (isFourOfAKind(cards)) {
            const playRank = rankIndex(cards[0].value);
            const challengeRank = rankIndex(challengeVal);
            return playRank > challengeRank;
        }
        return false;
    }
    // Single joker can beat anything (including doubles, triples, quads)
    if (isSingleJoker(cards) && pileCount > 0)
        return true;
    // all cards in the play must be the same value OR be a valid run
    if (!allSameValue(cards) && !isPlayRun)
        return false;
    // if pile is empty, any uniform play or run is allowed
    if (pileCount === 0)
        return true;
    // If 10 rule is active, check direction constraint
    if ((tenRule === null || tenRule === void 0 ? void 0 : tenRule.active) && tenRule.direction) {
        if (!allSameValue(cards))
            return false; // 10 rule only applies to same-value plays
        const pileRank = rankIndex(pile[0].value);
        const playRank = rankIndex(cards[0].value);
        if (tenRule.direction === "higher") {
            return playRank > pileRank; // Must be strictly higher
        }
        else if (tenRule.direction === "lower") {
            return playRank < pileRank; // Must be strictly lower
        }
    }
    // Runs must match runs (same length, higher starting value)
    if (isPileRun) {
        // Runs have extra restrictions: Ten and Joker cannot be used in runs
        if (cards.some(c => c.value === 10 || c.value === 15))
            return false;
        // If the play is a run, it must match length and have a higher starting value
        if (isPlayRun) {
            // If the active run was formed across consecutive single-card plays,
            // a single player cannot play a same-length run — only single-card
            // adjacency plays are permitted.
            if (runFromTrick || runFromHistory) return false;
            if (playCount !== effPile.length)
                return false;
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
    if (playCount !== pileCount)
        return false;
    // pile must also be uniform (defensive)
    if (!allSameValue(pile))
        return false;
    // must have higher value than pile's value
    const top = rankIndex(pile[0].value);
    const plTop = rankIndex(cards[0].value);
    return plTop > top;
}
// special helpers
function containsTwo(cards) {
    return cards.some((c) => c.value === 2);
}
function containsTen(cards) {
    return cards.some((c) => c.value === 10);
}
function isJoker(card) {
    return card.value === 15 && card.suit === "joker";
}
function isSingleJoker(cards) {
    return cards.length === 1 && isJoker(cards[0]);
}
function isFourOfAKind(cards) {
    if (!cards || cards.length !== 4)
        return false;
    const v = cards[0].value;
    return cards.every((c) => c.value === v);
}
function isRun(cards) {
    if (!cards || cards.length === 0)
        return false;
    // Build frequency map for each rank value
    const freq = {};
    for (const c of cards) {
        // Disallow tens and jokers (and 2s) from being part of runs
        if (c.value === 10 || c.value === 15 || c.value === 2)
            return false;
        freq[c.value] = (freq[c.value] || 0) + 1;
    }
    const uniqueValues = Object.keys(freq).map(Number);
    // Need at least 3 distinct ranks to form a run
    if (uniqueValues.length < 3)
        return false;
    // All multiplicities must be equal
    const multiplicities = Object.values(freq);
    const m = multiplicities[0];
    if (!multiplicities.every((x) => x === m))
        return false;
    // Total cards must equal m * L
    const L = uniqueValues.length;
    if (cards.length !== m * L)
        return false;
    // Sort unique ranks by rankIndex and ensure they are consecutive
    const sortedUnique = uniqueValues.sort((a, b) => rankIndex(a) - rankIndex(b));
    for (let i = 1; i < sortedUnique.length; i++) {
        const prev = rankIndex(sortedUnique[i - 1]);
        const cur = rankIndex(sortedUnique[i]);
        if (cur !== prev + 1)
            return false;
    }
    return true;
}
// find a simple valid single-card play from hand (used by hotseat auto-play)
function findValidSingleCard(hand, pile) {
    if (!hand || hand.length === 0)
        return null;
    const pileTop = getHighestValue(pile);
    // if pile empty, play the lowest value
    if (pile.length === 0) {
        return hand.reduce((min, c) => (c.value < min.value ? c : min), hand[0]);
    }
    // otherwise find lowest card greater than pileTop
    const candidates = hand.filter((c) => c.value > pileTop);
    if (candidates.length === 0)
        return null;
    return candidates.reduce((min, c) => (c.value < min.value ? c : min), candidates[0]);
}
// AI function to find the best valid play for a CPU player
function findCPUPlay(hand, pile, tenRule, pileHistory, fourOfAKindChallenge, currentTrick, players, finishedOrder) {
    if (!hand || hand.length === 0)
        return null;
    const pileCount = pile.length;
    // Check if we have a single joker - it can beat anything
    const jokerCard = hand.find(c => isJoker(c));
    if (jokerCard && pileCount > 0) {
        // Consider playing joker if we don't have better options
        // For now, save joker as last resort
    }
    // Group cards by value
    const grouped = {};
    hand.forEach(card => {
        if (!grouped[card.value])
            grouped[card.value] = [];
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
    if (trickRun && trickRun.length >= 3)
        effPile = trickRun;
    const isPileRun = effPile.length >= 3 && isRun(effPile);
    // If a four-of-a-kind challenge is active, only try to play a higher
    // four-of-a-kind or a Joker.
    if (fourOfAKindChallenge === null || fourOfAKindChallenge === void 0 ? void 0 : fourOfAKindChallenge.active) {
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
        if (jokerCard)
            return [jokerCard];
        return null;
    }
    // Find valid plays: same count, higher rank
    const validPlays = [];
    // If pile is a run, we need to find runs in our hand
    if (isPileRun) {
        const runLength = effPile.length;
        const pileStartRank = rankIndex(effPile[0].value);
        // Determine run origin: allow same-length run attempts only if the run
        // on the pile was an actual multi-card play (pile itself is a run).
        const pileIsActualRun = pile && pile.length >= 3 && isRun(pile);
        const runFromTrick = !!(trickRun && trickRun.length >= 3);
        const runFromHistory = !runFromTrick && !pileIsActualRun && effPile.length >= 3 && isRun(effPile);

        // If the pile is an actual single multi-card run, try to find same-length runs
        // in hand that beat it. If the run was formed across single-card plays
        // (runFromTrick or runFromHistory), skip same-length-run attempts and only
        // allow a single adjacency card response.
        if (!runFromTrick && !runFromHistory) {
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
        }

        // Fallback: single-card adjacency plays are always allowed against a run
        // formed by consecutive single-card plays, and also are the fallback when
        // we couldn't find a same-length beating run. Ten and Joker are not
        // allowed as adjacency responses.
        if (validPlays.length === 0) {
            const lastRank = rankIndex(effPile[effPile.length - 1].value);
            const adjCard = hand.find(c => {
                const r = rankIndex(c.value);
                if (c.value === 10 || c.value === 15)
                    return false; // disallow ten/joker in runs
                return Math.abs(r - lastRank) === 1;
            });
            if (adjCard)
                validPlays.push([adjCard]);
        }
    } else {
        // Normal play: match count and beat value
        Object.keys(grouped).forEach(valueStr => {
            const value = Number(valueStr);
            const cards = grouped[value];
            // Skip joker group for normal grouped-matching logic. Jokers are handled as a
            // special single-card fallback (one joker is sufficient to beat any pile).
            if (value === 15)
                return;
            // Check if we have enough cards of this value
            if (cards.length >= pileCount) {
                const valueRankIndex = rankIndex(value);
                // Apply 10 rule constraints if active
                if ((tenRule === null || tenRule === void 0 ? void 0 : tenRule.active) && tenRule.direction) {
                    if (tenRule.direction === "higher" && valueRankIndex <= pileRankIndex) {
                        return; // Skip this value
                    }
                    if (tenRule.direction === "lower" && valueRankIndex >= pileRankIndex) {
                        return; // Skip this value
                    }
                }
                else {
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
    if (validPlays.length === 0)
        return null;
    // Strategy: Play the lowest valid card to conserve high cards
    validPlays.sort((a, b) => rankIndex(a[0].value) - rankIndex(b[0].value));
    return validPlays[0];
}
function passTurn(state, playerId) {
    var _a, _b;
    try {
        console.log(`[core] passTurn ENTRY playerId=${playerId} currentPlayerIndex=${state.currentPlayerIndex} lastPlayPlayerIndex=${state.lastPlayPlayerIndex} passCount=${state.passCount}`);
        if (state.currentTrick)
            console.log(`[core] currentTrick.actions.length=${state.currentTrick.actions.length}`);
    }
    catch (e) { }
    const pIndex = state.players.findIndex((p) => p.id === playerId);
    if (pIndex === -1)
        return state;
    if (state.currentPlayerIndex !== pIndex)
        return state;
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
            }
            else {
                return state; // player has at least one valid play and therefore cannot pass
            }
        }
    }
    const player = state.players[pIndex];
    // Track this pass in current trick
    if (!state.currentTrick) {
        state.currentTrick = { trickNumber: (((_a = state.trickHistory) === null || _a === void 0 ? void 0 : _a.length) || 0) + 1, actions: [] };
    }
    state.currentTrick.actions.push({
        type: "pass",
        playerId: player.id,
        playerName: player.name,
        timestamp: Date.now(),
    });
    try {
        console.log(`[core] passTurn pushed pass for playerId=${player.id}. now actions.length=${state.currentTrick.actions.length}`);
    }
    catch (e) { }
        // Recompute passed players from currentTrick actions (distinct ids)
        const passedIds = new Set(state.currentTrick.actions.filter(a => a.type === 'pass').map(a => a.playerId));
        state.passCount = passedIds.size; // keep passCount in sync

        // Debugging detail: log current pass/finalization state to help diagnose
        // premature trick finalization. This prints active players, leader, others
        // set, passed ids, and the last few actions of currentTrick.
        try {
            const activePlayerIds = state.players.filter(p => !state.finishedOrder.includes(p.id)).map(p => p.id);
            const leaderIdx = (_a = state.lastPlayPlayerIndex) !== null && _a !== void 0 ? _a : null;
            const leaderPid = (leaderIdx !== null && leaderIdx >= 0) ? state.players[leaderIdx].id : null;
            const othersDebug = activePlayerIds.filter(id => id !== leaderPid);
            const passedArray = Array.from(passedIds);
            const lastActions = state.currentTrick.actions.slice(-6);
            console.log("[core DEBUG] passTurn status: active=" + JSON.stringify(activePlayerIds) + ", leader=" + leaderPid + ", others=" + JSON.stringify(othersDebug) + ", passed=" + JSON.stringify(passedArray) + ", lastActions=" + JSON.stringify(lastActions));
        }
        catch (e) { }
    // Use nextActivePlayerIndex to skip finished players for the next turn (tentative)
    state.currentPlayerIndex = nextActivePlayerIndex(state, pIndex);
    // Determine active players for the trick (not finished)
    const activePlayerIds = state.players.filter(p => !state.finishedOrder.includes(p.id)).map(p => p.id);
    // Who last played? That player is considered the leader for this trick
    const leaderIndex = (_b = state.lastPlayPlayerIndex) !== null && _b !== void 0 ? _b : null;
    const leaderId = (leaderIndex !== null && leaderIndex >= 0) ? state.players[leaderIndex].id : null;
    // If all other active players (i.e., everyone except the leader) have passed,
    // the trick ends: clear the pile, winner leads next trick, and record the trick.
    if (leaderId !== null) {
        const others = activePlayerIds.filter(id => id !== leaderId);
        const allOthersPassed = others.length === 0 || others.every(id => passedIds.has(id));
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

                    // New rule: last player who passed is awarded the next turn. Find
                    // the most recent pass in currentTrick.actions.
                    var lastPassPlayerId = null;
                    if (state.currentTrick && state.currentTrick.actions && state.currentTrick.actions.length > 0) {
                        for (var i = state.currentTrick.actions.length - 1; i >= 0; i--) {
                            var a = state.currentTrick.actions[i];
                            if (a.type === 'pass') {
                                lastPassPlayerId = a.playerId;
                                break;
                            }
                        }
                    }

                    var winnerIndexToUse = null;
                    if (lastPassPlayerId) {
                        winnerIndexToUse = state.players.findIndex(function (p) { return p.id === lastPassPlayerId; });
                    }
                    if (winnerIndexToUse === -1)
                        winnerIndexToUse = null;

                    if (winnerIndexToUse !== null && winnerIndexToUse >= 0) {
                        var winnerPlayer = state.players[winnerIndexToUse];
                        state.currentTrick.winnerId = winnerPlayer.id;
                        state.currentTrick.winnerName = winnerPlayer.name;
                        state.trickHistory = state.trickHistory || [];
                        state.trickHistory.push(state.currentTrick);
                        state.currentTrick = { trickNumber: state.trickHistory.length + 1, actions: [] };
                        for (var _i = 0, _a = state.players; _i < _a.length; _i++) {
                            var p = _a[_i];
                            if (p.hand.length === 0 && !state.finishedOrder.includes(p.id)) {
                                state.finishedOrder.push(p.id);
                            }
                        }
                        if (!state.finishedOrder.includes(winnerPlayer.id)) {
                            state.currentPlayerIndex = winnerIndexToUse;
                            state.mustPlay = true;
                        }
                        else {
                            state.currentPlayerIndex = nextActivePlayerIndex(state, winnerIndexToUse);
                            state.mustPlay = false;
                        }
                    }
                    else if (leaderIndex !== null && leaderIndex >= 0) {
                        var winnerPlayer = state.players[leaderIndex];
                        state.currentTrick.winnerId = winnerPlayer.id;
                        state.currentTrick.winnerName = winnerPlayer.name;
                        state.trickHistory = state.trickHistory || [];
                        state.trickHistory.push(state.currentTrick);
                        state.currentTrick = { trickNumber: state.trickHistory.length + 1, actions: [] };
                        for (var _b = 0, _c = state.players; _b < _c.length; _b++) {
                            var p = _c[_b];
                            if (p.hand.length === 0 && !state.finishedOrder.includes(p.id)) {
                                state.finishedOrder.push(p.id);
                            }
                        }
                        if (!state.finishedOrder.includes(winnerPlayer.id)) {
                            state.currentPlayerIndex = leaderIndex;
                            state.mustPlay = true;
                        }
                        else {
                            state.currentPlayerIndex = nextActivePlayerIndex(state, leaderIndex);
                            state.mustPlay = false;
                        }
                    }
                }
    }
    return { ...state };
}
// helper: check all cards have same value
function allSameValue(cards) {
    if (!cards || cards.length === 0)
        return false;
    const v = cards[0].value;
    return cards.every((c) => c.value === v);
}
// helper: find next active player index skipping finished players
function nextActivePlayerIndex(state, fromIndex) {
    const n = state.players.length;
    if (n === 0)
        return 0;
    for (let i = 1; i <= n; i++) {
        const idx = (fromIndex + i) % n;
        const p = state.players[idx];
        if (!state.finishedOrder.includes(p.id))
            return idx;
    }
    return fromIndex;
}
