/**
 * Shared inactive-seat advancement for human rooms and bot tables.
 */

const {
  passTurn,
  isDeadHandPlayer,
  isPlayerStillIn,
  hasPassedInCurrentTrick,
  isTrickAcknowledgmentPassPhase,
  isJokerAcknowledgmentPassPhase,
  canAcknowledgmentPass,
  isTrickOpeningLead,
  nextActivePlayerIndex,
  nextAcknowledgmentPlayerIndex,
  resolveCompletedAcknowledgmentTrick,
  advanceOffPriorPasser,
  repairStuckTurnPointer,
} = require("./gameBridge");
const { isCpuLobbyId } = require("./tableRoster");

const JOKER_ACK_AUTO_PASS_MS = 3000;

function clearJokerAckAutoPassTimer(room) {
  if (room?._jokerAckAutoPassTimer) {
    clearTimeout(room._jokerAckAutoPassTimer);
    room._jokerAckAutoPassTimer = null;
  }
}

function applyPendingJokerAckAutoPasses(room, cloneGameState) {
  const gs = room?.gameState;
  if (!gs || !isJokerAcknowledgmentPassPhase(gs)) return false;

  let working = cloneGameState(gs);
  let changed = false;
  let safety = gs.players.length + 2;

  while (safety-- > 0) {
    let progressed = false;
    for (const p of working.players) {
      if (!canAcknowledgmentPass(working, p.id)) continue;
      const next = passTurn(working, p.id);
      if (next === working) continue;
      working = next;
      changed = true;
      progressed = true;
      break;
    }
    if (!progressed) break;
    if (!isJokerAcknowledgmentPassPhase(working)) break;
  }

  if (!changed) return false;
  room.gameState = cloneGameState(working);
  advancePastInactiveSeats(room, cloneGameState);
  room.gameState = cloneGameState(repairStuckTurnPointer(room.gameState));
  return true;
}

/**
 * Start or maintain the joker-ack auto-pass deadline for seated humans who
 * have not pressed Pass. Clears when the acknowledgment phase ends.
 */
function syncJokerAckAutoPassTimer(room, onAutoPassApplied) {
  if (!room?.gameState || !isJokerAcknowledgmentPassPhase(room.gameState)) {
    clearJokerAckAutoPassTimer(room);
    room._jokerAckDeadline = null;
    return;
  }

  const now = Date.now();
  if (room._jokerAckDeadline == null) {
    room._jokerAckDeadline = now + JOKER_ACK_AUTO_PASS_MS;
  }

  clearJokerAckAutoPassTimer(room);
  const remaining = room._jokerAckDeadline - now;
  const fire = () => {
    room._jokerAckAutoPassTimer = null;
    room._jokerAckDeadline = null;
    if (!room.gameState || !isJokerAcknowledgmentPassPhase(room.gameState)) return;
    if (applyPendingJokerAckAutoPasses(room, onAutoPassApplied.cloneGameState)) {
      onAutoPassApplied.afterStateChange(room);
    }
  };

  if (remaining <= 0) {
    fire();
    return;
  }

  room._jokerAckAutoPassTimer = setTimeout(fire, remaining);
}

function advancePastInactiveSeats(room, cloneGameState) {
  const gs = room?.gameState;
  if (!gs?.players) return;
  let working = cloneGameState(gs);
  let safety = gs.players.length + 4;
  while (safety-- > 0) {
    const current = working.players[working.currentPlayerIndex];
    if (!current) break;
    const ackLeaderWait =
      isTrickAcknowledgmentPassPhase(working) &&
      working.lastPlayPlayerIndex === working.currentPlayerIndex;
    const runOnTopTurn =
      working.runOnTop?.active &&
      working.runOnTop.playerIndex === working.currentPlayerIndex;
    const mustOpenTrick =
      working.mustPlay && isTrickOpeningLead(working);
    const botEvicted =
      room.isBotHosted &&
      isCpuLobbyId(current.id) &&
      !room.players.some(
        (p) =>
          p.id === current.id && !p.isSpectator && !p.disconnectedAt,
      );
    const inactive =
      isDeadHandPlayer(current) ||
      botEvicted ||
      !isPlayerStillIn(working, current.id) ||
      (hasPassedInCurrentTrick(working, current.id) && !runOnTopTurn) ||
      ackLeaderWait;
    if (!inactive) break;
    if (mustOpenTrick && isDeadHandPlayer(current)) {
      working.currentPlayerIndex = nextActivePlayerIndex(
        working,
        working.currentPlayerIndex,
      );
      continue;
    }
    if (mustOpenTrick) break;
    if (ackLeaderWait) {
      working.currentPlayerIndex = nextActivePlayerIndex(
        working,
        working.currentPlayerIndex,
      );
      continue;
    }
    if (
      hasPassedInCurrentTrick(working, current.id) &&
      isTrickAcknowledgmentPassPhase(working) &&
      !runOnTopTurn
    ) {
      const pileUp = working.pile.length > 0;
      let resolved = resolveCompletedAcknowledgmentTrick(working);
      if (pileUp && resolved.pile.length === 0) {
        working = resolved;
        continue;
      }
      const nextIdx = nextAcknowledgmentPlayerIndex(
        working,
        working.currentPlayerIndex,
      );
      if (nextIdx !== working.currentPlayerIndex) {
        working.currentPlayerIndex = nextIdx;
        continue;
      }
      resolved = resolveCompletedAcknowledgmentTrick(working);
      if (pileUp && resolved.pile.length === 0) {
        working = resolved;
        continue;
      }
      break;
    }
    if (hasPassedInCurrentTrick(working, current.id) && !runOnTopTurn) {
      const prev = working.currentPlayerIndex;
      const trickLenBefore = working.trickHistory?.length ?? 0;
      const pileLenBefore = working.pile.length;
      working = cloneGameState(advanceOffPriorPasser(working));
      if (
        working.currentPlayerIndex !== prev ||
        (working.trickHistory?.length ?? 0) !== trickLenBefore ||
        working.pile.length !== pileLenBefore
      ) {
        continue;
      }
      const forced = nextActivePlayerIndex(working, prev);
      if (forced !== prev) {
        working.currentPlayerIndex = forced;
        continue;
      }
      break;
    }
    const next = passTurn(working, current.id);
    if (next === working) break;
    working = next;
  }
  room.gameState = cloneGameState(working);
}

module.exports = {
  advancePastInactiveSeats,
  syncJokerAckAutoPassTimer,
  clearJokerAckAutoPassTimer,
  JOKER_ACK_AUTO_PASS_MS,
};
