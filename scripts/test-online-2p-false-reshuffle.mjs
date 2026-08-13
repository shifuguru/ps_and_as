/**
 * Regression: online 2-player ceremony must not false-positive dealer reshuffle
 * from viewer-masked hands (opponents + dead hand are value:0 placeholders).
 *
 * Without the fix, the seat that cannot see remote 3♣ latches awaitReshuffle
 * forever while the server rejects dealerReshuffle ("not needed").
 *
 *   node scripts/test-online-2p-false-reshuffle.mjs
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
  executeCeremonyDeal,
  needsRoundOneDealerReshuffle,
} = require("../server/gameBridge");
const { resolveCeremonyLaunchMode } = require("../src/game/dealCeremonyAnimation.ts");
const { viewForPlayer } = require("../server/gameStateView.js");

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

/** Minimal round-1 2p+dead state: Alice holds 3♣, Bob does not. */
function buildServerState() {
  return {
    id: "game-test",
    players: [
      {
        id: "alice",
        name: "Alice",
        hand: [
          { suit: "clubs", value: 3 },
          { suit: "hearts", value: 5 },
          { suit: "spades", value: 9 },
        ],
        role: "Neutral",
        isDeadHand: false,
      },
      {
        id: "bob",
        name: "Bob",
        hand: [
          { suit: "diamonds", value: 7 },
          { suit: "spades", value: 10 },
          { suit: "hearts", value: 12 },
        ],
        role: "Neutral",
        isDeadHand: false,
      },
      {
        id: "__dead_hand__",
        name: "Dead Hand",
        hand: [],
        sidelinedHand: [
          { suit: "hearts", value: 3 },
          { suit: "diamonds", value: 3 },
          { suit: "spades", value: 3 },
        ],
        role: "Neutral",
        isDeadHand: true,
      },
    ],
    currentPlayerIndex: 0,
    pile: [],
    passCount: 0,
    finishedOrder: [],
    lastRoundOrder: [],
    started: true,
    lastPlayPlayerIndex: null,
    mustPlay: true,
    pileHistory: [],
    pileOwners: [],
    tableStacks: [],
    tableStackOwners: [],
    trickHistory: [],
    currentTrick: { trickNumber: 1, actions: [] },
    tenRule: { active: false, direction: null },
    freshRound: true,
  };
}

{
  const full = buildServerState();
  const serverNeed = needsRoundOneDealerReshuffle(full.players, {
    hostId: "alice",
  });
  assert(serverNeed === false, "server with real faces must not need reshuffle");

  const aliceView = viewForPlayer(full, "alice");
  const bobView = viewForPlayer(full, "bob");

  // Proof the mask hides Alice's 3♣ from Bob (and dead-hand threes).
  const bobSeesAliceThreeClubs = bobView.players[0].hand.some(
    (c) => c.suit === "clubs" && c.value === 3,
  );
  assert(!bobSeesAliceThreeClubs, "Bob must not see Alice's 3♣ faces");

  const bobMaskedNeed = needsRoundOneDealerReshuffle(bobView.players, {
    hostId: "alice",
  });
  assert(
    bobMaskedNeed === true,
    "masked Bob view must falsely need reshuffle (documents the hazard)",
  );

  const aliceDeal = executeCeremonyDeal(aliceView, [], {
    onlineAuthoritative: true,
    hostId: "alice",
  });
  const bobDeal = executeCeremonyDeal(bobView, [], {
    onlineAuthoritative: true,
    hostId: "alice",
  });

  assert(
    aliceDeal.needsDealerReshuffle === false,
    "online authoritative Alice ceremony must not await reshuffle",
  );
  assert(
    bobDeal.needsDealerReshuffle === false,
    "online authoritative Bob ceremony must not await reshuffle despite masked hands",
  );

  const bobLaunch = resolveCeremonyLaunchMode({
    needsDealerReshuffle: bobDeal.needsDealerReshuffle,
    trades: bobDeal.trades,
    skipDealAnimations: false,
    shouldFinalizeEarly: false,
  });
  assert(
    bobLaunch !== "awaitReshuffle",
    `Bob launch mode must not be awaitReshuffle (got ${bobLaunch})`,
  );

  // Offline / non-authoritative still uses real hands for legitimate reshuffle.
  const offlineMasked = executeCeremonyDeal(bobView, [], {
    onlineAuthoritative: false,
    hostId: "alice",
  });
  // Without onlineAuthoritative, ceremony re-deals from empty hands (seed path),
  // so do not assert on bobView placeholders — just confirm flag is boolean.
  assert(
    typeof offlineMasked.needsDealerReshuffle === "boolean",
    "offline ceremony still computes reshuffle flag",
  );
}

console.log("online-2p-false-reshuffle: PASS");
