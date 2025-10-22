"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createGame = createGame;
exports.playCards = playCards;
exports.getPlayCount = getPlayCount;
exports.getHighestValue = getHighestValue;
exports.isValidPlay = isValidPlay;
exports.containsTwo = containsTwo;
exports.isFourOfAKind = isFourOfAKind;
exports.findValidSingleCard = findValidSingleCard;
exports.passTurn = passTurn;
// core.ts (compiled proxy) - synced to match src/game/core.ts logic
const ruleset_1 = require("./ruleset");
// Rank order: 3,4,5,6,7,8,9,10,11(J),12(Q),13(K),14(A),2,15(Joker)
const RANK_ORDER = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 2, 15];
function rankIndex(value) {
    const idx = RANK_ORDER.indexOf(value);
    return idx >= 0 ? idx : -1;
}
function createGame(playerNames) {
    const players = playerNames.map((n, i) => ({ id: String(i + 1), name: n, hand: [], role: "Neutral" }));
    const deck = (0, ruleset_1.shuffleDeck)((0, ruleset_1.createDeck)());
    (0, ruleset_1.dealCards)(deck, players);
    // find 3 of clubs starter
    const threeIndex = players.findIndex((p) => p.hand.some((c) => c.suit === 'clubs' && c.value === 3));
    const start = threeIndex >= 0 ? threeIndex : 0;
    return {
        id: "game-" + Date.now(),
        players,
        currentPlayerIndex: start,
        pile: [],
        passCount: 0,
        finishedOrder: [],
        started: true,
        lastPlayPlayerIndex: null,
        mustPlay: threeIndex >= 0 ? true : false,
        pileHistory: [],
    };
}
function playCards(state, playerId, cards) {
    const pIndex = state.players.findIndex((p) => p.id === playerId);
    if (pIndex === -1)
        return state;
    if (state.currentPlayerIndex !== pIndex)
        return state;
    const player = state.players[pIndex];
    // check that player has all cards
    for (const c of cards) {
        const found = player.hand.findIndex((h) => h.suit === c.suit && h.value === c.value);
        if (found === -1)
            return state;
    }
    // all played cards must have the same value
    if (!allSameValue(cards))
        return state;
    // validate play type
    if (!isValidPlay(cards, state.pile))
        return state;
    // remove cards from player's hand
    player.hand = player.hand.filter((h) => !cards.some((c) => c.suit === h.suit && c.value === h.value));
    // record who played last
    state.lastPlayPlayerIndex = pIndex;
    // Special rules
    if (containsTwo(cards)) {
        state.pile = [];
        state.pileHistory = [];
        state.passCount = 0;
        state.currentPlayerIndex = pIndex;
        state.mustPlay = true;
    }
    else if (isFourOfAKind(cards)) {
        state.pile = [];
        state.pileHistory = [];
        state.passCount = 0;
        state.currentPlayerIndex = pIndex;
        state.mustPlay = true;
    }
    else {
        state.pile = cards;
        state.pileHistory = state.pileHistory || [];
        state.pileHistory.push(cards.slice());
        state.passCount = 0;
        state.currentPlayerIndex = nextActivePlayerIndex(state, pIndex);
        state.mustPlay = false;
    }
    if (player.hand.length === 0) {
        state.finishedOrder.push(player.id);
    }
    return Object.assign({}, state);
}
function getPlayCount(cards) {
    return cards ? cards.length : 0;
}
function getHighestValue(cards) {
    if (!cards || cards.length === 0)
        return -1;
    // use rankIndex comparison
    return Math.max(...cards.map((c) => rankIndex(c.value)));
}
function isValidPlay(cards, pile) {
    if (!cards || cards.length === 0)
        return false;
    const playCount = getPlayCount(cards);
    const pileCount = getPlayCount(pile);
    if (pileCount === 0)
        return true;
    if (playCount !== pileCount)
        return false;
    if (!allSameValue(pile))
        return false;
    const top = rankIndex(pile[0].value);
    const plTop = rankIndex(cards[0].value);
    return plTop > top;
}
function containsTwo(cards) {
    return cards.some((c) => c.value === 2);
}
function isFourOfAKind(cards) {
    if (!cards || cards.length !== 4)
        return false;
    const v = cards[0].value;
    return cards.every((c) => c.value === v);
}
function findValidSingleCard(hand, pile) {
    if (!hand || hand.length === 0)
        return null;
    const pileTop = getHighestValue(pile);
    if (!pile || pile.length === 0) {
        // lowest by rankIndex
        return hand.reduce((min, c) => (rankIndex(c.value) < rankIndex(min.value) ? c : min), hand[0]);
    }
    const candidates = hand.filter((c) => rankIndex(c.value) > pileTop);
    if (candidates.length === 0)
        return null;
    return candidates.reduce((min, c) => (rankIndex(c.value) < rankIndex(min.value) ? c : min), candidates[0]);
}
function passTurn(state, playerId) {
    const pIndex = state.players.findIndex((p) => p.id === playerId);
    if (pIndex === -1)
        return state;
    if (state.currentPlayerIndex !== pIndex)
        return state;
    // If the current player is required to play (leader), they cannot pass
    if (state.mustPlay)
        return state;
    state.passCount = (state.passCount || 0) + 1;
    state.currentPlayerIndex = (state.currentPlayerIndex + 1) % state.players.length;
    if (state.passCount >= state.players.length - 1) {
        state.pile = [];
        state.passCount = 0;
        const winner = state.lastPlayPlayerIndex != null ? state.lastPlayPlayerIndex : null;
        if (winner !== null && winner >= 0 && !state.finishedOrder.includes(state.players[winner].id)) {
            state.currentPlayerIndex = winner;
            state.mustPlay = true;
        }
        else {
            state.currentPlayerIndex = nextActivePlayerIndex(state, state.currentPlayerIndex);
            state.mustPlay = false;
        }
    }
    return Object.assign({}, state);
}
function allSameValue(cards) {
    if (!cards || cards.length === 0)
        return false;
    const v = cards[0].value;
    return cards.every((c) => c.value === v);
}
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
