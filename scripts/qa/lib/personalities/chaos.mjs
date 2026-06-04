/**
 * 🎲 Chaos — random timing and actions (exploration tester).
 */
import { createRequire } from "module";
import { qaLog } from "../botRoster.mjs";

const require = createRequire(import.meta.url);
const {
  findCPUPlay,
  canAcknowledgmentPass,
  tenRuleChooserIndex,
  isRoundCompleteForLiving,
} = require("../../../../server/gameBridge.js");

const PERSONALITY = "chaos";

/**
 * @param {object} gs
 * @param {string} playerId
 * @returns {import('../../../../src/game/core').Card[] | null}
 */
function pickPlay(gs, playerId) {
  const player = gs.players?.find((p) => p.id === playerId);
  if (!player?.hand?.length) return null;
  return findCPUPlay(
    player.hand,
    gs.pile ?? [],
    gs.tenRule,
    gs.pileHistory,
    gs.fourOfAKindChallenge,
    gs.currentTrick,
    gs.players,
    gs.finishedOrder,
    gs.trickHistory,
    gs.lastRoundOrder,
    playerId,
    !!gs.runOnTop?.active,
  );
}

/**
 * @param {object} opts
 * @param {{ gameState: object | null, profileId: string, roomId: string, isSpectator: boolean, socket: import('socket.io-client').Socket }} opts.client
 * @param {import('../CoverageTracker.mjs').CoverageTracker} [opts.tracker]
 */
/**
 * @param {object} opts
 * @param {number} [opts.minDelayMs]
 * @param {number} [opts.maxDelayMs]
 */
export function createChaosDriver({ client, tracker, minDelayMs = 150, maxDelayMs = 2000 }) {
  let lastActionAt = 0;

  return async function chaosTick() {
    const gs = client.gameState;
    if (!gs) return;

    const me = client.profileId;
    const now = Date.now();
    const span = Math.max(0, maxDelayMs - minDelayMs);
    const delay = minDelayMs + Math.floor(Math.random() * (span + 1));
    if (now - lastActionAt < delay) return;

    if (isRoundCompleteForLiving(gs) && !gs.tenRulePending) {
      if (Math.random() < 0.4) {
        client.socket.emit("playerReadyForNextRound", {
          roomId: client.roomId,
        });
        qaLog(PERSONALITY, "Ready at rankings");
        tracker?.bump("rankings_ready");
        lastActionAt = now;
      }
      return;
    }

    if (client.isSpectator) {
      if (Math.random() < 0.12) {
        client.socket.emit("playerReadyForNextRound", {
          roomId: client.roomId,
        });
        qaLog(PERSONALITY, "Spectator ready toggle");
        tracker?.bump("ready_toggle");
        lastActionAt = now;
      }
      return;
    }

    const player = gs.players?.find((p) => p.id === me);
    if (!player) return;

    if (gs.tenRulePending) {
      const chooserIdx = tenRuleChooserIndex(gs);
      const chooser = chooserIdx != null ? gs.players[chooserIdx] : null;
      if (chooser?.id === me) {
        const direction = Math.random() < 0.5 ? "higher" : "lower";
        client.socket.emit("gameAction", {
          roomId: client.roomId,
          action: { type: "tenRule", direction },
        });
        qaLog(PERSONALITY, `10-rule → ${direction}`);
        tracker?.bump("ten_rule");
        lastActionAt = now;
      }
      return;
    }

    const current = gs.players?.[gs.currentPlayerIndex];
    const isMyTurn = current?.id === me;
    const ackPass = canAcknowledgmentPass(gs, me);

    if (!isMyTurn && !ackPass) {
      if (Math.random() < 0.06) {
        client.socket.emit("gameAction", {
          roomId: client.roomId,
          action: { type: "pass" },
        });
        qaLog(PERSONALITY, "Probe pass (not my turn)");
        tracker?.bump("duplicate_actions");
        lastActionAt = now;
      }
      return;
    }

    if (Math.random() < 0.42) {
      client.socket.emit("gameAction", {
        roomId: client.roomId,
        action: { type: "pass" },
      });
      qaLog(PERSONALITY, "Pass");
      lastActionAt = now;
      return;
    }

    const cards = pickPlay(gs, me);
    if (cards?.length) {
      client.socket.emit("gameAction", {
        roomId: client.roomId,
        action: { type: "play", cards },
      });
      qaLog(PERSONALITY, `Play ${cards.length} card(s)`);
      lastActionAt = now;
      return;
    }

    if (Math.random() < 0.55) {
      client.socket.emit("gameAction", {
        roomId: client.roomId,
        action: { type: "pass" },
      });
      qaLog(PERSONALITY, "Pass (no legal play found)");
      lastActionAt = now;
    }
  };
}
