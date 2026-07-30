/**
 * Repro: active run 8→9→10→9→8, pile [8] — dump legality state.
 * Run: npx tsx scripts/repro-active-run-891098.mjs
 */
import {
  resolveRunContext,
  isValidPlay,
  isValidRunExtension,
  isAdjacentToPileTop,
  runDirection,
} from "../src/game/core.ts";

function card(v) {
  return { value: v, suit: "spades" };
}

const players = [
  {
    id: "p0",
    name: "P0",
    hand: [card(7), card(9), card(6), card(8), card(10)],
    role: "Neutral",
  },
  { id: "p1", name: "P1", hand: [], role: "Neutral" },
  { id: "p2", name: "P2", hand: [], role: "Neutral" },
  { id: "p3", name: "P3", hand: [], role: "Neutral" },
];

function makeAction(i, cards) {
  const p = players[i % 4];
  return {
    type: "play",
    playerId: p.id,
    playerName: p.name,
    cards,
    timestamp: Date.now(),
  };
}

const actions = [
  makeAction(0, [card(8)]),
  makeAction(1, [card(9)]),
  makeAction(2, [card(10)]),
  makeAction(3, [card(9)]),
  makeAction(0, [card(8)]),
];

function canCardBePlayedAtAll(cardValue, pile, pileHistory, trick) {
  const { runMultiplicity, inRunContext } = resolveRunContext(
    pile,
    pileHistory,
    trick,
    players,
    [],
  );
  const sameValue = players[0].hand.filter((c) => c.value === cardValue);
  if (inRunContext) {
    if (!isAdjacentToPileTop(pile, cardValue)) return false;
    if (sameValue.length < runMultiplicity) return false;
    return isValidPlay(
      sameValue.slice(0, runMultiplicity),
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
  const requiredCount = pile.length;
  if (sameValue.length < requiredCount) return false;
  return isValidPlay(
    sameValue.slice(0, requiredCount),
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

function dumpScenario(label, trick, pileHistory, pile) {
  const ctx = resolveRunContext(pile, pileHistory, trick, players, []);
  const candidateRanks = [6, 7, 8, 9, 10];
  const legalMoves = Object.fromEntries(
    candidateRanks.map((rank) => [
      rank,
      isValidPlay(
        [card(rank)],
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
  const uiPlayable = Object.fromEntries(
    candidateRanks.map((rank) => [
      rank,
      canCardBePlayedAtAll(rank, pile, pileHistory, trick),
    ]),
  );

  console.log(`\n--- ${label} ---`);
  console.log(
    JSON.stringify(
      {
        inRunContext: ctx.inRunContext,
        runSeq: ctx.runSeq.map((c) => c.value),
        runDirection:
          ctx.runSeq.length >= 2 ? runDirection(ctx.runSeq) : null,
        pile: pile.map((c) => c.value),
        pileTop: pile[0]?.value,
        legalMoves,
        uiPlayable,
        symptomMatch: !legalMoves[7] && legalMoves[9] && !uiPlayable[7] && uiPlayable[9],
      },
      null,
      2,
    ),
  );
}

const pile = [card(8)];
const fullHistory = [[card(8)], [card(9)], [card(10)], [card(9)]];
const fullTrick = { trickNumber: 1, actions };

dumpScenario("full state (canonical)", fullTrick, fullHistory, pile);
dumpScenario("no currentTrick", undefined, fullHistory, pile);
dumpScenario(
  "history without opening 8",
  fullTrick,
  [[card(9)], [card(10)], [card(9)]],
  pile,
);
dumpScenario(
  "trick truncated to 3 plays",
  { trickNumber: 1, actions: actions.slice(0, 3) },
  fullHistory,
  pile,
);
dumpScenario(
  "history only [[8],[9],[10]]",
  fullTrick,
  [[card(8)], [card(9)], [card(10)]],
  pile,
);
dumpScenario("pileHistory empty, trick only", fullTrick, [], pile);

// Canonical full dump
{
  const trick = fullTrick;
  const pileHistory = fullHistory;
  const ctx = resolveRunContext(pile, pileHistory, trick, players, []);
  const anchors = [6, 7, 8, 9, 10].map((rank) => ({
    rank,
    isValidRunExtension: isValidRunExtension(
      rank,
      pile,
      pileHistory,
      trick,
      players,
      [],
    ),
    isAdjacentToPileTop: isAdjacentToPileTop(pile, rank),
  }));
  console.log("\n=== Canonical extension anchor analysis ===");
  console.log(
    JSON.stringify(
      {
        inRunContext: ctx.inRunContext,
        runSeq: ctx.runSeq.map((c) => c.value),
        runDirection: runDirection(ctx.runSeq),
        lastPlayedRank: actions[actions.length - 1].cards[0].value,
        extensionByRank: anchors,
      },
      null,
      2,
    ),
  );
}
