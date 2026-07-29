/**
 * Rules integrity regressions:
 * - forged duplicate cards in one play must not create pile copies
 * - completed role trades must reject replay (no double-credit of incoming)
 *
 *   node scripts/test-play-and-trade-integrity.mjs
 */
import path from "path";
import { createRequire } from "module";
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

const {
  playCards,
  createGameFromLobby,
} = require("../server/gameBridge");

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function card(suit, value) {
  return { suit, value };
}

function buildPlayState(hand) {
  const lobby = [
    { id: "p1", name: "Alice", isCpu: false },
    { id: "p2", name: "Bob", isCpu: false },
    { id: "p3", name: "Carol", isCpu: false },
    { id: "p4", name: "Dave", isCpu: false },
  ];
  const state = createGameFromLobby(lobby, 42);
  state.currentPlayerIndex = 0;
  state.players[0].hand = hand.map((c) => ({ ...c }));
  state.players[1].hand = [card("hearts", 3)];
  state.players[2].hand = [card("diamonds", 3)];
  state.players[3].hand = [card("clubs", 4)];
  state.pile = [];
  state.pileHistory = [];
  state.currentTrick = null;
  state.mustPlay = true;
  state.tenRule = { active: false, direction: null };
  state.tenRulePending = false;
  state.finishedOrder = [];
  // Skip first-round 3♣ opener constraint so rank-play cases stay focused.
  state.lastRoundOrder = ["p1", "p2", "p3", "p4"];
  state.runOnTop = null;
  state.fourOfAKindChallenge = null;
  return state;
}

function testDuplicatePlayRejected() {
  const king = card("spades", 13);
  const before = buildPlayState([king, card("hearts", 5)]);
  const forgedPair = [king, king];
  const after = playCards(before, "p1", forgedPair);
  assert(after === before, "duplicate forged pair must be rejected (same state ref)");
  assert(
    before.players[0].hand.filter((c) => c.suit === "spades" && c.value === 13)
      .length === 1,
    "hand must still contain exactly one king",
  );
  assert((before.pile || []).length === 0, "pile must stay empty on reject");
  console.log("ok: duplicate play rejected");
}

function testLegitimatePairStillWorks() {
  const hand = [card("spades", 13), card("hearts", 13), card("clubs", 5)];
  const before = buildPlayState(hand);
  const pair = [card("spades", 13), card("hearts", 13)];
  const after = playCards(before, "p1", pair);
  assert(after !== before, "legitimate pair must apply");
  assert(
    after.players[0].hand.every(
      (c) => !(c.value === 13 && (c.suit === "spades" || c.suit === "hearts")),
    ),
    "both kings removed from hand",
  );
  assert(
    after.pile.length === 2 && after.pile.every((c) => c.value === 13),
    "pile should show the pair",
  );
  console.log("ok: legitimate pair accepted");
}

/** Mirror of server applyWinnerSelectedCards with the fixed idempotency guard. */
function applyWinnerSelectedCards(gameState, playerHands, winnerId, selectedCards) {
  const pending = gameState.pendingTrades || {};
  let key = null;
  if (
    pending.president &&
    pending.president.fromId &&
    pending.president.incoming &&
    pending.president.incoming.length > 0
  ) {
    const presId = Object.keys(gameState.roles || {}).find(
      (k) => gameState.roles[k] === "president",
    );
    if (presId === winnerId) key = "president";
  }
  if (!key && pending.vicePresident) {
    const vpId = Object.keys(gameState.roles || {}).find(
      (k) => gameState.roles[k] === "vice_president",
    );
    if (vpId === winnerId) key = "vicePresident";
  }
  if (!key) return { ok: false, message: "No pending trade for this player" };

  const trade = pending[key];
  if (!trade) return { ok: false, message: "Trade not found" };
  if (trade.selected) {
    return { ok: false, message: "Trade already completed" };
  }

  const expectedCount = trade.count;
  if (!Array.isArray(selectedCards) || selectedCards.length !== expectedCount) {
    return { ok: false, message: `Must select exactly ${expectedCount} cards` };
  }

  const winnerHand = [...(playerHands[winnerId] || [])];
  const selectedCopy = [];
  for (const sc of selectedCards) {
    const found = winnerHand.findIndex(
      (c) => c.suit === sc.suit && c.value === sc.value,
    );
    if (found === -1) {
      return { ok: false, message: "Selected card not in winner hand" };
    }
    selectedCopy.push(winnerHand[found]);
    winnerHand.splice(found, 1);
  }

  playerHands[winnerId] = winnerHand;
  const loserId = trade.fromId;
  playerHands[loserId] = (playerHands[loserId] || []).concat(selectedCopy);
  playerHands[winnerId] = (playerHands[winnerId] || []).concat(
    trade.incoming || [],
  );
  trade.selected = selectedCopy;
  return { ok: true };
}

function testTradeReplayRejected() {
  const gameState = {
    roles: { p1: "president", p2: "asshole" },
    pendingTrades: {
      president: {
        fromId: "p2",
        count: 2,
        incoming: [card("spades", 14), card("hearts", 14)],
        selected: null,
      },
    },
  };
  const playerHands = {
    p1: [card("clubs", 3), card("diamonds", 4), card("hearts", 5), card("spades", 6)],
    p2: [card("clubs", 7)],
  };
  const first = applyWinnerSelectedCards(gameState, playerHands, "p1", [
    card("clubs", 3),
    card("diamonds", 4),
  ]);
  assert(first.ok, `first trade should succeed: ${first.message}`);
  const handAfterFirst = playerHands.p1.length;
  const second = applyWinnerSelectedCards(gameState, playerHands, "p1", [
    card("hearts", 5),
    card("spades", 6),
  ]);
  assert(!second.ok, "replay must be rejected");
  assert(
    second.message === "Trade already completed",
    `unexpected replay message: ${second.message}`,
  );
  assert(
    playerHands.p1.length === handAfterFirst,
    "replay must not grow winner hand",
  );
  console.log("ok: trade replay rejected");
}

function testServerTradeGuardPresent() {
  const fs = require("fs");
  const src = fs.readFileSync(
    path.join(__dirname, "../server/index.js"),
    "utf8",
  );
  assert(
    src.includes("Trade already completed"),
    "server applyWinnerSelectedCards must reject completed trades",
  );
  assert(
    src.includes("tenRuleChooserIndex(working)"),
    "server gameAction must validate ten-rule chooser",
  );
  assert(
    src.includes("ignore caller-supplied finishOrder/hands") ||
      /socket\.on\('roundFinished',\s*\(\{\s*roomId\s*\}\)/.test(src),
    "roundFinished must ignore client finishOrder/hands",
  );
  assert(
    !/socket\.on\('roundFinished',\s*\(\{\s*roomId,\s*finishOrder,\s*hands\s*\}\)/.test(
      src,
    ),
    "roundFinished must not accept client finishOrder/hands args",
  );
  console.log("ok: server trade + ten-rule + roundFinished guards present");
}

function testOfflineTradeReplayRejected() {
  const { completeWinnerReturn } = require("../server/gameBridge");
  const players = [
    {
      id: "p1",
      name: "Alice",
      role: "President",
      hand: [
        card("clubs", 3),
        card("diamonds", 4),
        card("hearts", 5),
        card("spades", 6),
      ],
    },
    {
      id: "p2",
      name: "Bob",
      role: "Asshole",
      hand: [card("clubs", 7)],
    },
  ];
  const trade = {
    key: "president",
    winnerId: "p1",
    loserId: "p2",
    winnerName: "Alice",
    loserName: "Bob",
    incoming: [card("spades", 14), card("hearts", 14)],
    returnCount: 2,
    completed: false,
  };
  assert(
    completeWinnerReturn(players, trade, [
      card("clubs", 3),
      card("diamonds", 4),
    ]),
    "first offline trade should succeed",
  );
  const lenAfter = players[0].hand.length;
  assert(
    !completeWinnerReturn(players, trade, [
      card("hearts", 5),
      card("spades", 6),
    ]),
    "completed offline trade must reject replay",
  );
  assert(
    players[0].hand.length === lenAfter,
    "offline trade replay must not grow winner hand",
  );
  console.log("ok: offline trade replay rejected");
}

function main() {
  testDuplicatePlayRejected();
  testLegitimatePairStillWorks();
  testTradeReplayRejected();
  testOfflineTradeReplayRejected();
  testServerTradeGuardPresent();
  console.log("\nAll play/trade integrity checks passed.");
}

main();
