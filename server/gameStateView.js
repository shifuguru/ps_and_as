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
  const ownHands =
    fullState.playerHands && fullState.playerHands[playerId] !== undefined
      ? { [playerId]: fullState.playerHands[playerId] }
      : undefined;
  const { dealSeed: _dealSeed, playerHands: _playerHands, ...rest } = fullState;
  return {
    ...rest,
    // Never broadcast the deal seed — clients must not reconstruct opponent hands.
    // Never leak the full playerHands map — same confidentiality as tradesComplete.
    ...(ownHands ? { playerHands: ownHands } : {}),
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
  if (!inRound) {
    // Spectators must not receive any real hand faces. Using a non-matching
    // view id masks every seat via viewForPlayer (length-only placeholders).
    return {
      gameState: viewForPlayer(state, '__spectator__'),
      spectator: true,
    };
  }
  return {
    gameState: viewForPlayer(state, member.id),
    spectator: false,
  };
}

const { attachSyncMeta, bumpStateVersion } = require("./gameSync");
const botHosted = require("./botHostedRooms");

function syncEnvelope(room, gameState, spectator) {
  return {
    gameState: attachSyncMeta(room, gameState),
    spectator,
    ...botHosted.botNextRoundSyncFields(room),
  };
}

function broadcastGameState(io, room) {
  const state = room.gameState;
  if (!state || !Array.isArray(state.players)) return;
  bumpStateVersion(room);
  for (const member of room.players) {
    if (!member.socketId || member.disconnectedAt) continue;
    const { gameState, spectator } = viewForMember(state, member);
    io.to(member.socketId).emit("gameStateSync", syncEnvelope(room, gameState, spectator));
  }
}

function syncPayloadForMember(room, member) {
  const state = room.gameState;
  if (!state || !Array.isArray(state.players)) return null;
  bumpStateVersion(room);
  const { gameState, spectator } = viewForMember(state, member);
  return syncEnvelope(room, gameState, spectator);
}

/**
 * Emit a per-recipient hand-confidential event (tradesComplete / playerHandsUpdate).
 *
 * Security contract:
 *   - Seated, connected players receive only their own entry from playerHands.
 *   - Spectators and disconnected members receive playerHands: {}.
 *   - The authoritative playerHands object on the server is never mutated.
 *
 * @param {import("socket.io").Server} io
 * @param {object} room  - server room object with room.players array
 * @param {string} eventName  - "tradesComplete" or "playerHandsUpdate"
 * @param {Record<string, object[]>} playerHands  - full server-side hands map
 * @param {object} [extra]  - additional fields to merge into each payload
 */
function emitPlayerHandsPerRecipient(io, room, eventName, playerHands, extra) {
  for (const member of room.players) {
    if (!member.socketId || member.disconnectedAt) continue;
    const inRound = memberInRound(room.gameState, member);
    const ownHand =
      inRound && playerHands && playerHands[member.id] !== undefined
        ? { [member.id]: playerHands[member.id] }
        : {};
    io.to(member.socketId).emit(eventName, { ...extra, playerHands: ownHand });
  }
}

module.exports = {
  viewForPlayer,
  viewForMember,
  memberInRound,
  broadcastGameState,
  syncPayloadForMember,
  emitPlayerHandsPerRecipient,
};
