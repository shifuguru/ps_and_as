/**
 * Regression: demoting the joker/clear leader mid-acknowledgment must not
 * soft-lock the table (null lastPlay + uncleared lastClear/pile).
 *
 *   node scripts/test-demote-joker-ack.mjs
 */
import { createRequire } from "module";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

require(path.join(__dirname, "../node_modules/ts-node")).register({
  transpileOnly: true,
  skipProject: true,
  compilerOptions: {
    module: "commonjs",
    moduleResolution: "node",
    esModuleInterop: true,
    target: "ES2020",
    strict: false,
  },
});

const core = require("../src/game/core.ts");
const { lastPlayIndexAfterRemoval } = require("../server/seatIndex.js");

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function clone(s) {
  return JSON.parse(JSON.stringify(s));
}

const joker = { suit: "joker", value: 16 };

function makeAckState() {
  return {
    players: [
      {
        id: "human-1",
        name: "Human",
        hand: [{ suit: "hearts", value: 5 }],
        role: "Neutral",
      },
      {
        id: "cpu-1",
        name: "Bot1",
        hand: [
          { suit: "clubs", value: 4 },
          { suit: "diamonds", value: 6 },
        ],
        role: "Neutral",
      },
      {
        id: "cpu-2",
        name: "Bot2",
        hand: [
          { suit: "spades", value: 7 },
          { suit: "hearts", value: 8 },
        ],
        role: "Neutral",
      },
    ],
    currentPlayerIndex: 0,
    pile: [joker],
    pileHistory: [],
    pileOwners: [],
    passCount: 0,
    finishedOrder: [],
    lastRoundOrder: [],
    trickHistory: [],
    mustPlay: false,
    lastPlayPlayerIndex: 0,
    lastClear: { type: "joker", value: 15, playerIndex: 0 },
    currentTrick: {
      trickNumber: 1,
      actions: [
        {
          type: "play",
          playerId: "human-1",
          playerName: "Human",
          cards: [joker],
          timestamp: 1,
        },
      ],
    },
    tenRule: { active: false, direction: null },
    tenRulePending: false,
  };
}

// --- Pre-fix pathology: sole clear-leader removal → null lastPlay, resolve stuck ---
{
  const state = makeAckState();
  assert(core.isTrickAcknowledgmentPassPhase(state), "setup must be ack phase");
  const removedIdx = 0;
  const wasLeader = state.lastPlayPlayerIndex === removedIdx;
  state.players = state.players.filter((p) => p.id !== "human-1");
  state.lastPlayPlayerIndex = lastPlayIndexAfterRemoval(
    state,
    removedIdx,
    wasLeader,
  );
  assert(state.lastPlayPlayerIndex === null, "sole leader removal clears lastPlay");
  assert(core.isTrickAcknowledgmentPassPhase(state), "ack markers remain");
  assert(core.resolveTrickLeaderIndex(state) === null, "no living leader");

  let s = state;
  for (const id of ["cpu-1", "cpu-2"]) {
    s = core.passTurn(clone(s), id);
  }
  assert(s.pile.length === 1, "passes alone do not clear orphaned joker pile");
  assert(
    core.resolveCompletedAcknowledgmentTrick(clone(s)).pile.length === 1,
    "resolveCompleted cannot finish without a leader",
  );
  assert(
    core.maybeResolveTrickAfterPasses(clone(s)) === null,
    "maybeResolve returns null without a leader",
  );
}

// --- Fix: abandonOrphanedAcknowledgmentTrick dumps clear and forces a lead ---
{
  const state = makeAckState();
  const removedIdx = 0;
  const wasLeader = true;
  const wasAckPhase = core.isTrickAcknowledgmentPassPhase(state);
  state.players = state.players.filter((p) => p.id !== "human-1");
  state.lastPlayPlayerIndex = lastPlayIndexAfterRemoval(
    state,
    removedIdx,
    wasLeader,
  );
  assert(wasAckPhase && core.isTrickAcknowledgmentPassPhase(state), "still ack");

  const anchor = Math.max(0, Math.min(removedIdx, state.players.length) - 1);
  const next = core.abandonOrphanedAcknowledgmentTrick(state, anchor);
  assert(next.pile.length === 0, "abandoned clear must empty the pile");
  assert(!next.lastClear, "lastClear cleared");
  assert(!core.isTrickAcknowledgmentPassPhase(next), "no longer ack phase");
  assert(next.mustPlay === true, "next seat must lead");
  const lead = next.players[next.currentPlayerIndex];
  assert(lead && lead.id !== "human-1", "living seat leads after abandon");
}

// --- Prior living play remapped: abandon still required (wrong winner otherwise) ---
{
  const state = makeAckState();
  state.currentTrick.actions = [
    {
      type: "play",
      playerId: "cpu-1",
      playerName: "Bot1",
      cards: [{ suit: "clubs", value: 4 }],
      timestamp: 1,
    },
    {
      type: "play",
      playerId: "human-1",
      playerName: "Human",
      cards: [joker],
      timestamp: 2,
    },
  ];
  state.pile = [joker];
  state.lastPlayPlayerIndex = 0; // human
  state.lastClear = { type: "joker", value: 15, playerIndex: 0 };

  const removedIdx = 0;
  state.players = state.players.filter((p) => p.id !== "human-1");
  state.lastPlayPlayerIndex = lastPlayIndexAfterRemoval(state, removedIdx, true);
  assert(
    state.lastPlayPlayerIndex === 0,
    "remaps to prior living play (cpu-1 @0 after splice)",
  );
  // Without abandon, resolve would award the joker clear to cpu-1.
  const wrong = core.resolveCompletedAcknowledgmentTrick(
    (() => {
      const s = clone(state);
      s.currentTrick.actions.push(
        { type: "pass", playerId: "cpu-2", playerName: "Bot2", timestamp: 3 },
      );
      return s;
    })(),
  );
  assert(
    wrong.pile.length === 0 &&
      wrong.trickHistory?.[wrong.trickHistory.length - 1]?.winnerId === "cpu-1",
    "pre-fix path awards clear to remapped prior play",
  );

  const abandoned = core.abandonOrphanedAcknowledgmentTrick(clone(state), 0);
  assert(abandoned.pile.length === 0, "abandon clears remapped-leader ack too");
  assert(!abandoned.lastClear, "abandon clears lastClear");
}

console.log("PASS demote-joker-ack soft-lock regression");
