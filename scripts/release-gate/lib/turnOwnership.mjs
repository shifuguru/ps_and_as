/**
 * Live gameState assertions for release gate socket tests.
 */
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const {
  isPlayerStillIn,
  hasPassedInCurrentTrick,
  playerCanActInCurrentTrick,
} = require("../../../server/gameBridge.js");

const DEAD_HAND_ID = "__dead_hand__";

export function assertCurrentPlayerMayAct(gs, label = "turn ownership") {
  if (!gs?.players?.length) {
    throw new Error(`${label}: missing players`);
  }
  const idx = gs.currentPlayerIndex;
  const current = gs.players[idx];
  if (!current) {
    throw new Error(`${label}: no player at currentPlayerIndex ${idx}`);
  }

  if (current.isDeadHand || current.id === DEAD_HAND_ID) {
    throw new Error(`${label}: turn on dead-hand seat (${current.id})`);
  }

  if (!isPlayerStillIn(gs, current.id)) {
    throw new Error(`${label}: turn on out player (${current.name ?? current.id})`);
  }

  if (
    gs.currentTrick?.actions?.length &&
    hasPassedInCurrentTrick(gs, current.id) &&
    !playerCanActInCurrentTrick(gs, idx)
  ) {
    throw new Error(
      `${label}: turn on player who already passed this trick (${current.name ?? current.id})`,
    );
  }
}

export function scanTurnOwnership(gs, label = "turn ownership") {
  assertCurrentPlayerMayAct(gs, label);
}
