/**
 * Probe: when pile top is 6 in a run, can CPU legally select 9?
 *   npx tsx ./scripts/probe-cpu-run-9.mjs
 */
import assert from "node:assert/strict";
import {
  playCards,
  findCPUPlay,
  isValidPlay,
  resolveRunContext,
  resolveEffectiveTenRule,
  applyCpuTurn,
} from "../src/game/core.ts";

function C(value, suit = "hearts") {
  return { value, suit };
}

function makeState(hands) {
  const players = hands.map((hand, i) => ({
    id: `p${i + 1}`,
    name: i === 0 ? "Human" : `CPU ${i}`,
    hand: hand.map((v, j) => C(v, ["hearts", "diamonds", "clubs", "spades"][j % 4])),
    role: "Neutral",
  }));
  return {
    id: "probe",
    players,
    currentPlayerIndex: 0,
    pile: [],
    pileHistory: [],
    pileOwners: [],
    passCount: 0,
    finishedOrder: [],
    started: true,
    mustPlay: true,
    trickHistory: [],
    currentTrick: { trickNumber: 1, actions: [] },
    lastRoundOrder: players.map((p) => p.id),
  };
}

function dump(label, state, hand, playerId) {
  const ten = resolveEffectiveTenRule(state);
  const ctx = resolveRunContext(
    state.pile,
    state.pileHistory,
    state.currentTrick,
    state.players,
    state.finishedOrder,
  );
  const runOnTopBeat =
    !!state.runOnTop?.active &&
    state.runOnTop.playerIndex === state.players.findIndex((p) => p.id === playerId);
  const cpu = findCPUPlay(
    hand,
    state.pile,
    ten,
    state.pileHistory,
    state.fourOfAKindChallenge,
    state.currentTrick,
    state.players,
    state.finishedOrder,
    state.trickHistory,
    state.lastRoundOrder,
    playerId,
    runOnTopBeat,
  );
  const probe = (v) =>
    isValidPlay(
      [C(v, "spades")],
      state.pile,
      ten,
      state.pileHistory,
      state.trickHistory,
      state.fourOfAKindChallenge,
      state.currentTrick,
      state.players,
      state.finishedOrder,
      state.lastRoundOrder,
      playerId,
      runOnTopBeat,
    );
  console.log(`\n=== ${label} ===`);
  console.log(
    JSON.stringify(
      {
        pile: state.pile.map((c) => c.value),
        pileHistory: state.pileHistory?.map((e) => e.map((c) => c.value)),
        currentTrick: state.currentTrick?.actions.map((a) => ({
          t: a.type,
          id: a.playerId,
          v: a.cards?.[0]?.value,
          n: a.cards?.length,
        })),
        runOnTop: state.runOnTop ?? null,
        ten,
        resolveRunContext: {
          runSeq: ctx.runSeq.map((c) => c.value),
          runMultiplicity: ctx.runMultiplicity,
          inRunContext: ctx.inRunContext,
        },
        hand: hand.map((c) => c.value),
        runOnTopBeat,
        findCPUPlay: cpu?.map((c) => c.value) ?? null,
        isValidPlay: { "5": probe(5), "7": probe(7), "9": probe(9) },
      },
      null,
      2,
    ),
  );
  return { ctx, cpu, ten, runOnTopBeat, probe };
}

// Case A: clean ascending 4-5-6, next has 5/7/9
{
  let s = makeState([[4, 14], [5, 11], [6, 12], [5, 7, 9, 13]]);
  s = playCards(s, "p1", [s.players[0].hand[0]]);
  s.currentPlayerIndex = 1;
  s = playCards(s, "p2", [s.players[1].hand[0]]);
  s.currentPlayerIndex = 2;
  s = playCards(s, "p3", [s.players[2].hand[0]]);
  s.currentPlayerIndex = 3;
  const r = dump("A: clean 4-5-6", s, s.players[3].hand, "p4");
  assert.equal(r.ctx.inRunContext, true);
  assert.equal(r.probe(9), false);
  assert.notEqual(r.cpu?.[0]?.value, 9);
}

// Case B: pile=[6] only, empty history/trick (lost context)
{
  let s = makeState([[9], [5], [7], [5, 7, 9]]);
  s.pile = [C(6)];
  s.pileHistory = [];
  s.currentTrick = { trickNumber: 1, actions: [] };
  s.currentPlayerIndex = 3;
  const r = dump("B: orphan pile top 6 (no history)", s, s.players[3].hand, "p4");
  assert.equal(r.ctx.inRunContext, false);
  assert.equal(r.probe(9), true);
  // Lowest strictly-higher legal card wins when run context is absent.
  assert.ok([7, 9].includes(r.cpu?.[0]?.value ?? -1));
}

// Case C: history [[4],[5],[6]] but currentTrick empty (sync strip?)
{
  let s = makeState([[14], [11], [12], [5, 7, 9]]);
  s.pile = [C(6)];
  s.pileHistory = [[C(4)], [C(5)], [C(6)]];
  s.pileOwners = ["p1", "p2", "p3"];
  s.currentTrick = { trickNumber: 1, actions: [] };
  s.currentPlayerIndex = 3;
  const r = dump("C: history only 4-5-6, empty trick", s, s.players[3].hand, "p4");
}

// Case D: step-back 4-5-6-5 then somehow top becomes 6 again? skip
// Case E: runOnTop active, inRunContext false (stale on-top)
{
  let s = makeState([[14], [11], [12], [5, 7, 9]]);
  s.pile = [C(6)];
  s.pileHistory = [];
  s.currentTrick = { trickNumber: 1, actions: [] };
  s.runOnTop = { active: true, playerIndex: 3 };
  s.currentPlayerIndex = 3;
  const r = dump("E: runOnTop + orphan 6", s, s.players[3].hand, "p4");
  assert.equal(r.probe(9), true);
}

// Case F: applyCpuTurn on clean run — must not play 9
{
  let s = makeState([[4, 14], [5, 11], [6, 12], [5, 7, 9, 13]]);
  s = playCards(s, "p1", [s.players[0].hand[0]]);
  s.currentPlayerIndex = 1;
  s = playCards(s, "p2", [s.players[1].hand[0]]);
  s.currentPlayerIndex = 2;
  s = playCards(s, "p3", [s.players[2].hand[0]]);
  s.currentPlayerIndex = 3;
  const before = s.players[3].hand.map((c) => c.value);
  s = applyCpuTurn(s, "p4");
  const after = s.players[3].hand.map((c) => c.value);
  const played = before.filter((v) => !after.includes(v));
  dump("F: after applyCpuTurn on 4-5-6", s, s.players[3].hand, "p4");
  console.log("played from hand:", played);
  assert.ok(!played.includes(9), "applyCpuTurn must not play 9 on active run 6");
}

// Case G: non-run climb 3→6 (strictly higher), looks like "on a 6" — 9 is legal
{
  let s = makeState([[3, 14], [6, 11], [8, 12], [5, 7, 9]]);
  s = playCards(s, "p1", [s.players[0].hand[0]]);
  s.currentPlayerIndex = 1;
  s = playCards(s, "p2", [s.players[1].hand[0]]);
  s.currentPlayerIndex = 3;
  const r = dump("G: non-run 3 then 6 (higher beat)", s, s.players[3].hand, "p4");
  assert.equal(r.ctx.inRunContext, false);
  assert.equal(r.probe(9), true);
}

// Case H: hand with only 9 as higher option after orphan 6
{
  let s = makeState([[14], [11], [12], [4, 9]]);
  s.pile = [C(6)];
  s.pileHistory = [];
  s.currentTrick = { trickNumber: 1, actions: [] };
  s.currentPlayerIndex = 3;
  const r = dump("H: orphan 6, hand 4+9 only", s, s.players[3].hand, "p4");
  assert.equal(r.cpu?.[0]?.value, 9);
}
