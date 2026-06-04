/**
 * 🔨 Breaker — validation / duplicate-action stress.
 */
import { createRequire } from "module";
import { qaLog } from "../botRoster.mjs";
import { createChaosDriver } from "./chaos.mjs";

const require = createRequire(import.meta.url);
const { canAcknowledgmentPass } = require("../../../../server/gameBridge.js");

const PERSONALITY = "exploit";

/**
 * @param {object} opts
 */
export function createBreakerDriver(opts) {
  const { client, tracker } = opts;
  const chaos = createChaosDriver({ ...opts, minDelayMs: 200, maxDelayMs: 800 });
  let lastBurstAt = 0;

  return async function breakerTick() {
    const gs = client.gameState;
    const me = client.profileId;
    const now = Date.now();

    if (gs && now - lastBurstAt > 2500) {
      const current = gs.players?.[gs.currentPlayerIndex];
      const isMyTurn = current?.id === me;
      const ackPass = canAcknowledgmentPass(gs, me);
      if (!isMyTurn && !ackPass) {
        for (let i = 0; i < 3; i++) {
          client.socket.emit("gameAction", {
            roomId: client.roomId,
            action: { type: "pass" },
          });
        }
        qaLog(PERSONALITY, "Duplicate pass burst");
        tracker?.bump("duplicate_actions");
        lastBurstAt = now;
      }
    }

    await chaos();
  };
}
