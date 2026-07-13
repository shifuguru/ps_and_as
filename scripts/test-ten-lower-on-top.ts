/**
 * Ten-rule lower On Top grant tests — multiplicity 1..4.
 * Documents current engine behavior; flags gaps vs house rules.
 *
 * Run: npx tsx ./scripts/test-ten-lower-on-top.ts
 */
import * as assert from "assert";
import type { Card } from "../src/game/ruleset";
import {
  createGame,
  isOnTopEligiblePile,
  playCards,
  passTurn,
  resolveEffectiveTenRule,
  resolveRunContext,
} from "../src/game/core";

function card(v: number, suit: Card["suit"]): Card {
  return { value: v, suit };
}

function cardsOfRank(v: number, count: number): Card[] {
  const suits: Card["suit"][] = ["hearts", "diamonds", "clubs", "spades"];
  return suits.slice(0, count).map((suit) => card(v, suit));
}

type OnTopSnapshot = {
  runOnTopActive: boolean;
  runOnTopPlayerIndex: number | undefined;
  tenRuleDirection: string | null | undefined;
  tenRuleActive: boolean;
  onTopEligible: boolean;
  pileCount: number;
};

function snapshotAfterPasses(state: ReturnType<typeof playCards>): OnTopSnapshot {
  return {
    runOnTopActive: !!state.runOnTop?.active,
    runOnTopPlayerIndex: state.runOnTop?.playerIndex,
    tenRuleDirection: state.tenRule?.direction ?? null,
    tenRuleActive: !!state.tenRule?.active,
    onTopEligible: isOnTopEligiblePile(
      state.pile,
      state.pileHistory,
      state.currentTrick,
      state.players,
      state.finishedOrder,
      resolveEffectiveTenRule(state),
    ),
    pileCount: state.pile.length,
  };
}

function runLowerOnTopScenario(
  label: string,
  tenCards: Card[],
  beatCards: Card[],
): OnTopSnapshot {
  const g = createGame(["P1", "P2", "P3", "P4"]);
  g.players.forEach((p) => (p.hand = []));
  g.pile = [];
  g.pileHistory = [];
  g.currentTrick = { trickNumber: 1, actions: [] };
  g.mustPlay = false;
  g.lastRoundOrder = ["1", "2", "3", "4"];

  g.players[0].hand = [...tenCards, ...beatCards, card(3, "clubs")];
  g.players[1].hand = [card(4, "clubs")];
  g.players[2].hand = [card(5, "spades")];
  g.players[3].hand = [card(6, "clubs")];
  g.currentPlayerIndex = 0;

  let s = playCards(g, "1", tenCards, { tenRuleDirection: "lower" });
  s = passTurn(s, "2");
  s = passTurn(s, "3");
  s = passTurn(s, "4");

  const snap = snapshotAfterPasses(s);
  console.log(`\n${label}:`, JSON.stringify(snap, null, 2));
  return snap;
}

let passed = 0;
let failed = 0;

function check(name: string, fn: () => void): void {
  try {
    fn();
    passed++;
    console.log(`PASS ${name}`);
  } catch (e) {
    failed++;
    console.log(`FAIL ${name}:`, e instanceof Error ? e.message : e);
  }
}

console.log("\n=== Ten lower On Top — empty pile opening ===\n");

check("single 10 lower grants on-top", () => {
  const snap = runLowerOnTopScenario(
    "single-10-lower",
    [card(10, "hearts")],
    [card(9, "hearts"), card(9, "diamonds")],
  );
  assert.ok(snap.runOnTopActive, "runOnTop.active");
  assert.strictEqual(snap.runOnTopPlayerIndex, 0);
  assert.strictEqual(snap.tenRuleDirection, "lower");
  assert.ok(snap.onTopEligible, "isOnTopEligiblePile");
});

check("pair 10 lower grants on-top", () => {
  const snap = runLowerOnTopScenario(
    "pair-10-lower",
    cardsOfRank(10, 2),
    cardsOfRank(9, 2),
  );
  assert.ok(snap.runOnTopActive, "runOnTop.active");
  assert.strictEqual(snap.runOnTopPlayerIndex, 0);
  assert.strictEqual(snap.tenRuleDirection, "lower");
  assert.ok(snap.onTopEligible, "isOnTopEligiblePile");
});

check("triple 10 lower grants on-top", () => {
  const snap = runLowerOnTopScenario(
    "triple-10-lower",
    cardsOfRank(10, 3),
    cardsOfRank(9, 3),
  );
  assert.ok(snap.runOnTopActive, "runOnTop.active");
  assert.strictEqual(snap.runOnTopPlayerIndex, 0);
  assert.strictEqual(snap.tenRuleDirection, "lower");
  assert.ok(snap.onTopEligible, "isOnTopEligiblePile");
});

check("quad 10 lower grants on-top", () => {
  const snap = runLowerOnTopScenario(
    "quad-10-lower",
    cardsOfRank(10, 4),
    cardsOfRank(9, 4),
  );
  assert.ok(snap.runOnTopActive, "runOnTop.active");
  assert.strictEqual(snap.runOnTopPlayerIndex, 0);
  assert.strictEqual(snap.tenRuleDirection, "lower");
  assert.ok(snap.onTopEligible, "isOnTopEligiblePile");
});

console.log("\n=== Ten lower On Top — after 10,9,10 chronology (no false run; pair on single still invalid) ===\n");

{
  const tenPair = cardsOfRank(10, 2);
  const ninePair = cardsOfRank(9, 2);
  const g = createGame(["P1", "P2", "P3", "P4"]);
  g.players.forEach((p) => (p.hand = []));
  g.pile = [card(10, "clubs")];
  g.pileHistory = [[card(10, "hearts")], [card(9, "diamonds")], [card(10, "clubs")]];
  g.currentTrick = {
    trickNumber: 1,
    actions: [
      {
        type: "play",
        playerId: "1",
        playerName: "P1",
        cards: [card(10, "hearts")],
        timestamp: 1,
      },
      {
        type: "play",
        playerId: "2",
        playerName: "P2",
        cards: [card(9, "diamonds")],
        timestamp: 2,
      },
      {
        type: "play",
        playerId: "3",
        playerName: "P3",
        cards: [card(10, "clubs")],
        timestamp: 3,
      },
    ],
  };
  g.tenRule = { active: false, direction: null };
  g.mustPlay = false;
  g.lastRoundOrder = ["1", "2", "3", "4"];
  g.lastPlayPlayerIndex = 2;
  g.players[2].hand = [...tenPair, ...ninePair, card(3, "clubs")];
  g.players[3].hand = [card(6, "clubs")];
  g.currentPlayerIndex = 2;

  const ctxBefore = resolveRunContext(
    g.pile,
    g.pileHistory,
    g.currentTrick,
    g.players,
    [],
  );
  const pileBefore = g.pile.map((c) => c.value);
  let s = playCards(g, "3", tenPair, { tenRuleDirection: "lower" });
  const ctxAfter = resolveRunContext(
    s.pile,
    s.pileHistory,
    s.currentTrick,
    s.players,
    [],
  );

  try {
    assert.strictEqual(ctxBefore.inRunContext, false, "no false run before pair-10 attempt");
    assert.strictEqual(ctxAfter.inRunContext, false, "no false run after rejected pair-10");
    assert.deepStrictEqual(
      s.pile.map((c) => c.value),
      pileBefore,
      "pair 10 on single 10 pile rejected (count mismatch)",
    );
    assert.strictEqual(s.tenRule?.active, false, "ten rule not activated on rejected play");
    passed++;
    console.log("PASS contamination — false run cleared; invalid pair-on-single play rejected");
  } catch (e) {
    failed++;
    console.log(
      "FAIL contamination:",
      e instanceof Error ? e.message : e,
    );
  }
}

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
