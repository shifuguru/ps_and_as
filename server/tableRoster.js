/**
 * Single source for table seat order, dead-hand claim, and deal roster building.
 */

const { isDeadHandPlayer } = require("./gameBridge");

const DEAD_HAND_ID = "__dead_hand__";
const CPU_LOBBY_ID_RE = /^cpu-\d+$/i;

function isCpuLobbyId(id) {
  return CPU_LOBBY_ID_RE.test(String(id || "").trim());
}

function isBotMember(player) {
  return !!(player && (player.isBot || isCpuLobbyId(player.id)));
}

function countHumansSeated(room) {
  return room.players.filter(
    (p) => !p.disconnectedAt && !p.isSpectator && !isBotMember(p),
  ).length;
}

function gameHasDeadHandSlot(room) {
  return !!(
    room?.deadHand ||
    room?.gameState?.players?.some(
      (p) => p.isDeadHand || p.id === DEAD_HAND_ID,
    )
  );
}

/** Preserve ring seat order when mapping lobby members onto the next deal. */
function buildLobbyPlayersForAuthoritativeRound(room) {
  const seated = room.players.filter(
    (p) => !p.disconnectedAt && !p.isSpectator,
  );
  const prev = room.gameState?.players;
  if (!prev?.length) {
    return seated.map((p) => ({ id: p.id, name: p.name }));
  }

  const seatedById = new Map(seated.map((p) => [p.id, p]));
  const ordered = [];

  for (const gp of prev) {
    if (isDeadHandPlayer(gp)) {
      const human = seated.find(
        (p) => !isCpuLobbyId(p.id) && !ordered.some((o) => o.id === p.id),
      );
      if (human) {
        ordered.push({ id: human.id, name: human.name });
      }
      continue;
    }
    const member = seatedById.get(gp.id);
    if (member) {
      ordered.push({ id: member.id, name: member.name });
    }
  }

  for (const p of seated) {
    if (!ordered.some((o) => o.id === p.id)) {
      ordered.push({ id: p.id, name: p.name });
    }
  }

  return ordered.length > 0
    ? ordered
    : seated.map((p) => ({ id: p.id, name: p.name }));
}

function shouldUseDeadHandForDeal(room) {
  const seated = room.players.filter(
    (p) => !p.disconnectedAt && !p.isSpectator,
  );
  const humanCount = seated.filter((p) => !isCpuLobbyId(p.id)).length;
  const botCount = seated.filter((p) => isCpuLobbyId(p.id)).length;
  if (room.isBotHosted) {
    return botCount === 2 && humanCount === 0;
  }
  return seated.length === 2;
}

/**
 * Swap the dead-hand seat for a promoted human in the live between-rounds state.
 */
function replaceDeadHandInGameState(room, human) {
  const gs = room.gameState;
  if (!gs?.players || !human) return false;

  const deadIdx = gs.players.findIndex(
    (p) => p.isDeadHand || p.id === DEAD_HAND_ID,
  );
  if (deadIdx < 0) return false;

  const dead = gs.players[deadIdx];
  const inheritedHand = [
    ...(dead.hand ?? []),
    ...(dead.sidelinedHand ?? []),
  ];

  gs.players[deadIdx] = {
    id: human.id,
    name: human.name,
    hand: inheritedHand,
    role: dead.role && dead.role !== "Neutral" ? dead.role : "Neutral",
    isDeadHand: false,
  };

  const remapId = (id) =>
    id === DEAD_HAND_ID || id === dead.id ? human.id : id;

  if (Array.isArray(gs.finishedOrder)) {
    gs.finishedOrder = gs.finishedOrder.map(remapId);
  }
  if (Array.isArray(gs.lastRoundOrder)) {
    gs.lastRoundOrder = gs.lastRoundOrder.map(remapId);
  }
  if (gs.currentTrick?.actions) {
    for (const action of gs.currentTrick.actions) {
      if (action.playerId === DEAD_HAND_ID || action.playerId === dead.id) {
        action.playerId = human.id;
        if (action.playerName) action.playerName = human.name;
      }
    }
  }
  if (gs.playerHands) {
    if (gs.playerHands[DEAD_HAND_ID]) {
      gs.playerHands[human.id] = gs.playerHands[DEAD_HAND_ID];
      delete gs.playerHands[DEAD_HAND_ID];
    }
    if (dead.id && gs.playerHands[dead.id]) {
      gs.playerHands[human.id] = gs.playerHands[dead.id];
      delete gs.playerHands[dead.id];
    }
  }
  if (gs.roles) {
    if (gs.roles[DEAD_HAND_ID]) {
      gs.roles[human.id] = gs.roles[DEAD_HAND_ID];
      delete gs.roles[DEAD_HAND_ID];
    }
    if (dead.id && gs.roles[dead.id]) {
      gs.roles[human.id] = gs.roles[dead.id];
      delete gs.roles[dead.id];
    }
  }

  const ready = gs.readyForNextRound || {};
  if (ready[DEAD_HAND_ID] !== undefined) {
    ready[human.id] = ready[DEAD_HAND_ID];
    delete ready[DEAD_HAND_ID];
  }
  if (dead.id && ready[dead.id] !== undefined) {
    ready[human.id] = ready[dead.id];
    delete ready[dead.id];
  }

  if (gs.currentPlayerIndex === deadIdx) {
    gs.currentPlayerIndex = deadIdx;
  }
  if (gs.lastPlayPlayerIndex === deadIdx) {
    gs.lastPlayPlayerIndex = deadIdx;
  }

  room.deadHand = false;
  return true;
}

/** Promote one ready spectator into the dead-hand chair (human lobbies). */
function claimDeadHandForReadySpectator(room) {
  const readyMap = room.gameState?.readyForNextRound || {};
  const spectator = room.players.find(
    (p) => p.isSpectator && !p.disconnectedAt && readyMap[p.id] === true,
  );
  if (!spectator) return null;
  spectator.isSpectator = false;
  console.log(
    `[Server] ${spectator.name} is replacing the dead hand next round`,
  );
  replaceDeadHandInGameState(room, spectator);
  return spectator;
}

function shouldClaimDeadHandAtBotTable(room, readySpectators) {
  if (!room?.isBotHosted || readySpectators.length === 0) return false;
  if (countHumansSeated(room) > 0) return false;
  const botsAtTable = room.players.filter(
    (p) => isBotMember(p) && !p.isSpectator && !p.disconnectedAt,
  ).length;
  return (
    gameHasDeadHandSlot(room) || !!room.deadHand || botsAtTable >= 2
  );
}

module.exports = {
  DEAD_HAND_ID,
  isCpuLobbyId,
  isBotMember,
  countHumansSeated,
  gameHasDeadHandSlot,
  buildLobbyPlayersForAuthoritativeRound,
  shouldUseDeadHandForDeal,
  replaceDeadHandInGameState,
  claimDeadHandForReadySpectator,
  shouldClaimDeadHandAtBotTable,
};
