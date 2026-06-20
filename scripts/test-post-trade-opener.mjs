#!/usr/bin/env node
/**
 * Post-trade opener — server handler ordering + source regression.
 *
 *   node scripts/test-post-trade-opener.mjs
 */
import assert from "assert";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const serverSrc = fs.readFileSync(
  path.join(ROOT, "server", "index.js"),
  "utf8",
);

// Test 3 — trade-complete path must sync opener before broadcastGameState.
{
  const handlerStart = serverSrc.indexOf("socket.on('playerTradeSelection'");
  assert.ok(handlerStart >= 0, "playerTradeSelection handler exists");
  const handlerSlice = serverSrc.slice(
    handlerStart,
    handlerStart + 3500,
  );
  const completeBlock = handlerSlice.indexOf("if (allTradesComplete(room.gameState))");
  assert.ok(completeBlock >= 0, "allTradesComplete block in playerTradeSelection");
  const block = handlerSlice.slice(completeBlock, completeBlock + 600);
  const syncPos = block.indexOf("syncOpeningPlayerAfterTrades");
  const broadcastPos = block.indexOf("broadcastGameState");
  assert.ok(syncPos >= 0, "syncOpeningPlayerAfterTrades in trade-complete block");
  assert.ok(broadcastPos >= 0, "broadcastGameState in trade-complete block");
  assert.ok(
    syncPos < broadcastPos,
    "syncOpeningPlayerAfterTrades must run before broadcastGameState when trades complete",
  );
  console.log("PASS Test 3 — server trade-complete sync before broadcast");
}

// startNextRound: human instant-complete trades sync before broadcast.
{
  const fnStart = serverSrc.indexOf("function startNextRound");
  const fnEnd = serverSrc.indexOf("const app = express", fnStart);
  const fnBody = serverSrc.slice(fnStart, fnEnd);
  const elseIfSync = fnBody.indexOf("} else if (");
  const broadcastPos = fnBody.indexOf("broadcastGameState(io, room)");
  assert.ok(elseIfSync >= 0, "human instant trade sync else-if in startNextRound");
  const syncInElseIf = fnBody.indexOf(
    "syncOpeningPlayerAfterTrades(room.gameState, room.host)",
    elseIfSync,
  );
  assert.ok(
    syncInElseIf >= 0 && syncInElseIf < broadcastPos,
    "startNextRound syncs opener before broadcast when trades already complete",
  );
  console.log("PASS startNextRound — sync before broadcast for instant-complete trades");
}

console.log("Post-trade opener server ordering tests passed");
