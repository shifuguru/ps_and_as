/**
 * BOTOPN demote while owning a single-play bomb / On Top / ack clear must
 * abandon the pile — otherwise lastPlay null soft-locks resolve.
 *
 *   node scripts/test-demote-orphan-clear.mjs
 */
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const {
  abandonOrphanedClearTrick,
  maybeResolveTrickAfterPasses,
  resolveTrickLeaderIndex,
  isTrickAcknowledgmentPassPhase,
  passTurn,
} = require("../server/gameBridge");
const { lastPlayIndexAfterRemoval } = require("../server/seatIndex.js");

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function basePlayers() {
  return [
    {
      id: "human",
      name: "Human",
      hand: [{ suit: "hearts", value: 3 }],
      role: "Neutral",
    },
    {
      id: "bot1",
      name: "Bot1",
      hand: [{ suit: "clubs", value: 4 }],
      role: "Neutral",
    },
    {
      id: "bot2",
      name: "Bot2",
      hand: [{ suit: "diamonds", value: 5 }],
      role: "Neutral",
    },
  ];
}

function soleBombState() {
  const bomb = [
    { suit: "hearts", value: 7 },
    { suit: "clubs", value: 7 },
    { suit: "diamonds", value: 7 },
    { suit: "spades", value: 7 },
  ];
  return {
    players: basePlayers(),
    currentPlayerIndex: 1,
    lastPlayPlayerIndex: 0,
    pile: bomb,
    pileHistory: [bomb],
    pileOwners: ["human"],
    currentTrick: {
      trickNumber: 1,
      actions: [{ type: "play", playerId: "human", cards: bomb }],
    },
    finishedOrder: [],
    lastRoundOrder: [],
    passCount: 0,
    fourOfAKindChallenge: {
      active: true,
      value: 7,
      starterIndex: 0,
      completedAcrossTurns: false,
    },
    lastClear: { type: "four", value: 7, playerIndex: 0 },
    tenRule: { active: false, direction: null },
    tenRulePending: false,
  };
}

/** Mirror removePlayerFromActiveGame clear-ownership abandon path. */
function demoteClearLeader(gs, playerId) {
  const idx = gs.players.findIndex((p) => p.id === playerId);
  const wasLeader = gs.lastPlayPlayerIndex === idx;
  const wasRunOnTop =
    !!gs.runOnTop?.active && gs.runOnTop.playerIndex === idx;
  const ownedClear =
    wasLeader &&
    (isTrickAcknowledgmentPassPhase(gs) ||
      !!gs.fourOfAKindChallenge?.active ||
      !!gs.lastClear ||
      wasRunOnTop);

  gs.players = gs.players.filter((p) => p.id !== playerId);
  gs.lastPlayPlayerIndex = lastPlayIndexAfterRemoval(gs, idx, wasLeader);
  if (wasRunOnTop) gs.runOnTop = undefined;

  if (ownedClear) {
    const anchor = Math.max(0, Math.min(idx, gs.players.length) - 1);
    return abandonOrphanedClearTrick(gs, anchor);
  }
  return gs;
}

// 1) Without abandon: sole bomb demote → null leader → passes never resolve
{
  const gs = soleBombState();
  gs.players = gs.players.filter((p) => p.id !== "human");
  gs.lastPlayPlayerIndex = lastPlayIndexAfterRemoval(gs, 0, true);
  assert(gs.lastPlayPlayerIndex === null, "sole bomb leader removal → null lastPlay");
  assert(
    resolveTrickLeaderIndex(gs) === null,
    "resolveTrickLeaderIndex null after sole bomb demote",
  );
  assert(
    !isTrickAcknowledgmentPassPhase(gs),
    "single-play bomb is NOT ack phase (PR #66 ack-only fix misses this)",
  );
  let next = { ...gs, currentPlayerIndex: 0 };
  next = passTurn(next);
  next = passTurn(next);
  const resolved = maybeResolveTrickAfterPasses(next);
  assert(resolved === null, "passes cannot resolve without living leader (soft-lock)");
  assert((next.pile?.length ?? 0) === 4, "pile still up under soft-lock");
}

// 2) With abandon: pile clears and a living seat leads
{
  const abandoned = demoteClearLeader(soleBombState(), "human");
  assert((abandoned.pile?.length ?? 0) === 0, "abandon clears pile");
  assert(abandoned.fourOfAKindChallenge == null, "abandon clears bomb marker");
  assert(abandoned.lastClear == null, "abandon clears lastClear");
  assert(
    abandoned.players.some((p) => p.id === abandoned.players[abandoned.currentPlayerIndex]?.id),
    "living seat has the lead",
  );
  assert(
    maybeResolveTrickAfterPasses(abandoned) === null,
    "fresh lead needs no resolve",
  );
}

// 3) On Top owner demote must abandon (not soft-lock)
{
  const gs = soleBombState();
  gs.fourOfAKindChallenge = undefined;
  gs.lastClear = undefined;
  gs.runOnTop = { active: true, playerIndex: 0 };
  gs.mustPlay = true;
  const abandoned = demoteClearLeader(gs, "human");
  assert((abandoned.pile?.length ?? 0) === 0, "On Top demote clears pile");
  assert(abandoned.runOnTop == null, "On Top cleared");
}

// 4) Ack joker demote also abandoned (covers PR #66 case)
{
  const joker = [{ suit: "joker", value: 16 }];
  const gs = {
    ...soleBombState(),
    pile: joker,
    pileHistory: [joker],
    fourOfAKindChallenge: undefined,
    lastClear: { type: "joker", value: 15, playerIndex: 0 },
    currentTrick: {
      trickNumber: 1,
      actions: [{ type: "play", playerId: "human", cards: joker }],
    },
  };
  assert(isTrickAcknowledgmentPassPhase(gs), "joker is ack phase");
  const abandoned = demoteClearLeader(gs, "human");
  assert((abandoned.pile?.length ?? 0) === 0, "joker demote clears pile");
}

console.log("test-demote-orphan-clear: PASS");
