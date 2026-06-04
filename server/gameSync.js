/**
 * Authoritative sync metadata — phase + monotonic state version on every snapshot.
 */

const { isDeadHandPlayer } = require("./gameBridge");

function pendingTradesIncomplete(state) {
  const pending = state?.pendingTrades;
  if (!pending) return false;
  const keys = Object.keys(pending);
  if (keys.length === 0) return false;
  return keys.some((k) => !pending[k]?.selected);
}

function livingPlayers(state) {
  return (state?.players || []).filter((p) => !isDeadHandPlayer(p));
}

function isRoundCompleteState(state) {
  const living = livingPlayers(state);
  if (living.length === 0) return false;
  const finished = state.finishedOrder || [];
  return living.every((p) => finished.includes(p.id));
}

/** Coarse phase for client UI — avoids re-deriving from ambiguous snapshots. */
function resolveGamePhase(room) {
  if (!room?.inGame || !room.gameState) return "LOBBY";
  const gs = room.gameState;
  if (pendingTradesIncomplete(gs)) {
    return "TRADES";
  }
  if (isRoundCompleteState(gs) && !gs.tenRulePending) {
    return "ROUND_COMPLETE";
  }
  const living = livingPlayers(gs);
  const anyHand = living.some((p) => (p.hand?.length ?? 0) > 0);
  const anyPlay =
    (gs.pile?.length ?? 0) > 0 ||
    (gs.currentTrick?.actions?.length ?? 0) > 0 ||
    (gs.trickHistory?.length ?? 0) > 0;
  if (!anyHand && !anyPlay && !gs.tenRulePending) {
    return "DEALING";
  }
  return "PLAYING";
}

function bumpStateVersion(room) {
  room.stateVersion = (room.stateVersion || 0) + 1;
}

function attachSyncMeta(room, gameState) {
  if (!gameState || typeof gameState !== "object") return gameState;
  return {
    ...gameState,
    stateVersion: room.stateVersion || 0,
    phase: resolveGamePhase(room),
  };
}

module.exports = {
  resolveGamePhase,
  bumpStateVersion,
  attachSyncMeta,
  pendingTradesIncomplete,
  isRoundCompleteState,
};
