// ruleset.ts
// This file contains the core logic for the Presidents and Assholes game.

export type Card = {
  suit: "hearts" | "diamonds" | "clubs" | "spades" | "joker";
  value: number; // numeric face: 3..14 (A=14); two=15, joker=16 (game encodings)
  hidden?: boolean;
};

/** Display rank for UI — matches internal encoding in createDeck(). */
export function formatCardRank(card: Pick<Card, "suit" | "value" | "hidden">): string {
  if (card.hidden) return "";
  if (card.suit === "joker" || card.value === 16) return "JOKER";
  if (card.value === 15) return "2";
  if (card.value >= 3 && card.value <= 10) return String(card.value);
  if (card.value === 11) return "J";
  if (card.value === 12) return "Q";
  if (card.value === 13) return "K";
  if (card.value === 14) return "A";
  return "?";
}

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
      // Map numeric '2' to the game's internal two-value (15)
      if (value === 2) {
        deck.push({ suit, value: 15 });
      } else {
        deck.push({ suit, value });
      }
    }
  }

  // add two jokers as highest rank (now 16)
  deck.push({ suit: "joker", value: 16 });
  deck.push({ suit: "joker", value: 16 });

  return deck;
}

// Shuffle the deck using Fisher-Yates algorithm
export function shuffleDeck(deck: Card[]): Card[] {
  const copy = deck.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s += 0x6d2b79f5;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministic shuffle so every client in a room deals the same hands. */
export function shuffleDeckSeeded(deck: Card[], seed: number): Card[] {
  const copy = deck.slice();
  const random = mulberry32(seed);
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
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