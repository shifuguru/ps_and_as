/** Remap a seat index after splicing `removedIdx` out of the players array. */
function adjustSeatIndexAfterRemoval(index, removedIdx) {
  if (typeof index !== 'number' || index < 0) return index;
  if (index === removedIdx) return null;
  if (index > removedIdx) return index - 1;
  return index;
}

/**
 * After a seat is spliced out, recompute the trick-leader seat index.
 * When the removed seat was the leader, never trust the stale numeric
 * lastPlayPlayerIndex — it aliases a surviving player after the splice.
 * Resolve from the latest play action whose playerId is still seated.
 */
function lastPlayIndexAfterRemoval(gs, removedIdx, wasLeader) {
  if (!wasLeader) {
    const remapped = adjustSeatIndexAfterRemoval(gs?.lastPlayPlayerIndex, removedIdx);
    return remapped === null || remapped === undefined ? null : remapped;
  }
  const actions = gs?.currentTrick?.actions;
  const players = gs?.players;
  if (!Array.isArray(actions) || !Array.isArray(players) || actions.length === 0) {
    return null;
  }
  const lastLivingPlay = [...actions]
    .reverse()
    .find(
      (a) =>
        a?.type === 'play' &&
        players.some((p) => p.id === a.playerId),
    );
  if (!lastLivingPlay) return null;
  const idx = players.findIndex((p) => p.id === lastLivingPlay.playerId);
  return idx >= 0 ? idx : null;
}

module.exports = {
  adjustSeatIndexAfterRemoval,
  lastPlayIndexAfterRemoval,
};
