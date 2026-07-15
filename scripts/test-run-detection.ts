/**
 * Run detection regression tests.
 * Run: npm run test-runs
 */
import {
  runFromCurrentTrickInfo,
  effectivePile,
  isRunContextSequence,
  isValidPlay,
  isValidRunExtension,
  resolveRunContext,
  playWouldActivateRun,
  createGame,
  playCards,
  passTurn,
  runContextLengthFromState,
  runCardCountFromState,
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

/** Stamp canonical sticky Runs for live legality / XP consumer assertions. */
function withStickyRun<T extends { trickNumber: number; actions: ReturnType<typeof makeAction>[] }>(
  trick: T,
  multiplicity = 1,
): T & { runActive: true; runMultiplicity: number } {
  return { ...trick, runActive: true as const, runMultiplicity: multiplicity };
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
    name: "J-10-9 descending play order is not a run",
    actions: [
      makeAction("play", 0, [card(11)]),
      makeAction("play", 1, [card(10)]),
      makeAction("play", 2, [card(9)]),
    ],
    pile: [card(9)],
    expectRun: false,
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
    name: "skip-over play J-Q-J-K does NOT invent a run (no sticky yet)",
    actions: [
      makeAction("play", 0, [card(11)]),
      makeAction("play", 1, [card(12)]),
      makeAction("play", 2, [card(11)]),
      makeAction("play", 3, [card(13)]),
    ],
    pile: [card(13)],
    expectRun: false,
  },
  {
    name: "9-10-9-J must NOT invent a run (live false-run regression)",
    actions: [
      makeAction("play", 0, [card(9)]),
      makeAction("play", 1, [card(10)]),
      makeAction("play", 2, [card(9)]),
      makeAction("play", 3, [card(11)]),
    ],
    pile: [card(11)],
    expectRun: false,
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
    withStickyRun(trick, 1),
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
    withStickyRun(trick, 2),
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
    withStickyRun(trick, 2),
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
    withStickyRun(trick, 1),
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
    withStickyRun(trick, 1),
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
    withStickyRun(trick, 1),
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
    withStickyRun(trickAfterSeven, 1),
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
    withStickyRun(trick, 2),
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
    withStickyRun(trick, 2),
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
  const ctx = resolveRunContext(pile, history, trick, players, []);
  if (!ctx.inRunContext && ctx.runSeq.length === 0) {
    passed++;
    console.log("PASS  descending J-10-9 is not a run");
  } else {
    failed++;
    console.log("FAIL  descending run adjacency");
    console.log(
      `      inRun=${ctx.inRunContext} runSeq=${ctx.runSeq.map((c) => c.value)}`,
    );
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
    withStickyRun(trick, 1),
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
    withStickyRun(trick, 1),
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
    withStickyRun(trick, 1),
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
    withStickyRun(trick, 1),
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
    withStickyRun(trick, 1),
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
    withStickyRun(trick, 1),
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
    withStickyRun(trick, 2),
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
    withStickyRun(trick, 2),
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
    withStickyRun(trick, 2),
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
    withStickyRun(trick, 2),
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
    withStickyRun(trick, 2),
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
    withStickyRun(trick, 2),
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
    withStickyRun(trick, 2),
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
    withStickyRun(trick, 3),
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
    withStickyRun(trick, 3),
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
  multiplicity?: number;
}): TrickHistory {
  const mult = opts.multiplicity ?? 1;
  return {
    trickNumber: 1,
    actions: opts.actions,
    winnerId: players[2].id,
    winnerName: players[2].name,
    runActive: true,
    runMultiplicity: mult,
    runLength:
      opts.runLength ??
      runCardCountFromState({
        pile: opts.pile,
        pileHistory: opts.history,
        pileOwners: opts.owners,
        currentTrick: withStickyRun(
          { trickNumber: 1, actions: opts.actions },
          mult,
        ),
        players,
        finishedOrder: [],
      }),
  };
}

{
  if (
    runBonusStepsFromLength(3, 1) === 3 &&
    runBonusStepsFromLength(4, 1) === 4 &&
    runBonusStepsFromLength(3, 2) === 6 &&
    runBonusStepsFromLength(4, 2) === 8
  ) {
    passed++;
    console.log("PASS  run bonus pool: counts every card in the run (incl. doubles)");
  } else {
    failed++;
    console.log("FAIL  run bonus pool card count");
  }
}

{
  const xp = runTrickBonusXpAmount(5, 5);
  if (xp === 25) {
    passed++;
    console.log("PASS  run bonus pool: 5-card run awards 25 XP");
  } else {
    failed++;
    console.log(`FAIL  run bonus pool amount: expected 25 got ${xp}`);
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
    runTrickBonusXpAmount(trick.runLength ?? 0, 5) === 15
  ) {
    passed++;
    console.log("PASS  run bonus pool: 3-card run pays 15 XP");
  } else {
    failed++;
    console.log("FAIL  run bonus pool: 3-card run should pay 15");
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
    runTrickBonusXpAmount(trick.runLength ?? 0, 5) === 20
  ) {
    passed++;
    console.log("PASS  run bonus pool: 4-card run pays 20 XP");
  } else {
    failed++;
    console.log("FAIL  run bonus pool: 4-card run");
    console.log(
      `      len=${runLengthFromCompletedTrick(trick, players)} xp=${runTrickBonusXpAmount(trick.runLength ?? 0, 5)}`,
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
    currentTrick: withStickyRun({ trickNumber: 1, actions }, 1),
    players: players.map((p) => ({ ...p, hand: [card(9)] })),
    finishedOrder: [] as string[],
    lastPlayPlayerIndex: 3,
  };
  const pool = activeRunXpPoolInfo(state as GameState, 5);

  if (pool.poolXp === 20 && pool.pileLeaderId === players[3].id) {
    passed++;
    console.log("PASS  active run pool: 4-card run shows 20 XP for pile leader");
  } else {
    failed++;
    console.log("FAIL  active run pool");
    console.log(`      pool=${pool.poolXp} leader=${pool.pileLeaderId}`);
  }
}

{
  const actions = [
    makeAction("play", 0, [card(3)]),
    makeAction("play", 1, [card(4)]),
    makeAction("play", 2, [card(5)]),
    makeAction("play", 3, [card(6)]),
    makeAction("play", 0, [card(7)]),
  ];
  const state = {
    pile: [card(7)],
    pileHistory: [[card(3)], [card(4)], [card(5)], [card(6)]],
    pileOwners: [players[0].id, players[1].id, players[2].id, players[3].id],
    currentTrick: withStickyRun({ trickNumber: 1, actions }, 1),
    players: players.map((p) => ({ ...p, hand: [card(9)] })),
    finishedOrder: [] as string[],
    lastPlayPlayerIndex: 0,
  };
  const pool = activeRunXpPoolInfo(state as GameState, 5);
  if (pool.poolXp === 25 && pool.runLength === 5) {
    passed++;
    console.log("PASS  active run pool: 5-card run shows 25 XP");
  } else {
    failed++;
    console.log(`FAIL  active run pool 5-card: pool=${pool.poolXp} len=${pool.runLength}`);
  }
}

{
  const actions = [
    makeAction("play", 0, [card(3)]),
    makeAction("play", 1, [card(4)]),
    makeAction("play", 2, [card(5)]),
    makeAction("play", 3, [card(6)]),
    makeAction("play", 0, [card(7)]),
    makeAction("play", 1, [card(8)]),
  ];
  const state = {
    pile: [card(8)],
    pileHistory: [[card(3)], [card(4)], [card(5)], [card(6)], [card(7)]],
    pileOwners: [
      players[0].id,
      players[1].id,
      players[2].id,
      players[3].id,
      players[0].id,
    ],
    currentTrick: withStickyRun({ trickNumber: 1, actions }, 1),
    players: players.map((p) => ({ ...p, hand: [card(9)] })),
    finishedOrder: [] as string[],
    lastPlayPlayerIndex: 1,
  };
  const pool = activeRunXpPoolInfo(state as GameState, 5);
  if (pool.poolXp === 30 && pool.runLength === 6) {
    passed++;
    console.log("PASS  active run pool: 6-card run shows 30 XP");
  } else {
    failed++;
    console.log(`FAIL  active run pool 6-card: pool=${pool.poolXp} len=${pool.runLength}`);
  }
}

console.log("\n=== Skip-over without sticky: J-Q-J-K must NOT invent Runs ===\n");
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
  // K still beats J on normal rank rules — that is not the same as Runs.
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
    !ctxAfterK.inRunContext
  ) {
    passed++;
    console.log("PASS  J-Q-J-K: K is a legal beat; Runs stays inactive (no invented J-Q-K)");
  } else {
    failed++;
    console.log("FAIL  J-Q-J-K skip-over must not invent a run");
    console.log(
      `      beforeInRun=${ctxBeforeK.inRunContext} kingValid=${kingAsRun} afterInRun=${ctxAfterK.inRunContext} runSeq=${ctxAfterK.runSeq.map((c) => c.value)}`,
    );
  }
}

console.log("\n=== Live false-run regression: 9-10-9-J must NOT activate Runs ===\n");
{
  const trickBeforeJ = {
    trickNumber: 1,
    actions: [
      makeAction("play", 0, [card(9)]),
      makeAction("play", 1, [card(10)]),
      makeAction("play", 2, [card(9)]),
    ],
  };
  const pileBeforeJ = [card(9)];
  const historyBeforeJ: Card[][] = [[card(9)], [card(10)], [card(9)]];
  const would = playWouldActivateRun(
    [card(11)],
    pileBeforeJ,
    historyBeforeJ,
    trickBeforeJ,
    players,
    [],
    { id: players[3].id, name: players[3].name },
  );
  const trickAfterJ = {
    trickNumber: 1,
    actions: [...trickBeforeJ.actions, makeAction("play", 3, [card(11)])],
  };
  const ctx = resolveRunContext(
    [card(11)],
    historyBeforeJ,
    trickAfterJ,
    players,
    [],
  );
  if (!would && !ctx.inRunContext) {
    passed++;
    console.log("PASS  9-10-9-J: playWouldActivateRun=false; resolveRunContext inactive");
  } else {
    failed++;
    console.log(
      `FAIL  9-10-9-J: wouldActivate=${would} inRun=${ctx.inRunContext} seq=${ctx.runSeq.map((c) => c.value)}`,
    );
  }
}

{
  const actions = [
    makeAction("play", 0, [card(3), card(3)]),
    makeAction("play", 1, [card(4), card(4)]),
    makeAction("play", 2, [card(5), card(5)]),
    makeAction("play", 3, [card(6), card(6)]),
  ];
  const state = {
    pile: [card(6), card(6)],
    pileHistory: [
      [card(3), card(3)],
      [card(4), card(4)],
      [card(5), card(5)],
    ],
    pileOwners: [players[0].id, players[1].id, players[2].id],
    currentTrick: withStickyRun({ trickNumber: 1, actions }, 2),
    players: players.map((p) => ({ ...p, hand: [card(9)] })),
    finishedOrder: [] as string[],
    lastPlayPlayerIndex: 3,
  };
  const pool = activeRunXpPoolInfo(state as GameState, 5);
  if (pool.poolXp === 40 && pool.runLength === 8) {
    passed++;
    console.log("PASS  active run pool: 4-rank doubles run shows 40 XP (8 cards)");
  } else {
    failed++;
    console.log(
      `FAIL  doubles run pool: pool=${pool.poolXp} cards=${pool.runLength}`,
    );
  }
}

{
  const actions = [
    makeAction("play", 0, [card(3), card(3)]),
    makeAction("play", 1, [card(4), card(4)]),
    makeAction("play", 2, [card(5), card(5)]),
  ];
  const trick = minimalRunTrick({
    pile: [card(5), card(5)],
    history: [[card(3), card(3)], [card(4), card(4)]],
    owners: [players[0].id, players[1].id],
    actions,
    multiplicity: 2,
  });
  if (
    runLengthFromCompletedTrick(trick, players) === 6 &&
    runTrickBonusXpAmount(trick.runLength ?? 0, 5) === 30
  ) {
    passed++;
    console.log("PASS  run bonus pool: 3-rank doubles run pays 30 XP");
  } else {
    failed++;
    console.log(
      `FAIL  doubles run XP: cards=${runLengthFromCompletedTrick(trick, players)} xp=${runTrickBonusXpAmount(trick.runLength ?? 0, 5)}`,
    );
  }
}

console.log("\n=== Run XP high-water: step-back does not reduce pool ===\n");
{
  const trick = {
    trickNumber: 1,
    actions: [
      makeAction("play", 0, [card(8)]),
      makeAction("play", 1, [card(9)]),
      makeAction("play", 2, [card(10)]),
      makeAction("play", 3, [card(9)]),
      makeAction("play", 0, [card(8)]),
    ],
  };
  const stateAtPeak = {
    pile: [card(10)],
    pileHistory: [[card(8)], [card(9)]],
    pileOwners: [players[0].id, players[1].id],
    currentTrick: withStickyRun(
      {
        trickNumber: 1,
        actions: trick.actions.slice(0, 3),
      },
      1,
    ),
    players: players.map((p) => ({ ...p, hand: [card(3)] })),
    finishedOrder: [] as string[],
    lastPlayPlayerIndex: 2,
  };
  const stateStepBack = {
    pile: [card(8)],
    pileHistory: [[card(8)], [card(9)], [card(10)], [card(9)]],
    pileOwners: [
      players[0].id,
      players[1].id,
      players[2].id,
      players[3].id,
    ],
    currentTrick: withStickyRun(trick, 1),
    players: players.map((p) => ({ ...p, hand: [card(3)] })),
    finishedOrder: [] as string[],
    lastPlayPlayerIndex: 0,
  };
  const poolPeak = activeRunXpPoolInfo(stateAtPeak as GameState, 5);
  const poolFinal = activeRunXpPoolInfo(stateStepBack as GameState, 5);
  if (
    poolPeak.poolXp === 15 &&
    poolFinal.poolXp === 25 &&
    poolFinal.runLength === 5
  ) {
    passed++;
    console.log("PASS  8-9-10-9-8: pool stays 25 XP after step-back (not 15)");
  } else {
    failed++;
    console.log(
      `FAIL  8-9-10-9-8 XP: peak=${poolPeak.poolXp} final=${poolFinal.poolXp} cards=${poolFinal.runLength}`,
    );
  }
}

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
  const state = {
    pile: [card(6)],
    pileHistory: [[card(4)], [card(5)], [card(6)], [card(5)]],
    pileOwners: [
      players[0].id,
      players[1].id,
      players[2].id,
      players[3].id,
    ],
    currentTrick: withStickyRun(trick, 1),
    players: players.map((p) => ({ ...p, hand: [card(3)] })),
    finishedOrder: [] as string[],
    lastPlayPlayerIndex: 0,
  };
  const pool = activeRunXpPoolInfo(state as GameState, 5);
  if (pool.poolXp === 25 && pool.runLength === 5) {
    passed++;
    console.log("PASS  4-5-6-5-6: oscillating step-back awards 25 XP");
  } else {
    failed++;
    console.log(
      `FAIL  4-5-6-5-6 XP: pool=${pool.poolXp} cards=${pool.runLength}`,
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
    withStickyRun(trick, 1),
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
    withStickyRun(trick, 1),
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
    withStickyRun(trick, 1),
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

console.log("\n=== Oscillating step-back: 8-9-10-9-8 extension legality (RC P0) ===\n");
{
  const trick = {
    trickNumber: 1,
    actions: [
      makeAction("play", 0, [card(8)]),
      makeAction("play", 1, [card(9)]),
      makeAction("play", 2, [card(10)]),
      makeAction("play", 3, [card(9)]),
      makeAction("play", 0, [card(8)]),
    ],
  };
  const pile = [card(8)];
  const history: Card[][] = [[card(8)], [card(9)], [card(10)], [card(9)]];
  const ctx = resolveRunContext(pile, history, trick, players, []);
  const legal = (v: number) =>
    isValidPlay(
      [card(v)],
      pile,
      undefined,
      history,
      undefined,
      undefined,
      withStickyRun(trick, 1),
      players,
      [],
    );
  const ext = (v: number) =>
    isValidRunExtension(v, pile, history, trick, players, []);
  const expectLegal = [7, 9];
  const expectIllegal = [6, 8, 10];
  const legalOk = expectLegal.every((v) => legal(v));
  const illegalOk = expectIllegal.every((v) => !legal(v));
  const inRunOk = ctx.inRunContext && ctx.runSeq.map((c) => c.value).join(",") === "8,9,10";
  // Anchor-aware extension must agree for legal ranks (7,9); 10 may diverge on anchors vs pile-top guard
  const extensionAgrees = expectLegal.every((v) => ext(v) === legal(v));

  if (inRunOk && legalOk && illegalOk && extensionAgrees) {
    passed++;
    console.log("PASS  8-9-10-9-8: inRunContext; 7+9 legal; 6+8+10 illegal");
  } else {
    failed++;
    console.log("FAIL  8-9-10-9-8 active run extensions (RC P0)");
    console.log(
      JSON.stringify({
        inRunContext: ctx.inRunContext,
        runSeq: ctx.runSeq.map((c) => c.value),
        runMultiplicity: ctx.runMultiplicity,
        legal7: legal(7),
        legal9: legal(9),
        legal6: legal(6),
        legal8: legal(8),
        legal10: legal(10),
        ext7: ext(7),
        ext9: ext(9),
        ext10: ext(10),
        symptom_7_off_9_on: !legal(7) && legal(9),
      }),
    );
  }
}

console.log("\n=== Control: 10-9-10-9-8 is NOT a run (symptom signature) ===\n");
{
  const trick = {
    trickNumber: 1,
    actions: [
      makeAction("play", 0, [card(10)]),
      makeAction("play", 1, [card(9)]),
      makeAction("play", 2, [card(10)]),
      makeAction("play", 3, [card(9)]),
      makeAction("play", 0, [card(8)]),
    ],
  };
  const pile = [card(8)];
  const history: Card[][] = [[card(10)], [card(9)], [card(10)], [card(9)]];
  const ctx = resolveRunContext(pile, history, trick, players, []);
  const legal = (v: number) =>
    isValidPlay(
      [card(v)],
      pile,
      undefined,
      history,
      undefined,
      undefined,
      trick,
      players,
      [],
    );
  const symptom = !legal(7) && legal(9);
  if (!ctx.inRunContext && symptom) {
    passed++;
    console.log(
      "PASS  control: inRunContext false reproduces 7-off/9-on via rank-beat",
    );
  } else {
    failed++;
    console.log("FAIL  control case for rank-beat symptom");
    console.log(
      JSON.stringify({
        inRunContext: ctx.inRunContext,
        runSeq: ctx.runSeq.map((c) => c.value),
        legal7: legal(7),
        legal9: legal(9),
        symptom,
      }),
    );
  }
}

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
