/**
 * Run detection regression tests.
 * Run: npm run test-runs
 */
import {
  runFromCurrentTrickInfo,
  effectivePile,
  isRunContextSequence,
  isValidPlay,
  createGame,
  playCards,
  passTurn,
} from "../src/game/core";
import type { Card } from "../src/game/ruleset";

function card(v: number, suit: Card["suit"] = "spades"): Card {
  return { value: v, suit };
}

const players = [
  { id: "1", name: "P1", hand: [], role: "Neutral" as const },
  { id: "2", name: "P2", hand: [], role: "Neutral" as const },
  { id: "3", name: "P3", hand: [], role: "Neutral" as const },
  { id: "4", name: "P4", hand: [], role: "Neutral" as const },
];

function makeAction(
  type: "play" | "pass",
  playerIdx: number,
  cards?: Card[],
) {
  const p = players[playerIdx];
  if (type === "pass") {
    return {
      type: "pass" as const,
      playerId: p.id,
      playerName: p.name,
      timestamp: Date.now(),
    };
  }
  return {
    type: "play" as const,
    playerId: p.id,
    playerName: p.name,
    cards: cards!,
    timestamp: Date.now(),
  };
}

type Case = {
  name: string;
  actions: ReturnType<typeof makeAction>[];
  pile: Card[];
  pileHistory?: Card[][];
  expectRun: boolean;
  expectValues?: number[];
  trickOnly?: boolean;
};

const cases: Case[] = [
  {
    name: "basic singles 3-4-5",
    actions: [
      makeAction("play", 0, [card(3)]),
      makeAction("play", 1, [card(4)]),
      makeAction("play", 2, [card(5)]),
    ],
    pile: [card(5)],
    expectRun: true,
    expectValues: [3, 4, 5],
  },
  {
    name: "singles 3-4-5 with pass between 4 and 5",
    actions: [
      makeAction("play", 0, [card(3)]),
      makeAction("play", 1, [card(4)]),
      makeAction("pass", 2),
      makeAction("play", 3, [card(5)]),
    ],
    pile: [card(5)],
    expectRun: true,
    expectValues: [3, 4, 5],
  },
  {
    name: "singles 3-4-5 with passes after 5",
    actions: [
      makeAction("play", 0, [card(3)]),
      makeAction("play", 1, [card(4)]),
      makeAction("play", 2, [card(5)]),
      makeAction("pass", 3),
      makeAction("pass", 0),
    ],
    pile: [card(5)],
    expectRun: true,
    expectValues: [3, 4, 5],
  },
  {
    name: "9-10-J singles (10 in run context)",
    actions: [
      makeAction("play", 0, [card(9)]),
      makeAction("play", 1, [card(10)]),
      makeAction("play", 2, [card(11)]),
    ],
    pile: [card(11)],
    expectRun: true,
    expectValues: [9, 10, 11],
  },
  {
    name: "Q-K-A singles",
    actions: [
      makeAction("play", 0, [card(12)]),
      makeAction("play", 1, [card(13)]),
      makeAction("play", 2, [card(14)]),
    ],
    pile: [card(14)],
    expectRun: true,
    expectValues: [12, 13, 14],
  },
  {
    name: "broken by double play mid-sequence",
    actions: [
      makeAction("play", 0, [card(3)]),
      makeAction("play", 1, [card(4)]),
      makeAction("play", 2, [card(4), card(4)]),
    ],
    pile: [card(4), card(4)],
    expectRun: false,
  },
  {
    name: "non-consecutive ranks 3-4-6",
    actions: [
      makeAction("play", 0, [card(3)]),
      makeAction("play", 1, [card(4)]),
      makeAction("play", 2, [card(6)]),
    ],
    pile: [card(6)],
    expectRun: false,
  },
  {
    name: "pileHistory singles 6-7-8 (trick actions empty)",
    actions: [],
    pile: [card(8)],
    pileHistory: [[card(6)], [card(7)], [card(8)]],
    expectRun: true,
    expectValues: [6, 7, 8],
    trickOnly: false,
  },
  {
    name: "pileHistory broken by double in history",
    actions: [],
    pile: [card(8)],
    pileHistory: [[card(6)], [card(7), card(7)], [card(8)]],
    expectRun: false,
    trickOnly: false,
  },
  {
    name: "run extended 3-4-5-6",
    actions: [
      makeAction("play", 0, [card(3)]),
      makeAction("play", 1, [card(4)]),
      makeAction("play", 2, [card(5)]),
      makeAction("play", 3, [card(6)]),
    ],
    pile: [card(6)],
    expectRun: true,
    expectValues: [3, 4, 5, 6],
  },
  {
    name: "suffix run J-Q-K after non-consecutive 9 (terminal repro)",
    actions: [
      makeAction("play", 0, [card(9)]),
      makeAction("play", 1, [card(11)]),
      makeAction("play", 2, [card(12)]),
      makeAction("play", 3, [card(13)]),
    ],
    pile: [card(13)],
    expectRun: true,
    expectValues: [11, 12, 13],
  },
  {
    name: "only J-Q before K — not yet a run",
    actions: [
      makeAction("play", 0, [card(9)]),
      makeAction("play", 1, [card(11)]),
      makeAction("play", 2, [card(12)]),
    ],
    pile: [card(12)],
    expectRun: false,
  },
  {
    name: "pass between each play 3 pass 4 pass 5",
    actions: [
      makeAction("play", 0, [card(3)]),
      makeAction("pass", 1),
      makeAction("play", 2, [card(4)]),
      makeAction("pass", 3),
      makeAction("play", 0, [card(5)]),
    ],
    pile: [card(5)],
    expectRun: true,
    expectValues: [3, 4, 5],
  },
  {
    name: "doubles run 33-44-55",
    actions: [
      makeAction("play", 0, [card(3), card(3)]),
      makeAction("play", 1, [card(4), card(4)]),
      makeAction("play", 2, [card(5), card(5)]),
    ],
    pile: [card(5), card(5)],
    expectRun: true,
    expectValues: [3, 4, 5],
  },
  {
    name: "doubles run with pass between 44 and 55",
    actions: [
      makeAction("play", 0, [card(3), card(3)]),
      makeAction("play", 1, [card(4), card(4)]),
      makeAction("pass", 2),
      makeAction("play", 3, [card(5), card(5)]),
    ],
    pile: [card(5), card(5)],
    expectRun: true,
    expectValues: [3, 4, 5],
  },
  {
    name: "pileHistory doubles 33-44-55",
    actions: [],
    pile: [card(5), card(5)],
    pileHistory: [
      [card(3), card(3)],
      [card(4), card(4)],
      [card(5), card(5)],
    ],
    expectRun: true,
    expectValues: [3, 4, 5],
    trickOnly: false,
  },
];

function detectRun(
  actions: Case["actions"],
  pile: Card[],
  pileHistory?: Card[][],
) {
  const currentTrick = { trickNumber: 1, actions };
  const info = runFromCurrentTrickInfo(currentTrick, players, []);
  const trickRun =
    info.repCards.length >= 3 && isRunContextSequence(info.repCards);
  const eff = effectivePile(pile, pileHistory);
  const historyRun = eff.length >= 3 && isRunContextSequence(eff);
  return {
    trickValues: info.repCards.map((c) => c.value),
    effValues: eff.map((c) => c.value),
    detected: trickRun || historyRun,
    trickRun,
    historyRun,
  };
}

let failed = 0;
let passed = 0;

console.log("\n=== Run detection regression tests ===\n");

for (const c of cases) {
  const { trickValues, effValues, detected, trickRun, historyRun } = detectRun(
    c.actions,
    c.pile,
    c.pileHistory,
  );

  const valuesMatch =
    !c.expectValues ||
    JSON.stringify(trickValues) === JSON.stringify(c.expectValues) ||
    JSON.stringify(effValues) === JSON.stringify(c.expectValues);

  const ok = detected === c.expectRun && valuesMatch;

  if (ok) {
    passed++;
    console.log(`PASS  ${c.name}`);
  } else {
    failed++;
    console.log(`FAIL  ${c.name}`);
    console.log(
      `      expected run=${c.expectRun} values=${JSON.stringify(c.expectValues)}`,
    );
    console.log(
      `      got trick=${JSON.stringify(trickValues)} (run=${trickRun}) eff=${JSON.stringify(effValues)} (run=${historyRun})`,
    );
  }
}

// Integration: playCards with passes between consecutive singles
console.log("\n=== Integration: playCards with intervening passes ===\n");

{
  const g = createGame(["P1", "P2", "P3", "P4"]);
  g.players.forEach((p) => (p.hand = []));
  g.pile = [];
  g.pileHistory = [];
  g.currentTrick = { trickNumber: 1, actions: [] };
  g.mustPlay = false;

  const three = card(3, "clubs");
  const four = card(4);
  const five = card(5);
  const six = card(6);

  g.players[0].hand = [three];
  g.players[1].hand = [];
  g.players[2].hand = [four];
  g.players[3].hand = [five, six];
  g.currentPlayerIndex = 0;

  let s = playCards(g, "1", [three]);
  s = passTurn(s, "2");
  s = playCards(s, "3", [four]);
  s = passTurn(s, "4");
  s = playCards(s, "1", [five]);

  const info = runFromCurrentTrickInfo(s.currentTrick, s.players, []);
  const eff = effectivePile(s.pile, s.pileHistory);
  const runActive =
    (info.repCards.length >= 3 && isRunContextSequence(info.repCards)) ||
    (eff.length >= 3 && isRunContextSequence(eff));

  const sixValid = isValidPlay(
    [six],
    s.pile,
    s.tenRule,
    s.pileHistory,
    s.trickHistory,
    s.fourOfAKindChallenge,
    s.currentTrick,
    s.players,
    s.finishedOrder,
  );

  if (runActive && sixValid) {
    passed++;
    console.log("PASS  integration: 3-pass-4-pass-5 detects run; 6 is valid");
  } else {
    failed++;
    console.log("FAIL  integration: 3-pass-4-pass-5");
    console.log(
      `      runActive=${runActive} sixValid=${sixValid} trick=${info.repCards.map((c) => c.value)} eff=${eff.map((c) => c.value)}`,
    );
  }
}

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
