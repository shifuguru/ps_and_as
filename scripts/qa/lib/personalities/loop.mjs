/**
 * 🔄 Loop — ready / rankings transition stress.
 */
import { createRequire } from "module";
import { qaLog } from "../botRoster.mjs";

const require = createRequire(import.meta.url);
const { isRoundCompleteForLiving } = require("../../../../server/gameBridge.js");

const PERSONALITY = "ready_spam";

/**
 * @param {object} opts
 * @param {{ gameState: object | null, profileId: string, roomId: string, isSpectator: boolean, socket: import('socket.io-client').Socket }} opts.client
 * @param {import('../CoverageTracker.mjs').CoverageTracker} [opts.tracker]
 */
export function createLoopDriver({ client, tracker }) {
  let lastReadyAt = 0;

  return async function loopTick() {
    const gs = client.gameState;
    if (!gs) return;

    const now = Date.now();
    if (now - lastReadyAt < 400) return;

    const roundDone =
      isRoundCompleteForLiving(gs) && !gs.tenRulePending;

    if (roundDone || client.isSpectator) {
      if (Math.random() < 0.55) {
        client.socket.emit("playerReadyForNextRound", {
          roomId: client.roomId,
        });
        qaLog(PERSONALITY, roundDone ? "Ready toggle (rankings)" : "Spectator ready");
        tracker?.bump("ready_toggle");
        if (roundDone) tracker?.bump("rankings_ready");
        lastReadyAt = now;
      }
    }
  };
}
