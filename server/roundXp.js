/**
 * Authoritative round XP totals for scoreboard (matches client trick-win rules).
 */

const {
  runLengthFromCompletedTrick,
  runTrickBonusXpAmount,
  isDeadHandPlayer,
} = require("./gameBridge");

const TRICK_WIN_XP = 15;
const RUN_CARD_XP = 5;

function computeRoundXpByPlayerId(gameState) {
  const out = {};
  if (!gameState?.players) return out;

  for (const p of gameState.players) {
    if (!isDeadHandPlayer(p)) out[p.id] = 0;
  }

  for (const trick of gameState.trickHistory || []) {
    let winnerId = trick.winnerId;
    if (!winnerId && trick.winnerName) {
      const byName = gameState.players.find((p) => p.name === trick.winnerName);
      winnerId = byName?.id;
    }
    if (!winnerId || out[winnerId] == null) continue;

    const runLength = runLengthFromCompletedTrick(
      trick,
      gameState.players,
      gameState.finishedOrder || [],
    );
    const trickXp =
      TRICK_WIN_XP + runTrickBonusXpAmount(runLength, RUN_CARD_XP);
    out[winnerId] += trickXp;
  }

  return out;
}

module.exports = {
  TRICK_WIN_XP,
  RUN_CARD_XP,
  computeRoundXpByPlayerId,
};
