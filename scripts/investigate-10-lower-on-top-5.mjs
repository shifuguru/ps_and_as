/**
 * P0 — 10 Lower + On-Top: why is 5 rejected?
 * Run: npx tsx ./scripts/investigate-10-lower-on-top-5.mjs
 */
import {
  createGame,
  playCards,
  passTurn,
  isValidPlay,
  resolveEffectiveTenRule,
  resolveRunContext,
  isOnTopEligiblePile,
  findCPUPlay,
} from "../src/game/core.ts";
import { diagnoseTenRuleOnTopRejection } from "../src/game/onTopDiagnostics.ts";

const five = { suit: "hearts", value: 5 };
const nine = { suit: "clubs", value: 9 };
const ten = { suit: "spades", value: 10 };

function diag(label, s, hand = [five]) {
  const effective = resolveEffectiveTenRule(s);
  const runCtx = resolveRunContext(
    s.pile,
    s.pileHistory,
    s.currentTrick,
    s.players,
    s.finishedOrder || [],
  );
  const runOnTop = true;
  const legalByRank = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map((r) => {
    const card = { suit: "spades", value: r };
    return {
      rank: r,
      valid: isValidPlay(
        [card],
        s.pile,
        effective,
        s.pileHistory,
        s.trickHistory,
        s.fourOfAKindChallenge,
        s.currentTrick,
        s.players,
        s.finishedOrder,
        undefined,
        "1",
        runOnTop,
      ),
    };
  }).filter((x) => x.valid);

  const fiveValid = isValidPlay(
    [five],
    s.pile,
    effective,
    s.pileHistory,
    s.trickHistory,
    s.fourOfAKindChallenge,
    s.currentTrick,
    s.players,
    s.finishedOrder,
    undefined,
    "1",
    runOnTop,
  );

  const cpuPlay = findCPUPlay(
    hand,
    s.pile,
    effective,
    s.pileHistory,
    s.fourOfAKindChallenge,
    s.currentTrick,
    s.players,
    s.finishedOrder,
    s.trickHistory,
    s.lastRoundOrder,
    "1",
    runOnTop,
  );

  const rejectReason = diagnoseTenRuleOnTopRejection(
    [five],
    s.pile,
    effective,
    runOnTop,
  );

  console.log(`\n=== ${label} ===`);
  console.log(
    JSON.stringify(
      {
        currentPlayerIndex: s.currentPlayerIndex,
        trickLeader: s.players[s.currentPlayerIndex]?.id,
        runOnTop: s.runOnTop,
        tenRule: s.tenRule,
        effectiveTenRule: effective,
        pile: s.pile.map((c) => c.value),
        pileHistory: (s.pileHistory || []).map((g) => g.map((c) => c.value)),
        inRunContext: runCtx.inRunContext,
        runSeq: runCtx.runSeq.map((c) => c.value),
        onTopEligible: isOnTopEligiblePile(
          s.pile,
          s.pileHistory,
          s.currentTrick,
          s.players,
          s.finishedOrder || [],
          effective,
        ),
        fiveValid,
        rejectReason,
        legalSingleRanks: legalByRank.map((x) => x.rank),
        cpuWouldPlay: cpuPlay?.map((c) => c.value) ?? null,
        // Non-on-top lower (trick response) for comparison
        fiveValidNormalLower: isValidPlay(
          [five],
          s.pile,
          effective,
          s.pileHistory,
          s.trickHistory,
          s.fourOfAKindChallenge,
          s.currentTrick,
          s.players,
          s.finishedOrder,
          undefined,
          "1",
          false,
        ),
      },
      null,
      2,
    ),
  );
}

// Canonical repro: 10 lower, all pass, on-top, only 5 in hand
{
  const g = createGame(["P1", "P2", "P3", "P4"]);
  g.players.forEach((p) => (p.hand = []));
  g.pile = [];
  g.pileHistory = [];
  g.currentTrick = { trickNumber: 1, actions: [] };
  g.mustPlay = false;
  g.lastRoundOrder = ["1", "2", "3", "4"];
  g.players[0].hand = [ten, five];
  g.players[1].hand = [{ suit: "clubs", value: 3 }];
  g.players[2].hand = [{ suit: "diamonds", value: 4 }];
  g.players[3].hand = [{ suit: "hearts", value: 6 }];
  g.currentPlayerIndex = 0;

  let s = playCards(g, "1", [ten], { tenRuleDirection: "lower" });
  diag("After 10-Lower play", s);
  s = passTurn(s, "2");
  s = passTurn(s, "3");
  s = passTurn(s, "4");
  diag("After all pass — on-top state", s, [five]);

  // Stripped tenRule (sync edge)
  const sStrip = { ...s, tenRule: { active: false, direction: null } };
  diag("After tenRule strip (sync sim)", sStrip, [five]);

  // Try playCards
  try {
    const after = playCards(s, "1", [five]);
  console.log("\nplayCards([5]) result pile=", after.pile.map((c) => c.value), "runOnTop=", after.runOnTop?.active);
  } catch (e) {
    console.log("\nplayCards([5]) threw:", e?.message ?? e);
  }
}
