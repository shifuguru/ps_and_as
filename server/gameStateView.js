/** Placeholder card — opponents only receive count, not faces. */
function hiddenCard() {
  return { suit: "spades", value: 0, hidden: true };
}

function isDeadHand(p) {
  return !!p?.isDeadHand || p?.id === "__dead_hand__";
}

function livingGamePlayers(state) {
  if (!state?.players) return [];
  return state.players.filter((p) => !isDeadHand(p));
}

function viewForPlayer(fullState, playerId) {
  if (!fullState || !Array.isArray(fullState.players)) return fullState;
  return {
    ...fullState,
    players: fullState.players.map((p) => ({
      ...p,
      sidelinedHand: isDeadHand(p)
        ? Array.from(
            { length: p.sidelinedHand?.length ?? 0 },
            () => hiddenCard(),
          )
        : p.sidelinedHand,
      hand:
        p.id === playerId
          ? p.hand
          : Array.from({ length: p.hand.length }, () => hiddenCard()),
    })),
  };
}

/** Whether a lobby member is an active player in the current round (not spectating). */
function memberInRound(state, member) {
  if (!member || member.isSpectator) return false;
  return livingGamePlayers(state).some((p) => p.id === member.id);
}

function viewForMember(state, member) {
  const inRound = memberInRound(state, member);
  const living = livingGamePlayers(state);
  const viewId = inRound ? member.id : living[0]?.id;
  return {
    gameState: viewId ? viewForPlayer(state, viewId) : state,
    spectator: !inRound,
  };
}

const { attachSyncMeta } = require("./gameSync");

function broadcastGameState(io, room) {
  const state = room.gameState;
  if (!state || !Array.isArray(state.players)) return;
  for (const member of room.players) {
    if (!member.socketId || member.disconnectedAt) continue;
    const { gameState, spectator } = viewForMember(state, member);
    io.to(member.socketId).emit("gameStateSync", {
      gameState: attachSyncMeta(room, gameState),
      spectator,
    });
  }
}

function syncPayloadForMember(room, member) {
  const state = room.gameState;
  if (!state || !Array.isArray(state.players)) return null;
  const { gameState, spectator } = viewForMember(state, member);
  return {
    gameState: attachSyncMeta(room, gameState),
    spectator,
  };
}

module.exports = {
  viewForPlayer,
  viewForMember,
  memberInRound,
  broadcastGameState,
  syncPayloadForMember,
};
