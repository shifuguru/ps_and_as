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
// core.ts
// Core game state and logic for Presidents & Assholes
const ruleset_1 = require("./ruleset");
function createGame(playerNames) {
    const players = playerNames.map((n, i) => ({ id: String(i + 1), name: n, hand: [], role: "Neutral" }));
    const deck = (0, ruleset_1.shuffleDeck)((0, ruleset_1.createDeck)());
    (0, ruleset_1.dealCards)(deck, players);
    return {
        id: "game-" + Date.now(),
        players,
        currentPlayerIndex: 0,
        pile: [],
        passCount: 0,
        finishedOrder: [],
        started: true,
    };
}
function playCards(state, playerId, cards) {
    // Very small validation: ensure it's that player's turn and they have the cards
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
    // Validate play type: must play same number of cards as pile (unless pile is empty)
    if (!isValidPlay(cards, state.pile))
        return state;
    // remove cards from player's hand
    player.hand = player.hand.filter((h) => !cards.some((c) => c.suit === h.suit && c.value === h.value));
    // Special rules first
    // If any played card is a 2, it clears the pile immediately
    if (containsTwo(cards)) {
        state.pile = [];
        state.passCount = 0;
    }
    else if (isFourOfAKind(cards)) {
        // four of a kind clears the pile
        state.pile = [];
        state.passCount = 0;
    }
    else {
        // normal play replaces the pile
        state.pile = cards;
        state.passCount = 0;
    }
    // if player emptied hand, add to finished
    if (player.hand.length === 0) {
        state.finishedOrder.push(player.id);
    }
    // advance turn
    state.currentPlayerIndex = (state.currentPlayerIndex + 1) % state.players.length;
    return { ...state };
}
// Helpers for play validation
function getPlayCount(cards) {
    return cards.length;
}
function getHighestValue(cards) {
    if (!cards || cards.length === 0)
        return -1;
    return Math.max(...cards.map((c) => c.value));
}
function isValidPlay(cards, pile) {
    // empty play not allowed
    if (!cards || cards.length === 0)
        return false;
    const playCount = getPlayCount(cards);
    const pileCount = getPlayCount(pile);
    // if pile is empty, any play is allowed
    if (pileCount === 0)
        return true;
    // must match the count
    if (playCount !== pileCount)
        return false;
    // must have higher top value
    const top = getHighestValue(pile);
    const plTop = getHighestValue(cards);
    return plTop > top;
}
// special helpers
function containsTwo(cards) {
    return cards.some((c) => c.value === 2);
}
function isFourOfAKind(cards) {
    if (!cards || cards.length !== 4)
        return false;
    const v = cards[0].value;
    return cards.every((c) => c.value === v);
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
function passTurn(state, playerId) {
    const pIndex = state.players.findIndex((p) => p.id === playerId);
    if (pIndex === -1)
        return state;
    if (state.currentPlayerIndex !== pIndex)
        return state;
    state.passCount += 1;
    state.currentPlayerIndex = (state.currentPlayerIndex + 1) % state.players.length;
    // if all other players passed, clear the pile
    if (state.passCount >= state.players.length - 1) {
        state.pile = [];
        state.passCount = 0;
    }
    return { ...state };
}
