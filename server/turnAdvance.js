/**
 * Shared inactive-seat advancement for human rooms and bot tables.
 */

const {
  passTurn,
  isDeadHandPlayer,
  isPlayerStillIn,
  hasPassedInCurrentTrick,
  isTrickAcknowledgmentPassPhase,
  isTrickOpeningLead,
  nextActivePlayerIndex,
  nextAcknowledgmentPlayerIndex,
  resolveCompletedAcknowledgmentTrick,
  advanceOffPriorPasser,
} = require("./gameBridge");
const { isCpuLobbyId } = require("./tableRoster");

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
};
