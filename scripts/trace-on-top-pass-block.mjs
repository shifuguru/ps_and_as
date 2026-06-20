#!/usr/bin/env node
/**
 * Trace: runOnTop.active === true AND hasPassedInCurrentTrick(winner) === true
 * → pre-fix client guards block the on-top winner.
 *
 * Run: npx tsx ./scripts/trace-on-top-pass-block.mjs
 */
import {
  createGame,
  playCards,
  passTurn,
  hasPassedInCurrentTrick,
  playerCanActInCurrentTrick,
  resolveDisplayTurnPlayerIndex,
} from "../src/game/core.ts";

function snapshot(label, state, winnerId = "1") {
  const wi = state.players.findIndex((p) => p.id === winnerId);
  return {
    label,
    runOnTop: state.runOnTop ?? null,
    currentPlayerIndex: state.currentPlayerIndex,
    displayTurnIndex: resolveDisplayTurnPlayerIndex(state),
    winnerId,
    hasPassedWinner: hasPassedInCurrentTrick(state, winnerId),
    playerCanActWinner: playerCanActInCurrentTrick(state, wi),
    trickPasses: (state.currentTrick?.actions ?? [])
      .filter((a) => a.type === "pass")
      .map((a) => a.playerId),
    trickPlays: (state.currentTrick?.actions ?? [])
      .filter((a) => a.type === "play")
      .map((a) => ({ pid: a.playerId, cards: a.cards?.map((c) => c.value) })),
  };
}

function simulatePreFixClientGuards(state, winnerId, myPlayerId = winnerId) {
  const localHumanId = myPlayerId;
  const displayTurnIndex = resolveDisplayTurnPlayerIndex(state);
  const wi = state.players.findIndex((p) => p.id === winnerId);

  // HEAD before v1.0.61 client fix (investigation baseline)
  const runOnTopActive_PRE_FIX =
    !!state.runOnTop?.active &&
    state.runOnTop.playerIndex === displayTurnIndex;
  const humanRunOnTopTurn_PRE_FIX =
    !!state.runOnTop?.active &&
    state.players[state.runOnTop.playerIndex]?.id === localHumanId;

  const runOnTopActive_FIXED =
    !!state.runOnTop?.active &&
    state.runOnTop.playerIndex === state.currentPlayerIndex;
  const humanRunOnTopTurn_FIXED =
    runOnTopActive_FIXED &&
    !!localHumanId &&
    state.players[state.runOnTop.playerIndex]?.id === localHumanId;

  const hasPassed = hasPassedInCurrentTrick(state, winnerId);

  return {
    state: {
      runOnTopActive: state.runOnTop?.active,
      hasPassedWinner: hasPassed,
      bothTrue: !!(state.runOnTop?.active && hasPassed),
      corePlayerCanAct: playerCanActInCurrentTrick(state, wi),
    },
    preFix_HEAD_handlers: {
      note: "handlePlayPress/handlePassPress had NO humanRunOnTopTurn exemption",
      runOnTopActive_displayTurn: runOnTopActive_PRE_FIX,
      humanRunOnTopTurn_for_isHumanTurn: humanRunOnTopTurn_PRE_FIX,
      handlePlayPress_blocked: hasPassed,
      handlePassPress_blocked: hasPassed,
      passDisabled: !!(localHumanId && hasPassed),
      playDisabled_passGuard: !!(localHumanId && hasPassed),
    },
    preFix_HEAD_with_exemption: {
      note: "If only passDisabled/playDisabled lacked exemption (handlers still blocked)",
      handlePlayPress_blocked: hasPassed && !humanRunOnTopTurn_PRE_FIX,
      passDisabled: !!(localHumanId && hasPassed && !humanRunOnTopTurn_PRE_FIX),
    },
    fixed_v1_0_61: {
      humanRunOnTopTurn: humanRunOnTopTurn_FIXED,
      handlePlayPress_blocked: hasPassed && !humanRunOnTopTurn_FIXED,
      passDisabled: !!(localHumanId && hasPassed && !humanRunOnTopTurn_FIXED),
    },
  };
}

console.log("=== Part A: Authoritative core after grant (pass stripped) ===\n");

const g = createGame(["P1", "P2", "P3", "P4"]);
g.players.forEach((p) => {
  p.hand = [];
});
g.pile = [];
g.pileHistory = [];
g.currentTrick = { trickNumber: 1, actions: [] };
g.mustPlay = false;
g.lastRoundOrder = ["1", "2", "3", "4"];
g.players[0].hand = [
  { suit: "hearts", value: 10 },
  { suit: "hearts", value: 11 },
  { suit: "clubs", value: 3 },
  { suit: "spades", value: 5 },
];
g.players[1].hand = [{ suit: "clubs", value: 4 }];
g.players[2].hand = [{ suit: "spades", value: 6 }];
g.players[3].hand = [{ suit: "diamonds", value: 7 }];
g.currentPlayerIndex = 0;

let s = playCards(g, "1", [{ suit: "hearts", value: 10 }], {
  tenRuleDirection: "higher",
});
// Winner passed earlier in the same trick (before others finished passing).
s.currentTrick.actions.splice(1, 0, {
  type: "pass",
  playerId: "1",
  playerName: "P1",
  timestamp: Date.now(),
});
console.log(
  "Mid-trick (before grant):",
  JSON.stringify(snapshot("P1 passed early, 10 on pile", s, "1"), null, 2),
);
s = passTurn(s, "2");
s = passTurn(s, "3");
s = passTurn(s, "4");

// If early-pass injection prevented grant, use clean grant then re-inject pass for stale trace.
let grantState = s;
if (!s.runOnTop?.active) {
  const g2 = createGame(["P1", "P2", "P3", "P4"]);
  g2.players.forEach((p) => {
    p.hand = [];
  });
  g2.pile = [];
  g2.pileHistory = [];
  g2.currentTrick = { trickNumber: 1, actions: [] };
  g2.mustPlay = false;
  g2.lastRoundOrder = ["1", "2", "3", "4"];
  g2.players[0].hand = [
    { suit: "hearts", value: 10 },
    { suit: "hearts", value: 11 },
    { suit: "clubs", value: 3 },
    { suit: "spades", value: 5 },
  ];
  g2.players[1].hand = [{ suit: "clubs", value: 4 }];
  g2.players[2].hand = [{ suit: "spades", value: 6 }];
  g2.players[3].hand = [{ suit: "diamonds", value: 7 }];
  g2.currentPlayerIndex = 0;
  grantState = playCards(g2, "1", [{ suit: "hearts", value: 10 }], {
    tenRuleDirection: "higher",
  });
  grantState = passTurn(grantState, "2");
  grantState = passTurn(grantState, "3");
  grantState = passTurn(grantState, "4");
  console.log(
    "\n(Clean grant path — no early winner pass)",
    JSON.stringify(
      snapshot("clean higher-10 grant", grantState, "1"),
      null,
      2,
    ),
  );
}
s = grantState;

const afterGrant = snapshot("after grantRunOnTopBeat (higher 10)", s, "1");
console.log(JSON.stringify(afterGrant, null, 2));
console.log(
  "\nBoth flags true after authoritative grant?",
  !!(afterGrant.runOnTop?.active && afterGrant.hasPassedWinner),
);

console.log("\n=== Part B: Stale client snapshot (both flags true) ===\n");
console.log(
  "Re-inject winner pass AFTER grant (simulates partial sync / overlay bug).\n",
);

const stale = structuredClone(s);
stale.currentTrick.actions.push({
  type: "pass",
  playerId: "1",
  playerName: "P1",
  timestamp: Date.now(),
});

const staleSnap = snapshot("stale client state", stale, "1");
console.log(JSON.stringify(staleSnap, null, 2));
console.log(
  "\nBoth flags true?",
  !!(staleSnap.runOnTop?.active && staleSnap.hasPassedWinner),
);

console.log("\n=== Part C: Guard trace on stale state (winner = P1 / local human) ===\n");
console.log(JSON.stringify(simulatePreFixClientGuards(stale, "1"), null, 2));

console.log("\n=== Part D: Pre-fix HEAD — displayTurnIndex vs currentPlayerIndex ===\n");

const displayMismatch = structuredClone(stale);
displayMismatch.currentPlayerIndex = 0;
displayMismatch.runOnTop = { active: true, playerIndex: 0 };
// Force display index away from winner while pass remains (stale UI path)
displayMismatch._forceDisplaySkip = true;

console.log(
  JSON.stringify(
    {
      currentPlayerIndex: displayMismatch.currentPlayerIndex,
      displayTurnIndex: resolveDisplayTurnPlayerIndex(displayMismatch),
      runOnTopPlayerIndex: displayMismatch.runOnTop?.playerIndex,
      hasPassedWinner: hasPassedInCurrentTrick(displayMismatch, "1"),
      preFix_runOnTopActive_display:
        displayMismatch.runOnTop?.active &&
        displayMismatch.runOnTop.playerIndex ===
          resolveDisplayTurnPlayerIndex(displayMismatch),
    },
    null,
    2,
  ),
);

console.log("\n=== Trace summary ===");
console.log(`
1. grantRunOnTopBeat removes the leader's pass from currentTrick (core.ts ~2593–2598).
   → Authoritative server state: runOnTop.active && hasPassed(winner) is FALSE after grant.

2. Blocked-winner repro requires client state where BOTH are true:
   - runOnTop.active === true
   - hasPassedInCurrentTrick(winner) === true (stale pass row still in currentTrick.actions)

3. Pre-fix HEAD GameScreen handlers (no humanRunOnTopTurn exemption):
   - handlePlayPress: if (hasPassedInCurrentTrick(actor)) → BLOCK
   - handlePassPress: same
   - passDisabled / playDisabled: hasPassed → disabled
   → When both flags true, winner is BLOCKED even though core allows act.

4. With both flags true + humanRunOnTopTurn exemption (v1.0.61 fix): NOT blocked.

5. Core engine playerCanActInCurrentTrick allows on-top owner despite pass:
   return !hasPassed || runOnTopTurn  (core.ts ~2801–2803)
   → Block was client handler / disabled props, not rules engine.
`);
