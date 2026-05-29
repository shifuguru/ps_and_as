/**
 * Run detection regression tests.
 * Run: npm run test-runs
 */
import {
  runFromCurrentTrickInfo,
  effectivePile,
  isRunContextSequence,
  isValidPlay,
  resolveRunContext,
  createGame,
  playCards,
  passTurn,
  runContextLengthFromState,
  runBonusStepsFromLength,
  runTrickBonusXpAmount,
  activeRunXpPoolInfo,
  runLengthFromCompletedTrick,
  MIN_RUN_CONTEXT_LENGTH,
  type GameState,
  type TrickHistory,
} from "../src/game/core";
import type { Card } from "../src/game/ruleset";

function card(v: number, suit: Card["suit"] = "spades"): Card {
  return { value: v, suit };
}

function pair(v: number, suits: Card["suit"][] = ["hearts", "diamonds"]): Card[] {
  return suits.map((suit) => card(v, suit));
}

function triple(v: number, suits: Card["suit"][] = ["hearts", "diamonds", "clubs"]): Card[] {
  return suits.map((suit) => card(v, suit));
}

function buildHistory(playGroups: Card[][]): Card[][] {
  if (playGroups.length <= 1) return [];
  return playGroups.slice(0, -1);
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
    name: "singles 3-4 only — not yet a run",
    actions: [
      makeAction("play", 0, [card(3)]),
      makeAction("play", 1, [card(4)]),
    ],
    pile: [card(4)],
    expectRun: false,
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
    name: "K-A-2 singles",
    actions: [
      makeAction("play", 0, [card(13)]),
      makeAction("play", 1, [card(14)]),
      makeAction("play", 2, [card(15)]),
    ],
    pile: [card(15)],
    expectRun: true,
    expectValues: [13, 14, 15],
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
  {
    name: "ten-rule oscillation 10-9-10-9 is not a run",
    actions: [
      makeAction("play", 0, [card(10)]),
      makeAction("play", 1, [card(9)]),
      makeAction("play", 2, [card(10)]),
      makeAction("play", 3, [card(9)]),
    ],
    pile: [card(9)],
    expectRun: false,
  },
  {
    name: "ten-rule partial 10-9-10 is not a run",
    actions: [
      makeAction("play", 0, [card(10)]),
      makeAction("play", 1, [card(9)]),
      makeAction("play", 2, [card(10)]),
    ],
    pile: [card(10)],
    expectRun: false,
  },
  {
    name: "descending with 10: J-10-9 is a run",
    actions: [
      makeAction("play", 0, [card(11)]),
      makeAction("play", 1, [card(10)]),
      makeAction("play", 2, [card(9)]),
    ],
    pile: [card(9)],
    expectRun: true,
    expectValues: [11, 10, 9],
  },
  {
    name: "long singles run 3-4-5-6-7-8",
    actions: [
      makeAction("play", 0, [card(3)]),
      makeAction("play", 1, [card(4)]),
      makeAction("play", 2, [card(5)]),
      makeAction("play", 3, [card(6)]),
      makeAction("play", 0, [card(7)]),
      makeAction("play", 1, [card(8)]),
    ],
    pile: [card(8)],
    expectRun: true,
    expectValues: [3, 4, 5, 6, 7, 8],
  },
  {
    name: "long doubles run 33-44-55-66-77",
    actions: [
      makeAction("play", 0, pair(3)),
      makeAction("play", 1, pair(4)),
      makeAction("play", 2, pair(5)),
      makeAction("play", 3, pair(6)),
      makeAction("play", 0, pair(7)),
    ],
    pile: pair(7),
    expectRun: true,
    expectValues: [3, 4, 5, 6, 7],
  },
  {
    name: "triples run 333-444-555",
    actions: [
      makeAction("play", 0, triple(3)),
      makeAction("play", 1, triple(4)),
      makeAction("play", 2, triple(5)),
    ],
    pile: triple(5),
    expectRun: true,
    expectValues: [3, 4, 5],
  },
  {
    name: "doubles step-back 33-44-55-44",
    actions: [
      makeAction("play", 0, pair(3)),
      makeAction("play", 1, pair(4)),
      makeAction("play", 2, pair(5)),
      makeAction("play", 3, pair(4)),
    ],
    pile: pair(4),
    expectRun: true,
    expectValues: [3, 4, 5],
  },
  {
    name: "skip-over step-back J-Q-J-K keeps run context",
    actions: [
      makeAction("play", 0, [card(11)]),
      makeAction("play", 1, [card(12)]),
      makeAction("play", 2, [card(11)]),
      makeAction("play", 3, [card(13)]),
    ],
    pile: [card(13)],
    expectRun: true,
    expectValues: [11, 12, 13],
  },
  {
    name: "J-Q-J before K — not yet a 3-card run",
    actions: [
      makeAction("play", 0, [card(11)]),
      makeAction("play", 1, [card(12)]),
      makeAction("play", 2, [card(11)]),
    ],
    pile: [card(11)],
    expectRun: false,
  },
];

function detectRun(
  actions: Case["actions"],
  pile: Card[],
  pileHistory?: Card[][],
) {
  const currentTrick = { trickNumber: 1, actions };
  const info = runFromCurrentTrickInfo(currentTrick, players, [], pile);
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

// Integration: consecutive singles with passes (synthetic state — avoids trick auto-close in playCards)
console.log("\n=== Integration: 3-pass-4-pass-5 run ===\n");
{
  const trick = {
    trickNumber: 1,
    actions: [
      makeAction("play", 0, [card(3, "clubs")]),
      makeAction("pass", 1),
      makeAction("play", 2, [card(4)]),
      makeAction("pass", 3),
      makeAction("play", 0, [card(5)]),
    ],
  };
  const pile = [card(5)];
  const history: Card[][] = [[card(3, "clubs")], [card(4)], [card(5)]];

  const ctx = resolveRunContext(pile, history, trick, players, []);
  const sixValid = isValidPlay(
    [card(6)],
    pile,
    undefined,
    history,
    undefined,
    undefined,
    trick,
    players,
    [],
  );

  if (ctx.inRunContext && sixValid) {
    passed++;
    console.log("PASS  integration: 3-pass-4-pass-5 detects run; 6 is valid");
  } else {
    failed++;
    console.log("FAIL  integration: 3-pass-4-pass-5");
    console.log(
      `      inRunContext=${ctx.inRunContext} sixValid=${sixValid} runSeq=${ctx.runSeq.map((c) => c.value)}`,
    );
  }
}

// Two-card sequence: adjacency rules must not apply until 3rd consecutive card
console.log("\n=== Two-card sequence: normal beat-the-pile ===\n");
{
  const trick = {
    trickNumber: 1,
    actions: [
      makeAction("play", 0, [card(3)]),
      makeAction("play", 1, [card(4)]),
    ],
  };
  const pile = [card(4)];
  const history: Card[][] = [[card(3)], [card(4)]];

  const threeInvalid = !isValidPlay(
    [card(3)],
    pile,
    undefined,
    history,
    undefined,
    undefined,
    trick,
    players,
    [],
  );
  const fiveValid = isValidPlay(
    [card(5)],
    pile,
    undefined,
    history,
    undefined,
    undefined,
    trick,
    players,
    [],
  );

  if (threeInvalid && fiveValid) {
    passed++;
    console.log("PASS  3-4 pile: 3 rejected, 5 accepted (normal play)");
  } else {
    failed++;
    console.log("FAIL  3-4 pile: 3 rejected, 5 accepted");
    console.log(`      threeInvalid=${threeInvalid} fiveValid=${fiveValid}`);
  }
}

console.log("\n=== Doubles run: extend 33-44-55 with 66 ===\n");
{
  const trick = {
    trickNumber: 1,
    actions: [
      makeAction("play", 0, [card(3), card(3)]),
      makeAction("play", 1, [card(4), card(4)]),
      makeAction("play", 2, [card(5), card(5)]),
    ],
  };
  const pile = [card(5), card(5)];
  const history: Card[][] = [
    [card(3), card(3)],
    [card(4), card(4)],
    [card(5), card(5)],
  ];
  const sixes = [card(6, "hearts"), card(6, "diamonds")];

  const doublesRun = isValidPlay(
    sixes,
    pile,
    undefined,
    history,
    undefined,
    undefined,
    trick,
    players,
    [],
  );
  const tripleSixInvalid = !isValidPlay(
    [card(6), card(6), card(6)],
    pile,
    undefined,
    history,
    undefined,
    undefined,
    trick,
    players,
    [],
  );

  if (doublesRun && tripleSixInvalid) {
    passed++;
    console.log("PASS  doubles run 33-44-55 accepts 66, rejects triple 6");
  } else {
    failed++;
    console.log("FAIL  doubles run 33-44-55 extension");
    console.log(`      doublesRun=${doublesRun} tripleSixInvalid=${tripleSixInvalid}`);
  }
}

console.log("\n=== Run adjacency: either direction from pile top ===\n");
{
  const trick = {
    trickNumber: 1,
    actions: [
      makeAction("play", 0, [card(5)]),
      makeAction("play", 1, [card(6)]),
      makeAction("play", 2, [card(7)]),
      makeAction("play", 3, [card(8)]),
    ],
  };
  const pile = [card(8)];
  const history: Card[][] = [
    [card(5)],
    [card(6)],
    [card(7)],
    [card(8)],
  ];
  const sevenValid = isValidPlay(
    [card(7)],
    pile,
    undefined,
    history,
    undefined,
    undefined,
    trick,
    players,
    [],
  );
  const nineValid = isValidPlay(
    [card(9)],
    pile,
    undefined,
    history,
    undefined,
    undefined,
    trick,
    players,
    [],
  );
  const sixInvalid = !isValidPlay(
    [card(6)],
    pile,
    undefined,
    history,
    undefined,
    undefined,
    trick,
    players,
    [],
  );
  if (sevenValid && nineValid && sixInvalid) {
    passed++;
    console.log("PASS  5-6-7-8 run: 7 and 9 allowed on 8, 6 rejected");
  } else {
    failed++;
    console.log("FAIL  5-6-7-8 run adjacency");
    console.log(
      `      sevenValid=${sevenValid} nineValid=${nineValid} sixInvalid=${sixInvalid}`,
    );
  }

  const pileAfterSeven = [card(7)];
  const historyAfterSeven: Card[][] = [
    ...history,
    [card(7)],
  ];
  const trickAfterSeven = {
    ...trick,
    actions: [...trick.actions, makeAction("play", 0, [card(7)])],
  };
  const runStillActive = resolveRunContext(
    pileAfterSeven,
    historyAfterSeven,
    trickAfterSeven,
    players,
    [],
  ).inRunContext;
  const eightAfterSeven = isValidPlay(
    [card(8)],
    pileAfterSeven,
    undefined,
    historyAfterSeven,
    undefined,
    undefined,
    trickAfterSeven,
    players,
    [],
  );
  if (runStillActive && eightAfterSeven) {
    passed++;
    console.log("PASS  5-6-7-8-7 keeps Runs! context; 8 allowed on 7");
  } else {
    failed++;
    console.log("FAIL  run context after stepping back to 7");
    console.log(
      `      runStillActive=${runStillActive} eightAfterSeven=${eightAfterSeven}`,
    );
  }
}

console.log("\n=== Run direction: bidirectional from pile top ===\n");
{
  const trick = {
    trickNumber: 1,
    actions: [
      makeAction("play", 0, [card(4), card(4)]),
      makeAction("play", 1, [card(5), card(5)]),
      makeAction("play", 2, [card(6), card(6)]),
      makeAction("play", 3, [card(7), card(7)]),
      makeAction("play", 0, [card(8), card(8)]),
    ],
  };
  const pile = [card(8), card(8)];
  const history: Card[][] = [
    [card(4), card(4)],
    [card(5), card(5)],
    [card(6), card(6)],
    [card(7), card(7)],
    [card(8), card(8)],
  ];
  const backwardSeven = isValidPlay(
    [card(7), card(7)],
    pile,
    undefined,
    history,
    undefined,
    undefined,
    trick,
    players,
    [],
  );
  const forwardNine = isValidPlay(
    [card(9), card(9)],
    pile,
    undefined,
    history,
    undefined,
    undefined,
    trick,
    players,
    [],
  );
  if (backwardSeven && forwardNine) {
    passed++;
    console.log("PASS  ascending 44-88 accepts 77 and 99 on 88");
  } else {
    failed++;
    console.log("FAIL  ascending doubles run adjacency");
    console.log(`      backwardSeven=${backwardSeven} forwardNine=${forwardNine}`);
  }
}

{
  const trick = {
    trickNumber: 1,
    actions: [
      makeAction("play", 0, [card(11)]),
      makeAction("play", 1, [card(10)]),
      makeAction("play", 2, [card(9)]),
    ],
  };
  const pile = [card(9)];
  const history: Card[][] = [[card(11)], [card(10)], [card(9)]];
  const backwardTen = isValidPlay(
    [card(10)],
    pile,
    undefined,
    history,
    undefined,
    undefined,
    trick,
    players,
    [],
  );
  const forwardEight = isValidPlay(
    [card(8)],
    pile,
    undefined,
    history,
    undefined,
    undefined,
    trick,
    players,
    [],
  );
  if (backwardTen && forwardEight) {
    passed++;
    console.log("PASS  descending J-10-9 accepts 10 and 8 on 9");
  } else {
    failed++;
    console.log("FAIL  descending run adjacency");
    console.log(`      backwardTen=${backwardTen} forwardEight=${forwardEight}`);
  }
}

console.log("\n=== Step-back run: 4-5-6-5 accepts 6 on pile top 5 ===\n");
{
  const trick = {
    trickNumber: 1,
    actions: [
      makeAction("play", 0, [card(4)]),
      makeAction("play", 1, [card(5)]),
      makeAction("play", 2, [card(6)]),
      makeAction("play", 3, [card(5)]),
    ],
  };
  const pile = [card(5)];
  const history: Card[][] = [[card(4)], [card(5)], [card(6)]];
  const ctx = resolveRunContext(pile, history, trick, players, []);
  const sixValid = isValidPlay(
    [card(6)],
    pile,
    undefined,
    history,
    undefined,
    undefined,
    trick,
    players,
    [],
  );
  const sevenInvalid = !isValidPlay(
    [card(7)],
    pile,
    undefined,
    history,
    undefined,
    undefined,
    trick,
    players,
    [],
  );
  const fourValid = isValidPlay(
    [card(4)],
    pile,
    undefined,
    history,
    undefined,
    undefined,
    trick,
    players,
    [],
  );
  if (ctx.inRunContext && sixValid && sevenInvalid && fourValid) {
    passed++;
    console.log("PASS  4-5-6-5 run: 4 and 6 allowed on pile 5, 7 rejected");
  } else {
    failed++;
    console.log("FAIL  4-5-6-5 step-back run");
    console.log(
      `      inRunContext=${ctx.inRunContext} sixValid=${sixValid} sevenInvalid=${sevenInvalid} fourValid=${fourValid} runSeq=${ctx.runSeq.map((c) => c.value)}`,
    );
  }
}

console.log("\n=== Long singles run: 3-4-5-6-7-8 extensions ===\n");
{
  const plays = [3, 4, 5, 6, 7, 8].map((v) => [card(v)]);
  const trick = {
    trickNumber: 1,
    actions: plays.map((cards, i) => makeAction("play", i % 4, cards)),
  };
  const pile = [card(8)];
  const history = buildHistory(plays);

  const ctx = resolveRunContext(pile, history, trick, players, []);
  const nineValid = isValidPlay(
    [card(9)],
    pile,
    undefined,
    history,
    undefined,
    undefined,
    trick,
    players,
    [],
  );
  const sevenValid = isValidPlay(
    [card(7)],
    pile,
    undefined,
    history,
    undefined,
    undefined,
    trick,
    players,
    [],
  );
  const tenInvalid = !isValidPlay(
    [card(10)],
    pile,
    undefined,
    history,
    undefined,
    undefined,
    trick,
    players,
    [],
  );

  if (
    ctx.inRunContext &&
    ctx.runSeq.map((c) => c.value).join(",") === "3,4,5,6,7,8" &&
    nineValid &&
    sevenValid &&
    tenInvalid
  ) {
    passed++;
    console.log("PASS  3-4-5-6-7-8: 7 and 9 on 8, 10 rejected");
  } else {
    failed++;
    console.log("FAIL  long singles run extensions");
    console.log(
      `      runSeq=${ctx.runSeq.map((c) => c.value)} nine=${nineValid} seven=${sevenValid} tenInvalid=${tenInvalid}`,
    );
  }
}

console.log("\n=== Long doubles run: 33-44-55-66-77 extensions ===\n");
{
  const plays = [3, 4, 5, 6, 7].map((v) => pair(v));
  const trick = {
    trickNumber: 1,
    actions: plays.map((cards, i) => makeAction("play", i % 4, cards)),
  };
  const pile = pair(7);
  const history = buildHistory(plays);

  const ctx = resolveRunContext(pile, history, trick, players, []);
  const eightsValid = isValidPlay(
    pair(8),
    pile,
    undefined,
    history,
    undefined,
    undefined,
    trick,
    players,
    [],
  );
  const sixesValid = isValidPlay(
    pair(6),
    pile,
    undefined,
    history,
    undefined,
    undefined,
    trick,
    players,
    [],
  );
  const singleEightInvalid = !isValidPlay(
    [card(8)],
    pile,
    undefined,
    history,
    undefined,
    undefined,
    trick,
    players,
    [],
  );
  const tripleEightInvalid = !isValidPlay(
    triple(8),
    pile,
    undefined,
    history,
    undefined,
    undefined,
    trick,
    players,
    [],
  );

  if (
    ctx.inRunContext &&
    ctx.runMultiplicity === 2 &&
    eightsValid &&
    sixesValid &&
    singleEightInvalid &&
    tripleEightInvalid
  ) {
    passed++;
    console.log(
      "PASS  33-44-55-66-77: 66 and 88 on 77, single/triple 8 rejected",
    );
  } else {
    failed++;
    console.log("FAIL  long doubles run extensions");
    console.log(
      `      mult=${ctx.runMultiplicity} eights=${eightsValid} sixes=${sixesValid} single8=${singleEightInvalid} triple8=${tripleEightInvalid}`,
    );
  }
}

console.log("\n=== Doubles step-back: 33-44-55-44 extends with 55 ===\n");
{
  const plays = [pair(3), pair(4), pair(5), pair(4)];
  const trick = {
    trickNumber: 1,
    actions: plays.map((cards, i) => makeAction("play", i % 4, cards)),
  };
  const pile = pair(4);
  const history = buildHistory(plays);

  const ctx = resolveRunContext(pile, history, trick, players, []);
  const fivesValid = isValidPlay(
    pair(5),
    pile,
    undefined,
    history,
    undefined,
    undefined,
    trick,
    players,
    [],
  );
  const threesValid = isValidPlay(
    pair(3),
    pile,
    undefined,
    history,
    undefined,
    undefined,
    trick,
    players,
    [],
  );
  const sixesInvalid = !isValidPlay(
    pair(6),
    pile,
    undefined,
    history,
    undefined,
    undefined,
    trick,
    players,
    [],
  );

  if (ctx.inRunContext && fivesValid && threesValid && sixesInvalid) {
    passed++;
    console.log("PASS  33-44-55-44: 33 and 55 on 44, 66 rejected");
  } else {
    failed++;
    console.log("FAIL  doubles step-back extension");
    console.log(
      `      fives=${fivesValid} threes=${threesValid} sixesInvalid=${sixesInvalid} runSeq=${ctx.runSeq.map((c) => c.value)}`,
    );
  }
}

console.log("\n=== Triples run: 333-444-555 extends with 666 ===\n");
{
  const plays = [triple(3), triple(4), triple(5)];
  const trick = {
    trickNumber: 1,
    actions: plays.map((cards, i) => makeAction("play", i % 4, cards)),
  };
  const pile = triple(5);
  const history = buildHistory(plays);

  const ctx = resolveRunContext(pile, history, trick, players, []);
  const sixesValid = isValidPlay(
    triple(6),
    pile,
    undefined,
    history,
    undefined,
    undefined,
    trick,
    players,
    [],
  );
  const pairSixInvalid = !isValidPlay(
    pair(6),
    pile,
    undefined,
    history,
    undefined,
    undefined,
    trick,
    players,
    [],
  );

  if (ctx.inRunContext && ctx.runMultiplicity === 3 && sixesValid && pairSixInvalid) {
    passed++;
    console.log("PASS  333-444-555 accepts 666, rejects pair of 6");
  } else {
    failed++;
    console.log("FAIL  triples run extension");
    console.log(
      `      mult=${ctx.runMultiplicity} sixes=${sixesValid} pair6Invalid=${pairSixInvalid}`,
    );
  }
}

console.log("\n=== Run bonus XP pool ===\n");

function minimalRunTrick(opts: {
  pile: Card[];
  history: Card[][];
  owners: string[];
  actions: ReturnType<typeof makeAction>[];
  runLength?: number;
}): TrickHistory {
  return {
    trickNumber: 1,
    actions: opts.actions,
    winnerId: players[2].id,
    winnerName: players[2].name,
    runLength:
      opts.runLength ??
      runContextLengthFromState({
        pile: opts.pile,
        pileHistory: opts.history,
        pileOwners: opts.owners,
        currentTrick: { trickNumber: 1, actions: opts.actions },
        players,
        finishedOrder: [],
      }),
  };
}

{
  if (
    runBonusStepsFromLength(3) === 0 &&
    runBonusStepsFromLength(4) === 1 &&
    runBonusStepsFromLength(6) === 3
  ) {
    passed++;
    console.log("PASS  run bonus pool: steps = run length minus 3");
  } else {
    failed++;
    console.log("FAIL  run bonus pool step math");
  }
}

{
  const xp = runTrickBonusXpAmount(5, 15);
  if (xp === 30) {
    passed++;
    console.log("PASS  run bonus pool: 5-card run awards 30 XP");
  } else {
    failed++;
    console.log(`FAIL  run bonus pool amount: expected 30 got ${xp}`);
  }
}

{
  const actions = [
    makeAction("play", 0, [card(3)]),
    makeAction("play", 1, [card(4)]),
    makeAction("play", 2, [card(5)]),
  ];
  const trick = minimalRunTrick({
    pile: [card(5)],
    history: [[card(3)], [card(4)]],
    owners: [players[0].id, players[1].id],
    actions,
  });

  if (
    runLengthFromCompletedTrick(trick, players) === 3 &&
    runTrickBonusXpAmount(trick.runLength ?? 0, 15) === 0
  ) {
    passed++;
    console.log("PASS  run bonus pool: 3-card run pays no bonus XP");
  } else {
    failed++;
    console.log("FAIL  run bonus pool: 3-card run should pay 0");
  }
}

{
  const actions = [
    makeAction("play", 0, [card(4)]),
    makeAction("play", 1, [card(5)]),
    makeAction("play", 2, [card(6)]),
    makeAction("play", 3, [card(7)]),
  ];
  const trick = minimalRunTrick({
    pile: [card(7)],
    history: [[card(4)], [card(5)], [card(6)]],
    owners: [players[0].id, players[1].id, players[2].id],
    actions,
  });

  if (
    runLengthFromCompletedTrick(trick, players) === 4 &&
    runTrickBonusXpAmount(trick.runLength ?? 0, 15) === 15
  ) {
    passed++;
    console.log("PASS  run bonus pool: 4-card run pays one step (15 XP)");
  } else {
    failed++;
    console.log("FAIL  run bonus pool: 4-card run");
    console.log(
      `      len=${runLengthFromCompletedTrick(trick, players)} xp=${runTrickBonusXpAmount(trick.runLength ?? 0, 15)}`,
    );
  }
}

{
  const actions = [
    makeAction("play", 0, [card(4)]),
    makeAction("play", 1, [card(5)]),
  ];
  const trick = minimalRunTrick({
    pile: [card(5)],
    history: [[card(4)]],
    owners: [players[0].id],
    actions,
    runLength: 0,
  });

  if (runLengthFromCompletedTrick(trick, players) === 0) {
    passed++;
    console.log("PASS  run bonus pool: two-card chain is not a run");
  } else {
    failed++;
    console.log("FAIL  run bonus pool: two-card chain should not count");
  }
}

{
  const actions = [
    makeAction("play", 0, [card(3)]),
    makeAction("play", 1, [card(4)]),
    makeAction("play", 2, [card(5)]),
    makeAction("play", 3, [card(6)]),
  ];
  const state = {
    pile: [card(6)],
    pileHistory: [[card(3)], [card(4)], [card(5)]],
    pileOwners: [players[0].id, players[1].id, players[2].id],
    currentTrick: { trickNumber: 1, actions },
    players: players.map((p) => ({ ...p, hand: [card(9)] })),
    finishedOrder: [] as string[],
    lastPlayPlayerIndex: 3,
  };
  const pool = activeRunXpPoolInfo(state as GameState, 15);

  if (pool.poolXp === 15 && pool.pileLeaderId === players[3].id) {
    passed++;
    console.log("PASS  active run pool: 4-card run shows 15 XP for pile leader");
  } else {
    failed++;
    console.log("FAIL  active run pool");
    console.log(`      pool=${pool.poolXp} leader=${pool.pileLeaderId}`);
  }
}

console.log("\n=== Skip-over step-back: J-Q-J-K keeps Runs! context ===\n");
{
  const trickBeforeK = {
    trickNumber: 1,
    actions: [
      makeAction("play", 0, [card(11)]),
      makeAction("play", 1, [card(12)]),
      makeAction("play", 2, [card(11)]),
    ],
  };
  const pileBeforeK = [card(11)];
  const historyBeforeK: Card[][] = [[card(11)], [card(12)]];
  const ctxBeforeK = resolveRunContext(
    pileBeforeK,
    historyBeforeK,
    trickBeforeK,
    players,
    [],
  );
  const kingAsRun = isValidPlay(
    [card(13)],
    pileBeforeK,
    undefined,
    historyBeforeK,
    undefined,
    undefined,
    trickBeforeK,
    players,
    [],
  );

  const trickAfterK = {
    trickNumber: 1,
    actions: [...trickBeforeK.actions, makeAction("play", 3, [card(13)])],
  };
  const pileAfterK = [card(13)];
  const historyAfterK: Card[][] = [
    [card(11)],
    [card(12)],
    [card(11)],
    [card(13)],
  ];
  const ctxAfterK = resolveRunContext(
    pileAfterK,
    historyAfterK,
    trickAfterK,
    players,
    [],
  );

  if (
    !ctxBeforeK.inRunContext &&
    kingAsRun &&
    ctxAfterK.inRunContext &&
    ctxAfterK.runSeq.map((c) => c.value).join(",") === "11,12,13"
  ) {
    passed++;
    console.log("PASS  J-Q-J-K: K extends from Q; Runs! stays active after K");
  } else {
    failed++;
    console.log("FAIL  J-Q-J-K skip-over run");
    console.log(
      `      beforeInRun=${ctxBeforeK.inRunContext} kingValid=${kingAsRun} afterInRun=${ctxAfterK.inRunContext} runSeq=${ctxAfterK.runSeq.map((c) => c.value)}`,
    );
  }
}

console.log("\n=== Oscillating step-back: 4-5-6-5-6 keeps Runs! context ===\n");
{
  const trick = {
    trickNumber: 1,
    actions: [
      makeAction("play", 0, [card(4)]),
      makeAction("play", 1, [card(5)]),
      makeAction("play", 2, [card(6)]),
      makeAction("play", 3, [card(5)]),
      makeAction("play", 0, [card(6)]),
    ],
  };
  const pile = [card(6)];
  const history: Card[][] = [[card(4)], [card(5)], [card(6)], [card(5)]];
  const ctx = resolveRunContext(pile, history, trick, players, []);
  const fiveValid = isValidPlay(
    [card(5)],
    pile,
    undefined,
    history,
    undefined,
    undefined,
    trick,
    players,
    [],
  );
  if (ctx.inRunContext && ctx.runSeq.map((c) => c.value).join(",") === "4,5,6" && fiveValid) {
    passed++;
    console.log("PASS  4-5-6-5-6: run core preserved; 5 allowed on pile 6");
  } else {
    failed++;
    console.log("FAIL  4-5-6-5-6 oscillating step-back");
    console.log(
      `      inRun=${ctx.inRunContext} runSeq=${ctx.runSeq.map((c) => c.value)} fiveValid=${fiveValid}`,
    );
  }
}

console.log("\n=== Oscillating step-back: 10-J-Q-J-Q keeps Runs! context ===\n");
{
  const trick = {
    trickNumber: 1,
    actions: [
      makeAction("play", 0, [card(10)]),
      makeAction("play", 1, [card(11)]),
      makeAction("play", 2, [card(12)]),
      makeAction("play", 3, [card(11)]),
      makeAction("play", 0, [card(12)]),
    ],
  };
  const pile = [card(12)];
  const history: Card[][] = [
    [card(10)],
    [card(11)],
    [card(12)],
    [card(11)],
  ];
  const ctx = resolveRunContext(pile, history, trick, players, []);
  const jackValid = isValidPlay(
    [card(11)],
    pile,
    undefined,
    history,
    undefined,
    undefined,
    trick,
    players,
    [],
  );
  const kingValid = isValidPlay(
    [card(13)],
    pile,
    undefined,
    history,
    undefined,
    undefined,
    trick,
    players,
    [],
  );
  if (
    ctx.inRunContext &&
    ctx.runSeq.map((c) => c.value).join(",") === "10,11,12" &&
    jackValid &&
    kingValid
  ) {
    passed++;
    console.log("PASS  10-J-Q-J-Q: run core preserved; J and K allowed on Q");
  } else {
    failed++;
    console.log("FAIL  10-J-Q-J-Q oscillating step-back");
    console.log(
      `      inRun=${ctx.inRunContext} runSeq=${ctx.runSeq.map((c) => c.value)} jackValid=${jackValid} kingValid=${kingValid}`,
    );
  }
}

console.log("\n=== Oscillating step-back: J-Q-K-J-Q keeps Runs! context ===\n");
{
  const trick = {
    trickNumber: 1,
    actions: [
      makeAction("play", 0, [card(11)]),
      makeAction("play", 1, [card(12)]),
      makeAction("play", 2, [card(13)]),
      makeAction("play", 3, [card(11)]),
      makeAction("play", 0, [card(12)]),
    ],
  };
  const pile = [card(12)];
  const history: Card[][] = [
    [card(11)],
    [card(12)],
    [card(13)],
    [card(11)],
  ];
  const ctx = resolveRunContext(pile, history, trick, players, []);
  if (ctx.inRunContext && ctx.runSeq.map((c) => c.value).join(",") === "11,12,13") {
    passed++;
    console.log("PASS  J-Q-K-J-Q: run core J-Q-K preserved after J-Q oscillation");
  } else {
    failed++;
    console.log("FAIL  J-Q-K-J-Q oscillating step-back");
    console.log(
      `      inRun=${ctx.inRunContext} runSeq=${ctx.runSeq.map((c) => c.value)}`,
    );
  }
}

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
