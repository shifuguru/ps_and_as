/**
 * House-rules run activation regression tests (v1.0.62+).
 * Encodes player rules — exits non-zero while current core.ts violates them.
 *
 * Run: npx tsx ./scripts/test-run-house-rules.ts
 */
import * as assert from "assert";
import type { Card } from "../src/game/ruleset";
import {
  isRunContextSequence,
  isValidPlay,
  resolveRunContext,
  type TrickHistory,
} from "../src/game/core";

function card(v: number, suit: Card["suit"] = "spades"): Card {
  return { value: v, suit };
}

function pair(v: number, suits: Card["suit"][] = ["hearts", "diamonds"]): Card[] {
  return suits.map((suit) => card(v, suit));
}

function triple(
  v: number,
  suits: Card["suit"][] = ["hearts", "diamonds", "clubs"],
): Card[] {
  return suits.map((suit) => card(v, suit));
}

const players = [
  { id: "1", name: "P1", hand: [] },
  { id: "2", name: "P2", hand: [] },
  { id: "3", name: "P3", hand: [] },
  { id: "4", name: "P4", hand: [] },
];

function makePlay(playerIdx: number, cards: Card[]) {
  const p = players[playerIdx];
  return {
    type: "play" as const,
    playerId: p.id,
    playerName: p.name,
    cards,
    timestamp: Date.now(),
  };
}

function chronologyFromHistory(history: Card[][], pile: Card[]): number[] {
  return [...history.map((h) => h[0].value), pile[0].value];
}

export type RunSnapshot = {
  chronology: number[];
  pile: number[];
  runSeq: number[];
  inRunContext: boolean;
  isRunContextSequenceRunSeq: boolean;
};

export function snapshotRunState(
  actions: TrickHistory["actions"],
  pile: Card[],
  pileHistory: Card[][],
): RunSnapshot {
  const trick: TrickHistory = { trickNumber: 1, actions };
  const ctx = resolveRunContext(pile, pileHistory, trick, players, []);
  return {
    chronology: chronologyFromHistory(pileHistory, pile),
    pile: pile.map((c) => c.value),
    runSeq: ctx.runSeq.map((c) => c.value),
    inRunContext: ctx.inRunContext,
    isRunContextSequenceRunSeq: isRunContextSequence(ctx.runSeq),
  };
}

function assertNotRun(label: string, snap: RunSnapshot): void {
  assert.strictEqual(
    snap.inRunContext,
    false,
    `${label}: inRunContext should be false (got runSeq=[${snap.runSeq}])`,
  );
  assert.strictEqual(snap.runSeq.length, 0, `${label}: runSeq should be empty`);
}

function assertRun(label: string, snap: RunSnapshot, expectValues: number[]): void {
  assert.strictEqual(snap.inRunContext, true, `${label}: inRunContext should be true`);
  assert.ok(
    isRunContextSequence(snap.runSeq.map((v) => card(v))),
    `${label}: runSeq should pass isRunContextSequence`,
  );
  assert.deepStrictEqual(snap.runSeq, expectValues, `${label}: runSeq mismatch`);
}

/** Returns true when the engine violates house rules (test stays RED). */
function expectNotRun(name: string, fn: () => void): boolean {
  try {
    fn();
    console.log(`PASS ${name}`);
    return false;
  } catch (e) {
    console.log(`RED ${name} — ${e instanceof Error ? e.message : e}`);
    return true;
  }
}

function expectRun(name: string, fn: () => void): boolean {
  try {
    fn();
    console.log(`PASS ${name}`);
    return false;
  } catch (e) {
    console.log(`FAIL ${name} — ${e instanceof Error ? e.message : e}`);
    return true;
  }
}

let violations = 0;

console.log("\n=== Reproduction: 10,9,10,8 ===\n");

{
  const actions = [
    makePlay(0, [card(10, "hearts")]),
    makePlay(1, [card(9, "diamonds")]),
    makePlay(2, [card(10, "clubs")]),
    makePlay(3, [card(8, "spades")]),
  ];
  const pile = [card(8, "spades")];
  const history: Card[][] = [
    [card(10, "hearts")],
    [card(9, "diamonds")],
    [card(10, "clubs")],
  ];
  const trick: TrickHistory = { trickNumber: 1, actions: actions.slice(0, 3) };
  const eightAllowedBeforePlay = isValidPlay(
    [card(8, "spades")],
    [card(10, "clubs")],
    undefined,
    history,
    undefined,
    undefined,
    trick,
    players,
    [],
  );
  const snap = snapshotRunState(actions, pile, history);
  console.log("chronology:", snap.chronology);
  console.log("pile:", snap.pile);
  console.log("runSeq:", snap.runSeq);
  console.log("inRunContext:", snap.inRunContext);
  console.log("isRunContextSequence(runSeq):", snap.isRunContextSequenceRunSeq);
  console.log(
    "currentTrick.actions ranks:",
    actions.map((a) => a.cards!.map((c) => c.value)),
  );
  console.log("isValidPlay(8 on pile [10] after 10,9,10):", eightAllowedBeforePlay);
  console.log(
    "allows final 8 via:",
    "isValidPlay §10b + getRunExtensionAnchorValues step-back anchor on 9",
  );
  console.log(
    "sets inRunContext via:",
    "resolveRunContext → resolveRunFromChronology skip-over block → synthesized runSeq [10,9,8]",
  );
}

console.log("\n=== Invalid activation — must NOT be runs ===\n");

violations += expectNotRun("10,9,8 descending (play order 10 then 9 then 8)", () => {
  const pile = [card(8)];
  const history = [[card(10)], [card(9)]];
  const actions = [makePlay(0, [card(10)]), makePlay(1, [card(9)]), makePlay(2, [card(8)])];
  assertNotRun("10,9,8", snapshotRunState(actions, pile, history));
});

violations += expectNotRun("10,9,10,8 live report", () => {
  const pile = [card(8)];
  const history = [[card(10)], [card(9)], [card(10)]];
  const actions = [
    makePlay(0, [card(10)]),
    makePlay(1, [card(9)]),
    makePlay(2, [card(10)]),
    makePlay(3, [card(8)]),
  ];
  assertNotRun("10,9,10,8", snapshotRunState(actions, pile, history));
  assert.strictEqual(
    isValidPlay(
      [card(8)],
      [card(10)],
      undefined,
      history,
      undefined,
      undefined,
      { trickNumber: 1, actions: actions.slice(0, 3) },
      players,
      [],
    ),
    false,
    "8 illegal on pile [10] after 10,9,10",
  );
});

expectNotRun("10,9,10 partial oscillation (baseline — engine already correct)", () => {
  const pile = [card(10)];
  const history = [[card(10)], [card(9)]];
  const actions = [makePlay(0, [card(10)]), makePlay(1, [card(9)]), makePlay(2, [card(10)])];
  assertNotRun("10,9,10", snapshotRunState(actions, pile, history));
});

console.log("\n=== Valid activation — must be runs ===\n");

violations += expectRun("8,9,10 singles", () => {
  const pile = [card(10)];
  const history = [[card(8)], [card(9)]];
  const actions = [makePlay(0, [card(8)]), makePlay(1, [card(9)]), makePlay(2, [card(10)])];
  assertRun("8,9,10", snapshotRunState(actions, pile, history), [8, 9, 10]);
});

violations += expectRun("88,99,1010 doubles", () => {
  const pile = pair(10);
  const history = [pair(8), pair(9)];
  const actions = [makePlay(0, pair(8)), makePlay(1, pair(9)), makePlay(2, pair(10))];
  assertRun("88,99,1010", snapshotRunState(actions, pile, history), [8, 9, 10]);
});

violations += expectRun("QQQ,KKK,AAA trips", () => {
  const pile = triple(14);
  const history = [triple(12), triple(13)];
  const actions = [
    makePlay(0, triple(12)),
    makePlay(1, triple(13)),
    makePlay(2, triple(14)),
  ];
  assertRun("QQQ,KKK,AAA", snapshotRunState(actions, pile, history), [12, 13, 14]);
});

console.log("\n=== Multiplicity mismatch — must NOT be runs ===\n");

expectNotRun("88,99,10 (baseline — engine already correct)", () => {
  const pile = [card(10)];
  const history = [pair(8), pair(9)];
  const actions = [makePlay(0, pair(8)), makePlay(1, pair(9)), makePlay(2, [card(10)])];
  assertNotRun("88,99,10", snapshotRunState(actions, pile, history));
});

expectNotRun("8,99,1010 (baseline — engine already correct)", () => {
  const pile = pair(10);
  const history = [[card(8)], pair(9)];
  const actions = [makePlay(0, [card(8)]), makePlay(1, pair(9)), makePlay(2, pair(10))];
  assertNotRun("8,99,1010", snapshotRunState(actions, pile, history));
});

console.log(`\nHouse-rules violations on current engine: ${violations}\n`);
process.exit(violations > 0 ? 1 : 0);
