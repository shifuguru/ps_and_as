"use strict";
// ruleset.ts
// This file contains the core logic for the Presidents and Assholes game.
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDeck = createDeck;
exports.shuffleDeck = shuffleDeck;
exports.dealCards = dealCards;
exports.assignRoles = assignRoles;
// Create a standard 52-card deck
function createDeck() {
    const suits = ["hearts", "diamonds", "clubs", "spades"];
    const deck = [];
    for (const suit of suits) {
        for (let value = 2; value <= 14; value++) {
            deck.push({ suit, value });
        }
    }
    return deck;
}
// Shuffle the deck using Fisher-Yates algorithm
function shuffleDeck(deck) {
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
}
// Deal cards to players
function dealCards(deck, players) {
    const handSize = Math.floor(deck.length / players.length);
    for (let i = 0; i < players.length; i++) {
        players[i].hand = deck.slice(i * handSize, (i + 1) * handSize);
    }
}
// Assign roles to players based on their rankings
function assignRoles(players) {
    // Sort players by the order they finished (e.g., first to finish is ranked highest)
    players.sort((a, b) => a.hand.length - b.hand.length);
    // Assign roles based on rankings
    players.forEach((player, index) => {
        if (index === 0) {
            player.role = "President";
        }
        else if (index === 1) {
            player.role = "Vice President";
        }
        else if (index === players.length - 2) {
            player.role = "Vice Asshole";
        }
        else if (index === players.length - 1) {
            player.role = "Asshole";
        }
        else {
            player.role = "Neutral";
        }
    });
}
// Example usage
const deck = shuffleDeck(createDeck());
const players = [
    { id: "1", name: "Alice", hand: [], role: "Neutral" },
    { id: "2", name: "Bob", hand: [], role: "Neutral" },
    { id: "3", name: "Charlie", hand: [], role: "Neutral" },
    { id: "4", name: "Dana", hand: [], role: "Neutral" },
];
dealCards(deck, players);
assignRoles(players);
console.log("Roles after assignment:", players);
