/**
 * True when the deal is still pre-play (opening lead not yet taken).
 * Used to gate round-1 dealerReshuffle — after any play, living hands may no
 * longer hold a 3 and needsRoundOneDealerReshuffle can falsely flip true.
 */
function isPrePlayDealWindow(state) {
  if (!state) return false;
  if (state.tenRulePending) return false;
  if ((state.pile?.length ?? 0) > 0) return false;
  if ((state.currentTrick?.actions?.length ?? 0) > 0) return false;
  if ((state.trickHistory?.length ?? 0) > 0) return false;
  if ((state.pileHistory?.length ?? 0) > 0) return false;
  if ((state.finishedOrder?.length ?? 0) > 0) return false;
  return true;
}

module.exports = {
  isPrePlayDealWindow,
};
