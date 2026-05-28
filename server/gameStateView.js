/** Placeholder card — opponents only receive count, not faces. */
function hiddenCard() {
  return { suit: "spades", value: 0, hidden: true };
}

function viewForPlayer(fullState, playerId) {
  if (!fullState || !Array.isArray(fullState.players)) return fullState;
  return {
    ...fullState,
    players: fullState.players.map((p) => ({
      ...p,
      hand:
        p.id === playerId
          ? p.hand
          : Array.from({ length: p.hand.length }, () => hiddenCard()),
    })),
  };
}

function broadcastGameState(io, room) {
  const state = room.gameState;
  if (!state || !Array.isArray(state.players)) return;
  for (const member of room.players) {
    if (!member.socketId) continue;
    io.to(member.socketId).emit("gameStateSync", {
      gameState: viewForPlayer(state, member.id),
    });
  }
}

module.exports = { viewForPlayer, broadcastGameState };
