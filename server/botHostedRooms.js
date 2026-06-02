/**
 * Persistent bot-hosted public tables — shown on Find Game when no human lobbies exist.
 * Humans join in-progress games as spectators and can claim the open seat next round.
 */

const {
  applyCpuTurn,
  setTenRuleDirection,
  tenRuleChooserIndex,
  canAcknowledgmentPass,
  isTrickAcknowledgmentPassPhase,
  resolveCompletedAcknowledgmentTrick,
  passTurn,
  isDeadHandPlayer,
  isPlayerStillIn,
  syncFinishedFromEmptyHands,
  isRoundCompleteForLiving,
} = require('./gameBridge');

const BOT_ROOM_CODE = 'BOTOPN';
const BOT_TURN_DELAY_MS = 900;
const BOT_NAMES = ['Amy', 'Ben'];
const MAX_SEATED = 8;
/** No bot progress while a round is active — table is probably stuck. */
const BOT_NO_TIMER_STALL_MS = 18_000;
/** No progress at all (including between rounds with nobody watching). */
const BOT_PROGRESS_STALL_MS = 90_000;
/** Nobody connected and between rounds — stale empty table. */
const BOT_EMPTY_BETWEEN_ROUNDS_MS = 45_000;
const BOT_SKIP_COOLDOWN_MS = 8_000;

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

function countHumansSeated(room) {
  return room.players.filter(
    (p) => !p.disconnectedAt && !p.isSpectator && !isBotMember(p),
  ).length;
}

function openSeatsForHumans(room) {
  return Math.max(0, MAX_SEATED - countHumansSeated(room));
}

/** True when spectators can still claim a seat at this bot table. */
function openSeatsAvailable(room) {
  if (!room?.isBotHosted) return false;
  return countHumansSeated(room) < MAX_SEATED;
}

function canJoinBotRoomInProgress(room) {
  if (!room?.isBotHosted || !room.inGame) return true;
  return countHumansSeated(room) < MAX_SEATED;
}

function shouldJoinBotRoomAsSpectator(room) {
  return !!room?.isBotHosted && !!room.inGame;
}

function ensureHumanHost(room) {
  if (!room?.isBotHosted) return;
  const hostPlayer = room.players.find((p) => p.id === room.host);
  if (hostPlayer && !isBotMember(hostPlayer) && !hostPlayer.disconnectedAt) return;
  const human = room.players.find(
    (p) =>
      !isBotMember(p) &&
      !p.disconnectedAt &&
      !p.isSpectator,
  );
  if (human) {
    room.host = human.id;
    room.hostName = human.name;
  }
}

function gameHasDeadHandSlot(room) {
  return !!(
    room?.deadHand ||
    room?.gameState?.players?.some(
      (p) => p.isDeadHand || p.id === '__dead_hand__',
    )
  );
}

/** Promote ready spectators — dead-hand claim keeps bots; extra humans replace bots. */
function promoteReadySpectators(room) {
  const readyMap = room.gameState?.readyForNextRound || {};
  const readySpectators = room.players.filter(
    (p) => p.isSpectator && !p.disconnectedAt && readyMap[p.id] === true,
  );
  if (readySpectators.length === 0) return [];

  const humansSeated = countHumansSeated(room);
  const deadHandClaim =
    gameHasDeadHandSlot(room) && humansSeated < 2 && readySpectators.length > 0;

  if (deadHandClaim) {
    const toPromote = readySpectators.slice(0, 1);
    for (const spectator of toPromote) {
      spectator.isSpectator = false;
      console.log(
        `[Server] ${spectator.name} is replacing the dead hand next round`,
      );
    }
    ensureHumanHost(room);
    return toPromote;
  }

  const slots = openSeatsForHumans(room);
  const toPromote = readySpectators.slice(0, slots);

  for (const spectator of toPromote) {
    spectator.isSpectator = false;
    console.log(`[Server] ${spectator.name} is joining the bot table next round`);
  }

  let bots = room.players.filter((p) => isBotMember(p) && !p.isSpectator);
  for (let i = 0; i < toPromote.length && bots.length > 0; i++) {
    const bot = bots.pop();
    room.players = room.players.filter((p) => p.id !== bot.id);
  }

  if (countHumansSeated(room) >= 2) {
    room.players = room.players.filter((p) => !isBotMember(p));
  }

  ensureHumanHost(room);
  return toPromote;
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

/**
 * Drain acknowledgment passes until the trick resolves or no bot can act.
 * One pass per loop iteration so passTurn turn order stays correct.
 */
function drainBotAcknowledgment(room, ctx) {
  if (!room?.gameState || !isTrickAcknowledgmentPassPhase(room.gameState)) {
    return false;
  }

  let changed = false;
  let safety = room.gameState.players.length * 3 + 4;

  while (safety-- > 0 && isTrickAcknowledgmentPassPhase(room.gameState)) {
    if (tryResolveAcknowledgmentPhase(room, ctx)) {
      return true;
    }

    let progressed = false;
    const gs = room.gameState;
    for (const p of gs.players) {
      if (!isBotPlayerId(p.id) || isDeadHandPlayer(p)) continue;
      if (!canAcknowledgmentPass(gs, p.id)) continue;
      const next = passTurn(ctx.cloneGameState(gs), p.id);
      if (next === gs) continue;
      room.gameState = ctx.cloneGameState(next);
      progressed = true;
      changed = true;
      break;
    }

    if (!progressed) break;
  }

  if (tryResolveAcknowledgmentPhase(room, ctx)) {
    return true;
  }

  return changed;
}

function tryResolveAcknowledgmentPhase(room, ctx) {
  const gs = room.gameState;
  if (!gs || !isTrickAcknowledgmentPassPhase(gs)) return false;

  const before = ctx.cloneGameState(gs);
  const resolved = resolveCompletedAcknowledgmentTrick(before);
  if (resolved === before) return false;

  room.gameState = ctx.cloneGameState(resolved);
  return true;
}

function isHumanGamePlayer(player, state, room) {
  if (!player || isBotPlayerId(player.id) || isDeadHandPlayer(player)) {
    return false;
  }
  const lobby = room?.players?.find((p) => p.id === player.id);
  if (lobby?.isSpectator || lobby?.disconnectedAt) return false;
  return isPlayerStillIn(state, player.id);
}

function shouldBotCpuAct(room) {
  const gs = room?.gameState;
  const current = gs?.players?.[gs.currentPlayerIndex];
  return (
    !!current &&
    isBotPlayerId(current.id) &&
    !isDeadHandPlayer(current) &&
    !isHumanGamePlayer(current, gs, room)
  );
}

function tradesBlockingBots(room, ctx) {
  const pending = room.gameState?.pendingTrades || {};
  if (Object.keys(pending).length === 0) return false;
  if (ctx.allTradesComplete(room.gameState)) return false;
  if (resolveBotPendingTrades(room, ctx)) {
    ctx.emitTradesCompleteIfReady(ctx.io, ctx.roomId, room.gameState, room.host);
    ctx.broadcastGameState(ctx.io, room);
  }
  return !ctx.allTradesComplete(room.gameState);
}

/** Skip dead-hand / out seats so bot turns don't stall mid-trick (common during runs). */
function advanceUntilBotTurnOrHuman(room, ctx) {
  if (!room.gameState?.players?.length) return false;

  let changed = false;
  let safety = room.gameState.players.length + 4;

  while (safety-- > 0) {
    if (tryResolveAcknowledgmentPhase(room, ctx)) {
      return true;
    }

    const gs = room.gameState;
    const current = gs.players[gs.currentPlayerIndex];
    if (!current) break;

    const ackLeaderWait =
      isTrickAcknowledgmentPassPhase(gs) &&
      gs.lastPlayPlayerIndex === gs.currentPlayerIndex;
    const canAck =
      isTrickAcknowledgmentPassPhase(gs) &&
      isBotPlayerId(current.id) &&
      canAcknowledgmentPass(gs, current.id);

    if (
      isBotPlayerId(current.id) &&
      !isDeadHandPlayer(current) &&
      canAck
    ) {
      const acked = passTurn(ctx.cloneGameState(gs), current.id);
      if (acked !== gs) {
        room.gameState = ctx.cloneGameState(acked);
        changed = true;
        if (tryResolveAcknowledgmentPhase(room, ctx)) {
          return true;
        }
        continue;
      }
    }

    if (
      isBotPlayerId(current.id) &&
      !isDeadHandPlayer(current) &&
      !ackLeaderWait &&
      !canAck
    ) {
      return changed;
    }
    if (isHumanGamePlayer(current, gs, room)) {
      return changed;
    }

    const beforeIdx = gs.currentPlayerIndex;
    ctx.advancePastInactiveSeats(room);

    if (room.gameState.currentPlayerIndex !== beforeIdx) {
      changed = true;
      continue;
    }

    if (isDeadHandPlayer(current) || !isPlayerStillIn(gs, current.id)) {
      const passed = passTurn(ctx.cloneGameState(gs), current.id);
      if (passed !== gs) {
        room.gameState = ctx.cloneGameState(passed);
        changed = true;
        continue;
      }
    }
    break;
  }

  return changed;
}

function markBotProgress(room) {
  if (!room?.isBotHosted) return;
  room._botLastProgressAt = Date.now();
}

function livingRoundInProgress(gameState) {
  if (!gameState?.players?.length) return false;
  const living = gameState.players.filter((p) => !isDeadHandPlayer(p));
  if (living.length === 0) return false;
  const finished = gameState.finishedOrder || [];
  return !living.every((p) => finished.includes(p.id));
}

function connectedLobbyCount(room) {
  return room.players.filter((p) => !p.disconnectedAt && p.socketId).length;
}

function isBotRoomStalled(room) {
  if (!room?.isBotHosted || !room.inGame) return false;
  const now = Date.now();
  const last = room._botLastProgressAt ?? room.createdAt ?? now;

  if (!room.gameState?.players?.length) return true;

  const roundActive = livingRoundInProgress(room.gameState);
  if (!roundActive) {
    if (
      connectedLobbyCount(room) === 0 &&
      now - last > BOT_EMPTY_BETWEEN_ROUNDS_MS
    ) {
      return true;
    }
    return false;
  }

  if (!room._botTurnTimer && now - last > BOT_NO_TIMER_STALL_MS) {
    return true;
  }
  if (now - last > BOT_PROGRESS_STALL_MS) {
    return true;
  }
  return false;
}

/** Tear down a stuck or empty bot game and deal a fresh round (spectators stay in the room). */
function resetBotHostedRoom(roomId, ctx, message) {
  const room = ctx.rooms[roomId];
  if (!room?.isBotHosted) return false;

  if (room._botTurnTimer) {
    clearTimeout(room._botTurnTimer);
    room._botTurnTimer = null;
  }

  room.inGame = false;
  room.gameState = null;
  room._botLastProgressAt = Date.now();
  room._lastBotSkipAt = Date.now();

  const note = message || 'Bot table restarted.';
  console.log(`[Server] Resetting bot room ${roomId}: ${note}`);
  ctx.io.to(roomId).emit('botTableSkipped', { roomId, message: note });

  startBotHostedGame(roomId, ctx);
  if (room.isPublic) ctx.broadcastAvailableRooms();
  return true;
}

function repairBotHostedRoomIfNeeded(ctx) {
  const room = ctx.rooms[BOT_ROOM_CODE];
  if (!room?.isBotHosted) return false;

  if (room.inGame && !room.gameState) {
    return resetBotHostedRoom(BOT_ROOM_CODE, ctx, 'Restarting empty bot table…');
  }

  if (isBotRoomStalled(room)) {
    return resetBotHostedRoom(
      BOT_ROOM_CODE,
      ctx,
      'Restarting stalled bot table…',
    );
  }

  return false;
}

function finishBotRoundIfComplete(room, ctx) {
  if (!room?.gameState) return false;
  if (!ctx.isRoundComplete(room.gameState) || room.gameState.tenRulePending) {
    return false;
  }
  ctx.onRoundComplete(ctx.roomId, room);
  return true;
}

/** Sync empty-hand / lone-asshole finish order — bot tables can stall without this. */
function refreshFinishSync(room, ctx) {
  if (!room?.gameState) return false;
  const synced = ctx.cloneGameState(room.gameState);
  syncFinishedFromEmptyHands(synced);
  const prevLen = room.gameState.finishedOrder?.length ?? 0;
  if (
    synced.finishedOrder.length !== prevLen ||
    isRoundCompleteForLiving(synced) !== isRoundCompleteForLiving(room.gameState)
  ) {
    room.gameState = ctx.cloneGameState(synced);
    return true;
  }
  return false;
}

function tryCompleteBotRound(room, ctx) {
  refreshFinishSync(room, ctx);
  return finishBotRoundIfComplete(room, ctx);
}

function processBotTurnStep(room, ctx) {
  if (!room?.isBotHosted || !room.inGame || !room.gameState) return false;
  if (ctx.isGamePausedForAway(room)) return false;

  if (tryCompleteBotRound(room, ctx)) return true;

  if (tradesBlockingBots(room, ctx)) return false;

  if (resolveBotPendingTrades(room, ctx)) {
    ctx.emitTradesCompleteIfReady(ctx.io, ctx.roomId, room.gameState, room.host);
  }

  if (applyBotTenRuleIfNeeded(room, ctx)) {
    advanceUntilBotTurnOrHuman(room, ctx);
    ctx.broadcastGameState(ctx.io, room);
    tryCompleteBotRound(room, ctx);
    return true;
  }

  if (drainBotAcknowledgment(room, ctx)) {
    markBotProgress(room);
    advanceUntilBotTurnOrHuman(room, ctx);
    ctx.broadcastGameState(ctx.io, room);
    if (tryCompleteBotRound(room, ctx)) return true;
    return true;
  }

  if (advanceUntilBotTurnOrHuman(room, ctx)) {
    ctx.broadcastGameState(ctx.io, room);
    if (!shouldBotCpuAct(room)) {
      tryCompleteBotRound(room, ctx);
      return false;
    }
  }

  if (!shouldBotCpuAct(room)) {
    return false;
  }

  const gs = room.gameState;
  const current = gs.players[gs.currentPlayerIndex];

  const before = ctx.cloneGameState(gs);
  let next = applyCpuTurn(before, current.id);
  if (next === before) {
    next = passTurn(before, current.id);
  }
  if (next === before) {
    if (tryResolveAcknowledgmentPhase(room, ctx)) {
      advanceUntilBotTurnOrHuman(room, ctx);
      ctx.broadcastGameState(ctx.io, room);
      if (tryCompleteBotRound(room, ctx)) return true;
      return true;
    }
    if (tryCompleteBotRound(room, ctx)) return true;
    return false;
  }

  room.gameState = ctx.cloneGameState(next);
  room.gameState.readyForNextRound = room.gameState.readyForNextRound || {};
  markBotProgress(room);
  advanceUntilBotTurnOrHuman(room, ctx);
  ctx.broadcastGameState(ctx.io, room);

  tryCompleteBotRound(room, ctx);
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

/** Clear a stuck timer and re-run the loop (e.g. after a new deal / trades). */
function kickBotTurnLoop(roomId, ctx) {
  const room = ctx.rooms[roomId];
  if (!room?.isBotHosted || !room.inGame) return;
  if (room._botTurnTimer) {
    clearTimeout(room._botTurnTimer);
    room._botTurnTimer = null;
  }
  scheduleBotTurns(roomId, ctx);
}

function runBotTurnLoop(roomId, ctx) {
  const room = ctx.rooms[roomId];
  if (!room?.isBotHosted || !room.inGame || !room.gameState) return;
  if (ctx.isGamePausedForAway(room)) return;

  let safety = 80;
  const step = () => {
    if (safety-- <= 0) return;
    const live = ctx.rooms[roomId];
    if (!live?.inGame || !live.gameState) return;

    const acted = processBotTurnStep(live, ctx);
    if (acted) {
      live._botTurnTimer = setTimeout(step, BOT_TURN_DELAY_MS);
      return;
    }

    if (tryCompleteBotRound(live, ctx)) return;

    if (
      isTrickAcknowledgmentPassPhase(live.gameState) &&
      drainBotAcknowledgment(live, ctx)
    ) {
      ctx.broadcastGameState(ctx.io, live);
      live._botTurnTimer = setTimeout(step, BOT_TURN_DELAY_MS);
      return;
    }

    // Stalled on dead hand / passive seat — retry after advancing once more
    if (advanceUntilBotTurnOrHuman(live, ctx)) {
      ctx.broadcastGameState(ctx.io, live);
      if (shouldBotCpuAct(live) && !ctx.isRoundComplete(live.gameState)) {
        live._botTurnTimer = setTimeout(step, BOT_TURN_DELAY_MS);
      }
      return;
    }

    if (shouldBotCpuAct(live) && !ctx.isRoundComplete(live.gameState)) {
      live._botTurnTimer = setTimeout(step, BOT_TURN_DELAY_MS);
    }
  };

  step();
}

function startBotHostedGame(roomId, ctx) {
  const room = ctx.rooms[roomId];
  if (!room?.isBotHosted) return;
  if (room.inGame && room.gameState) return;

  if (room.inGame && !room.gameState) {
    room.inGame = false;
  }
  if (room.inGame) return;

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
    markBotProgress(room);
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

  repairBotHostedRoomIfNeeded(ctx);

  let room = rooms[BOT_ROOM_CODE];
  if (!room) {
    room = createBotHostedRoom(rooms);
  }

  if (!room.inGame || !room.gameState) {
    startBotHostedGame(BOT_ROOM_CODE, ctx);
  } else if (!room._botTurnTimer) {
    scheduleBotTurns(BOT_ROOM_CODE, ctx);
  }

  return room;
}

function forceFinishBotRound(room, ctx) {
  const gs = room.gameState;
  if (!gs?.players?.length) return false;

  let next = ctx.cloneGameState(gs);
  const living = next.players.filter((p) => !isDeadHandPlayer(p));
  next.finishedOrder = next.finishedOrder || [];
  for (const p of living) {
    if (!next.finishedOrder.includes(p.id)) {
      next.finishedOrder.push(p.id);
      p.hand = [];
    }
  }
  syncFinishedFromEmptyHands(next);
  room.gameState = ctx.cloneGameState(next);
  ctx.broadcastGameState(ctx.io, room);
  if (ctx.isRoundComplete(room.gameState) && !room.gameState.tenRulePending) {
    ctx.onRoundComplete(ctx.roomId, room);
    return true;
  }
  return false;
}

/** End a stuck trick or jump to round results / next deal (spectators stay). */
function skipBotHostedGame(roomId, ctx) {
  const code = String(roomId || '').trim().toUpperCase();
  const room = ctx.rooms[code];
  if (!room?.isBotHosted) return { ok: false, message: 'Not a bot table.' };

  const now = Date.now();
  if (room._lastBotSkipAt && now - room._lastBotSkipAt < BOT_SKIP_COOLDOWN_MS) {
    return {
      ok: false,
      message: 'Please wait a few seconds before skipping again.',
    };
  }

  if (room._botTurnTimer) {
    clearTimeout(room._botTurnTimer);
    room._botTurnTimer = null;
  }

  room._lastBotSkipAt = now;
  markBotProgress(room);

  if (!room.inGame || !room.gameState?.players?.length) {
    startBotHostedGame(code, ctx);
    ctx.io.to(code).emit('botTableSkipped', {
      roomId: code,
      message: 'Starting a fresh deal…',
    });
    return { ok: true };
  }

  if (resolveBotPendingTrades(room, ctx)) {
    ctx.emitTradesCompleteIfReady(ctx.io, code, room.gameState, room.host);
  }
  const gs = room.gameState;

  if (ctx.isRoundComplete(gs) && !gs.tenRulePending) {
    autoReadyBotsForNextRound(room);
    const readyMap = gs.readyForNextRound || {};
    for (const p of room.players) {
      if (!p.disconnectedAt) readyMap[p.id] = true;
    }
    gs.readyForNextRound = readyMap;
    ctx.io.to(code).emit('playerReadyUpdate', {
      readyForNextRound: readyMap,
    });
    ctx.tryStartNextRoundIfReady(code);
    if (ctx.isRoundComplete(room.gameState)) {
      ctx.forceStartNextRound(code);
    }
    ctx.io.to(code).emit('botTableSkipped', {
      roomId: code,
      message: 'Skipped to the next round.',
    });
    if (room.isPublic) ctx.broadcastAvailableRooms();
    return { ok: true };
  }

  if (forceFinishBotRound(room, ctx)) {
    ctx.io.to(code).emit('botTableSkipped', {
      roomId: code,
      message: 'Skipped to round results.',
    });
    if (room.isPublic) ctx.broadcastAvailableRooms();
    return { ok: true };
  }

  resetBotHostedRoom(code, ctx, 'Could not skip — restarted bot table.');
  ctx.io.to(code).emit('botTableSkipped', {
    roomId: code,
    message: 'Restarted bot table.',
  });
  return { ok: true };
}

function onBotRoomRoundFinished(room, roomId, ctx) {
  autoReadyBotsForNextRound(room);
  ctx.tryStartNextRoundIfReady(roomId);
  if (!room.inGame || !room.gameState) return;
  if (!ctx.isRoundComplete(room.gameState) || room.gameState.tenRulePending) {
    scheduleBotTurns(roomId, ctx);
  }
}

function afterBotRoomPlayerLeft(room, roomId, ctx) {
  if (!room?.isBotHosted) return false;

  room.players = room.players.filter(
    (p) => isBotMember(p) || (!p.disconnectedAt && !p.isSpectator),
  );
  ensureHumanHost(room);

  if (room.inGame && room.gameState) {
    ctx.tryStartNextRoundIfReady(roomId);
    scheduleBotTurns(roomId, ctx);
  }

  return true;
}

function roomListingExtras(room) {
  if (!room?.isBotHosted) return {};
  return {
    isBotHosted: true,
    botTableStalled: isBotRoomStalled(room),
  };
}

module.exports = {
  BOT_ROOM_CODE,
  MAX_SEATED,
  isBotPlayerId,
  isBotMember,
  isHumanMember,
  hasHumanPublicLobbies,
  shouldListBotRoom,
  discoverRoomFilter,
  ensureBotHostedRooms,
  repairBotHostedRoomIfNeeded,
  resetBotHostedRoom,
  skipBotHostedGame,
  gameHasDeadHandSlot,
  isBotRoomStalled,
  scheduleBotTurns,
  kickBotTurnLoop,
  onBotRoomRoundFinished,
  afterBotRoomPlayerLeft,
  roomListingExtras,
  openSeatsAvailable,
  canJoinBotRoomInProgress,
  shouldJoinBotRoomAsSpectator,
  promoteReadySpectators,
  countHumansSeated,
};
