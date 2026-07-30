/**
 * RC P0 — Active run 8→9→10→9→8 extension legality.
 * Run: npx tsx ./scripts/test-active-run-891098-extensions.ts
 *
 * Required behaviour (house rules / oscillating step-back):
 *   pile [8] after chronology 8,9,10,9,8 — legal: 7, 9; illegal: 6, 8, 10.
 */
import * as assert from "assert";
import type { Card } from "../src/game/ruleset";
import {
  isAdjacentToPileTop,
  isValidPlay,
  isValidRunExtension,
  resolveRunContext,
  runDirection,
  type TrickHistory,
} from "../src/game/core";

function card(v: number, suit: Card["suit"] = "spades"): Card {
  return { value: v, suit };
}

const players = [
  { id: "p0", name: "P0", hand: [] },
  { id: "p1", name: "P1", hand: [] },
  { id: "p2", name: "P2", hand: [] },
  { id: "p3", name: "P3", hand: [] },
];

function makePlay(i: number, cards: Card[]) {
  const p = players[i % 4];
  return {
    type: "play" as const,
    playerId: p.id,
    playerName: p.name,
    cards,
    timestamp: Date.now(),
  };
}

/** Mirror GameScreen.canCardBePlayedAtAll in-run branch. */
function uiPlayable(
  rank: number,
  pile: Card[],
  pileHistory: Card[][],
  trick: TrickHistory,
): boolean {
  const { runMultiplicity, inRunContext } = resolveRunContext(
    pile,
    pileHistory,
    trick,
    players,
    [],
  );
  if (!inRunContext) {
    return isValidPlay(
      [card(rank)],
      pile,
      undefined,
      pileHistory,
      undefined,
      undefined,
      trick,
      players,
      [],
    );
  }
  if (!isAdjacentToPileTop(pile, rank)) return false;
  return isValidPlay(
    [card(rank)],
    pile,
    undefined,
    pileHistory,
    undefined,
    undefined,
    trick,
    players,
    [],
  );
}

function build891098State() {
  const actions = [
    makePlay(0, [card(8)]),
    makePlay(1, [card(9)]),
    makePlay(2, [card(10)]),
    makePlay(3, [card(9)]),
    makePlay(0, [card(8)]),
  ];
  const pile = [card(8)];
  const pileHistory: Card[][] = [[card(8)], [card(9)], [card(10)], [card(9)]];
  const trick: TrickHistory = { trickNumber: 1, actions };
  return { pile, pileHistory, trick };
}

function dumpState(
  pile: Card[],
  pileHistory: Card[][],
  trick: TrickHistory,
) {
  const ctx = resolveRunContext(pile, pileHistory, trick, players, []);
  const chronology = [
    ...pileHistory.map((g) => g[0].value),
    pile[0].value,
  ];
  const candidateRanks = [6, 7, 8, 9, 10];
  const legalMoves = Object.fromEntries(
    candidateRanks.map((r) => [
      r,
      isValidPlay(
        [card(r)],
        pile,
        undefined,
        pileHistory,
        undefined,
        undefined,
        trick,
        players,
        [],
      ),
    ]),
  );
  const extension = Object.fromEntries(
    candidateRanks.map((r) => [
      r,
      isValidRunExtension(r, pile, pileHistory, trick, players, []),
    ]),
  );
  const ui = Object.fromEntries(
    candidateRanks.map((r) => [r, uiPlayable(r, pile, pileHistory, trick)]),
  );
  return {
    inRunContext: ctx.inRunContext,
    runSeq: ctx.runSeq.map((c) => c.value),
    runMultiplicity: ctx.runMultiplicity,
    runDirection: ctx.runSeq.length >= 2 ? runDirection(ctx.runSeq) : null,
    pile: pile.map((c) => c.value),
    pileTop: pile[0]?.value,
    lastPlayedRank: trick.actions[trick.actions.length - 1]?.cards?.[0]?.value,
    chronology,
    legalMoves,
    isValidRunExtension: extension,
    uiPlayable: ui,
    symptom_7_off_9_on: !legalMoves[7] && legalMoves[9] && !ui[7] && ui[9],
  };
}

console.log("=== RC P0: 8→9→10→9→8 extension legality ===\n");

const { pile, pileHistory, trick } = build891098State();
const dump = dumpState(pile, pileHistory, trick);
console.log(JSON.stringify(dump, null, 2));
console.log();

let failed = 0;

try {
  assert.strictEqual(dump.inRunContext, true, "inRunContext must be true");
  assert.deepStrictEqual(dump.runSeq, [8, 9, 10], "runSeq core");
  assert.strictEqual(dump.legalMoves[7], true, "rank 7 legal");
  assert.strictEqual(dump.legalMoves[9], true, "rank 9 legal");
  assert.strictEqual(dump.legalMoves[6], false, "rank 6 illegal");
  assert.strictEqual(dump.legalMoves[8], false, "rank 8 illegal");
  assert.strictEqual(dump.legalMoves[10], false, "rank 10 illegal");
  assert.strictEqual(dump.uiPlayable[7], true, "UI rank 7 playable");
  assert.strictEqual(dump.uiPlayable[9], true, "UI rank 9 playable");
  assert.strictEqual(
    dump.isValidRunExtension[7],
    true,
    "anchor extension agrees on 7",
  );
  assert.strictEqual(
    dump.isValidRunExtension[9],
    true,
    "anchor extension agrees on 9",
  );
  console.log("PASS  canonical 8-9-10-9-8 state");
} catch (e) {
  failed++;
  console.error("FAIL  canonical 8-9-10-9-8 state");
  console.error((e as Error).message);
}

// Symptom signature when activation fails (rank-beat fallback).
const controlDump = dumpState(
  [card(8)],
  [[card(10)], [card(9)], [card(10)], [card(9)]],
  {
    trickNumber: 1,
    actions: [
      makePlay(0, [card(10)]),
      makePlay(1, [card(9)]),
      makePlay(2, [card(10)]),
      makePlay(3, [card(9)]),
      makePlay(0, [card(8)]),
    ],
  },
);

try {
  assert.strictEqual(controlDump.inRunContext, false);
  assert.strictEqual(controlDump.symptom_7_off_9_on, true);
  console.log("PASS  control: rank-beat fallback reproduces 7-off/9-on");
} catch (e) {
  failed++;
  console.error("FAIL  control symptom signature");
  console.error((e as Error).message);
}

// Stale pileHistory must not override a valid run in currentTrick.
const desyncDump = dumpState(
  [card(8)],
  [[card(10)], [card(9)], [card(10)], [card(9)]],
  trick,
);
try {
  assert.strictEqual(desyncDump.inRunContext, true, "trick wins over stale history");
  assert.strictEqual(desyncDump.legalMoves[7], true, "rank 7 legal with stale history");
  assert.strictEqual(desyncDump.legalMoves[9], true, "rank 9 legal with stale history");
  assert.strictEqual(desyncDump.uiPlayable[7], true, "UI rank 7 with stale history");
  console.log("PASS  stale pileHistory + canonical trick");
} catch (e) {
  failed++;
  console.error("FAIL  stale pileHistory desync");
  console.error((e as Error).message);
}

if (failed > 0) {
  console.log(`\n${failed} assertion group(s) failed\n`);
  process.exit(1);
}

console.log("\nAll assertion groups passed (canonical engine OK on full state).\n");
