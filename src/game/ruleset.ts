// ruleset.ts
// This file contains the core logic for the Presidents and Assholes game.

export type Card = {
  suit: "hearts" | "diamonds" | "clubs" | "spades" | "joker";
  value: number; // 2-15 (11=Jack, 12=Queen, 13=King, 14=Ace, 15=Joker)
};

export type Player = {
  id: string;
  name: string;
  hand: Card[];
  role: "President" | "Vice President" | "Neutral" | "Vice Asshole" | "Asshole";
};

// Create a standard 52-card deck
export function createDeck(): Card[] {
  const suits: Card["suit"][] = ["hearts", "diamonds", "clubs", "spades"];
  const deck: Card[] = [];

  for (const suit of suits) {
    for (let value = 2; value <= 14; value++) {
      deck.push({ suit, value });
    }
  }

  // add two jokers as highest rank
  deck.push({ suit: "joker", value: 15 });
  deck.push({ suit: "joker", value: 15 });

  return deck;
}

// Shuffle the deck using Fisher-Yates algorithm
export function shuffleDeck(deck: Card[]): Card[] {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

// Deal cards to players
export function dealCards(deck: Card[], players: Player[]): void {
  // clear hands
  for (const p of players) p.hand = [];
  // deal round-robin
  let idx = 0;
  for (const card of deck) {
    players[idx % players.length].hand.push(card);
    idx++;
  }
}

// Assign roles to players based on their rankings
export function assignRoles(players: Player[]): void {
  // Sort players by the order they finished (e.g., first to finish is ranked highest)
  players.sort((a, b) => a.hand.length - b.hand.length);

  // Assign roles based on rankings
  players.forEach((player, index) => {
    if (index === 0) {
      player.role = "President";
    } else if (index === 1) {
      player.role = "Vice President";
    } else if (index === players.length - 2) {
      player.role = "Vice Asshole";
    } else if (index === players.length - 1) {
      player.role = "Asshole";
    } else {
      player.role = "Neutral";
    }
  });
}

// Example usage
const deck = shuffleDeck(createDeck());
const players: Player[] = [
  { id: "1", name: "Alice", hand: [], role: "Neutral" },
  { id: "2", name: "Bob", hand: [], role: "Neutral" },
  { id: "3", name: "Charlie", hand: [], role: "Neutral" },
  { id: "4", name: "Dana", hand: [], role: "Neutral" },
];

dealCards(deck, players);
assignRoles(players);
console.log("Roles after assignment:", players);