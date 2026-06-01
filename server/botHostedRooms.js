/**
 * Persistent bot-hosted public tables — shown on Find Game when no human lobbies exist.
 * Humans join in-progress games as spectators and can claim the open seat next round.
 */

const {
  applyCpuTurn,
  setTenRuleDirection,
  tenRuleChooserIndex,
  canAcknowledgmentPass,
  passTurn,
  isDeadHandPlayer,
} = require('./gameBridge');

const BOT_ROOM_CODE = 'BOTOPN';
const BOT_TURN_DELAY_MS = 900;
const BOT_NAMES = ['Amy', 'Ben'];

const CPU_ID_RE = /^cpu-\d+$/i;

function isBotPlayerId(id) {
  return !!(id && CPU_ID_RE.test(String(id).trim()));
}

function isBotMember(player) {
  return !!(player && (player.isBot || isBotPlayerId(player.id)));
}

function isHumanMember(player) {
  return !!(player && !player.disconnectedAt && !player.isSpectator && !isBotMember(player));
}

function hasHumanPublicLobbies(rooms, isRoomListedPublic) {
  return Object.values(rooms).some(
    (room) => room.isPublic && !room.isBotHosted && isRoomListedPublic(room),
  );
}

function shouldListBotRoom(rooms, room, isRoomListedPublic) {
  if (!room?.isBotHosted) return false;
  if (hasHumanPublicLobbies(rooms, isRoomListedPublic)) return false;
  return isRoomListedPublic(room);
}

function discoverRoomFilter(rooms, room, isRoomListedPublic, activePlayerCount, isRoundInProgress) {
  if (room.isBotHosted) {
    return shouldListBotRoom(rooms, room, isRoomListedPublic);
  }
  if (!isRoomListedPublic(room)) return false;
  if (room.inGame && isRoundInProgress(room)) return true;
  return activePlayerCount(room) < 8;
}

function createBotMembers() {
  return [
    {
      id: 'cpu-1',
      profileId: 'cpu-1',
      name: BOT_NAMES[0],
      isBot: true,
      ready: true,
      socketId: null,
      disconnectedAt: null,
      isSpectator: false,
    },
    {
      id: 'cpu-2',
      profileId: 'cpu-2',
      name: BOT_NAMES[1],
      isBot: true,
      ready: true,
      socketId: null,
      disconnectedAt: null,
      isSpectator: false,
    },
  ];
}

function createBotHostedRoom(rooms) {
  if (rooms[BOT_ROOM_CODE]) return rooms[BOT_ROOM_CODE];

  const room = {
    players: createBotMembers(),
    host: 'cpu-1',
    creatorId: 'cpu-1',
    hostName: BOT_NAMES[0],
    roomName: 'Open Bot Table',
    createdAt: Date.now(),
    isPublic: true,
    isBotHosted: true,
    deadHand: true,
    skipDealAnimations: true,
    gameState: null,
    inGame: false,
  };
  rooms[BOT_ROOM_CODE] = room;
  console.log(`[Server] Created bot-hosted room ${BOT_ROOM_CODE}`);
  return room;
}

function autoReadyBotsForNextRound(room) {
  if (!room?.isBotHosted || !room.gameState) return;
  room.gameState.readyForNextRound = room.gameState.readyForNextRound || {};
  for (const p of room.players) {
    if (isBotMember(p) && !p.isSpectator && !p.disconnectedAt) {
      room.gameState.readyForNextRound[p.id] = true;
    }
  }
}

function resolveBotPendingTrades(room, ctx) {
  const gs = room.gameState;
  if (!gs?.pendingTrades) return false;
  const pendingKeys = Object.keys(gs.pendingTrades);
  if (pendingKeys.length === 0 || ctx.allTradesComplete(gs)) return false;

  const playerHands = gs.playerHands || ctx.snapshotPlayerHands(gs);
  gs.playerHands = playerHands;
  ctx.finalizePendingTrades(gs, playerHands);
  for (const p of gs.players || []) {
    if (playerHands[p.id]) p.hand = [...playerHands[p.id]];
  }
  return ctx.allTradesComplete(gs);
}

function applyBotTenRuleIfNeeded(room, ctx) {
  const gs = room.gameState;
  if (!gs?.tenRulePending) return false;

  const chooserIdx = tenRuleChooserIndex(gs);
  if (chooserIdx == null || chooserIdx < 0) return false;

  const chooser = gs.players[chooserIdx];
  if (!chooser || !isBotPlayerId(chooser.id) || isDeadHandPlayer(chooser)) return false;

  const direction = Math.random() < 0.5 ? 'higher' : 'lower';
  room.gameState = ctx.cloneGameState(setTenRuleDirection(gs, direction));
  return true;
}

function applyBotAckPasses(room, ctx) {
  const gs = room.gameState;
  if (!gs) return false;

  let working = ctx.cloneGameState(gs);
  let changed = false;

  for (const p of working.players) {
    if (!isBotPlayerId(p.id) || isDeadHandPlayer(p)) continue;
    if (!canAcknowledgmentPass(working, p.id)) continue;
    const next = passTurn(working, p.id);
    if (next !== working) {
      working = next;
      changed = true;
    }
  }

  if (changed) {
    room.gameState = ctx.cloneGameState(working);
  }
  return changed;
}

function processBotTurnStep(room, ctx) {
  if (!room?.isBotHosted || !room.inGame || !room.gameState) return false;
  if (ctx.isGamePausedForAway(room)) return false;

  if (resolveBotPendingTrades(room, ctx)) {
    ctx.emitTradesCompleteIfReady(ctx.io, ctx.roomId, room.gameState, room.host);
  }

  if (applyBotTenRuleIfNeeded(room, ctx)) {
    ctx.advancePastInactiveSeats(room);
    ctx.broadcastGameState(ctx.io, room);
    if (ctx.isRoundComplete(room.gameState) && !room.gameState.tenRulePending) {
      ctx.onRoundComplete(ctx.roomId, room);
    }
    return true;
  }

  if (applyBotAckPasses(room, ctx)) {
    ctx.advancePastInactiveSeats(room);
    ctx.broadcastGameState(ctx.io, room);
    return true;
  }

  const gs = room.gameState;
  const current = gs.players[gs.currentPlayerIndex];
  if (!current || !isBotPlayerId(current.id) || isDeadHandPlayer(current)) {
    return false;
  }

  const before = ctx.cloneGameState(gs);
  let next = applyCpuTurn(before, current.id);
  if (next === before) return false;

  room.gameState = ctx.cloneGameState(next);
  room.gameState.readyForNextRound = room.gameState.readyForNextRound || {};
  ctx.advancePastInactiveSeats(room);
  ctx.broadcastGameState(ctx.io, room);

  if (ctx.isRoundComplete(room.gameState) && !room.gameState.tenRulePending) {
    ctx.onRoundComplete(ctx.roomId, room);
  }
  return true;
}

function scheduleBotTurns(roomId, ctx) {
  const room = ctx.rooms[roomId];
  if (!room?.isBotHosted || !room.inGame) return;
  if (room._botTurnTimer) return;

  room._botTurnTimer = setTimeout(() => {
    room._botTurnTimer = null;
    runBotTurnLoop(roomId, ctx);
  }, BOT_TURN_DELAY_MS);
}

function runBotTurnLoop(roomId, ctx) {
  const room = ctx.rooms[roomId];
  if (!room?.isBotHosted || !room.inGame || !room.gameState) return;
  if (ctx.isGamePausedForAway(room)) return;

  let safety = 40;
  const step = () => {
    if (safety-- <= 0) return;
    if (!ctx.rooms[roomId]?.inGame) return;

    const acted = processBotTurnStep(room, ctx);
    if (!acted) return;

    room._botTurnTimer = setTimeout(step, BOT_TURN_DELAY_MS);
  };

  step();
}

function startBotHostedGame(roomId, ctx) {
  const room = ctx.rooms[roomId];
  if (!room?.isBotHosted || room.inGame) return;

  try {
    const dealSeed = Math.floor(Math.random() * 2147483647);
    ctx.beginAuthoritativeRound(room, dealSeed);
    room.inGame = true;
    ctx.broadcastGameState(ctx.io, room);
    ctx.io.to(roomId).emit('startGame', {
      players: room.players
        .filter((p) => !p.isSpectator)
        .map((p) => ({ id: p.id, name: p.name })),
      hostId: room.host,
      dealSeed,
      skipDealAnimations: !!room.skipDealAnimations,
    });
    ctx.emitTradesCompleteIfReady(ctx.io, roomId, room.gameState, room.host);
    scheduleBotTurns(roomId, ctx);
    if (room.isPublic) ctx.broadcastAvailableRooms();
    console.log(`[Server] Bot-hosted game started in ${roomId}`);
  } catch (err) {
    console.error('[Server] Failed to start bot-hosted game:', err);
    room.inGame = false;
    room.gameState = null;
  }
}

function ensureBotHostedRooms(ctx) {
  const { rooms } = ctx;
  if (hasHumanPublicLobbies(rooms, ctx.isRoomListedPublic)) {
    return null;
  }

  let room = rooms[BOT_ROOM_CODE];
  if (!room) {
    room = createBotHostedRoom(rooms);
  }

  if (!room.inGame) {
    startBotHostedGame(BOT_ROOM_CODE, ctx);
  } else if (!room._botTurnTimer) {
    scheduleBotTurns(BOT_ROOM_CODE, ctx);
  }

  return room;
}

function onBotRoomRoundFinished(room, roomId, ctx) {
  autoReadyBotsForNextRound(room);
  ctx.tryStartNextRoundIfReady(roomId);
  scheduleBotTurns(roomId, ctx);
}

function allPlayersReadyForBotRoom(room, baseCheck) {
  if (!room?.isBotHosted) return baseCheck(room);

  const readyMap = room.gameState?.readyForNextRound || {};
  const ids = baseCheck.activeRoundPlayerIds(room);
  const botsReady = ids.length > 0 && ids.every((id) => readyMap[id] === true);
  if (!botsReady) return false;

  if (baseCheck.gameHasDeadHandSlot(room)) {
    const spectators = room.players.filter((p) => p.isSpectator && !p.disconnectedAt);
    if (spectators.length > 0) {
      return spectators.some((s) => readyMap[s.id] === true);
    }
  }
  return true;
}

function afterBotRoomPlayerLeft(room, ctx) {
  if (!room?.isBotHosted) return false;

  room.players = room.players.filter(
    (p) => isBotMember(p) || (!p.disconnectedAt && !p.isSpectator),
  );

  if (room.inGame && room.gameState) {
    ctx.tryStartNextRoundIfReady(ctx.roomId);
    scheduleBotTurns(ctx.roomId, ctx);
  }

  return true;
}

function roomListingExtras(room) {
  if (!room?.isBotHosted) return {};
  return { isBotHosted: true };
}

module.exports = {
  BOT_ROOM_CODE,
  isBotPlayerId,
  isBotMember,
  isHumanMember,
  hasHumanPublicLobbies,
  shouldListBotRoom,
  discoverRoomFilter,
  ensureBotHostedRooms,
  scheduleBotTurns,
  onBotRoomRoundFinished,
  afterBotRoomPlayerLeft,
  roomListingExtras,
};
