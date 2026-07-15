import assert from "assert";
import {
  playWouldActivateRun,
  consecutiveSequenceInfo,
  isRunContextSequence,
  type Card,
  type Player,
  type TrickHistory,
} from "../src/game/core";

const c = (value: number, suit: Card["suit"] = "hearts"): Card => ({
  value,
  suit,
});

const players: Player[] = [
  {
    id: "a",
    name: "A",
    hand: [c(9), c(10), c(9, "spades"), c(11)],
    role: "Neutral",
  },
  {
    id: "b",
    name: "B",
    hand: [c(3), c(4), c(5), c(6)],
    role: "Neutral",
  },
];

const pile = [c(9, "spades")];
const pileHistory = [[c(9)], [c(10)], [c(9, "spades")]];
const currentTrick: TrickHistory = {
  trickNumber: 1,
  actions: [
    { type: "play", playerId: "a", playerName: "A", cards: [c(9)], timestamp: 1 },
    { type: "play", playerId: "b", playerName: "B", cards: [c(10)], timestamp: 2 },
    {
      type: "play",
      playerId: "a",
      playerName: "A",
      cards: [c(9, "spades")],
      timestamp: 3,
    },
  ],
};

const jack = [c(11)];
const would = playWouldActivateRun(
  jack,
  pile,
  pileHistory,
  currentTrick,
  players,
  [],
  { id: "b", name: "B" },
);

const simulated: TrickHistory = {
  ...currentTrick,
  actions: [
    ...currentTrick.actions,
    {
      type: "play",
      playerId: "b",
      playerName: "B",
      cards: jack,
      timestamp: 4,
    },
  ],
};
const seq = consecutiveSequenceInfo(
  jack,
  pileHistory,
  simulated,
  players,
  [],
);

console.log("wouldActivate", would);
console.log(
  "seq",
  seq.repCards.map((x) => x.value),
  "valid",
  isRunContextSequence(seq.repCards),
);

assert.strictEqual(
  would,
  false,
  "9-10-9-J must NOT activate Runs (skip-over must not invent 9-10-J)",
);
console.log("PASS: 9-10-9-J does not activate Runs");
