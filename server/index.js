// Simple Socket.IO server for lobbies and game state
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const {
  createGameFromLobby,
  playCards,
  passTurn,
  setTenRuleDirection,
  resolveLeadPlayerIndexAfterTrades,
  resolveOpeningPlayerIndex,
  pickHighestCards,
  pickLowestCards,
  advanceAssholeStreakAfterRound,
  shouldSkipPresidentAssholeTrade,
  isDeadHandPlayer,
  isPlayerStillIn,
  hasPassedInCurrentTrick,
  nextActivePlayerIndex,
  isTrickOpeningLead,
} = require('./gameBridge');
const { viewForPlayer, viewForMember, broadcastGameState } = require('./gameStateView');
const {
  validateDisplayText,
  normalizeRoomCode,
  isValidRoomCode,
} = require('./profanityFilter');

const DEFAULT_FELT_TINT = '#0f5132';

function normalizeFeltTint(input) {
  if (!input || typeof input !== 'string') return null;
  const raw = input.trim();
  const withHash = raw.startsWith('#') ? raw : `#${raw}`;
  if (/^#[0-9a-fA-F]{6}$/.test(withHash)) return withHash.toLowerCase();
  if (/^#[0-9a-fA-F]{8}$/.test(withHash)) return withHash.slice(0, 7).toLowerCase();
  return null;
}

function resolveFeltTint(input) {
  return normalizeFeltTint(input) || DEFAULT_FELT_TINT;
}

function cloneGameState(state) {
  return JSON.parse(JSON.stringify(state));
}

function isRoundComplete(state) {
  if (!state || !Array.isArray(state.players) || !Array.isArray(state.finishedOrder)) {
    return false;
  }
  const living = state.players.filter((p) => !p.isDeadHand && p.id !== '__dead_hand__');
  if (living.length === 0) return false;
  return living.every((p) => state.finishedOrder.includes(p.id));
}

function beginAuthoritativeRound(room, dealSeed, options = {}) {
  const lobbyPlayers = room.players
    .filter((p) => !p.disconnectedAt && !p.isSpectator)
    .map((p) => ({ id: p.id, name: p.name }));
  const useDeadHand = lobbyPlayers.length === 2;
  const lastRoundOrder = options.lastRoundOrder ?? room.gameState?.lastRoundOrder ?? [];
  const nextState = createGameFromLobby(lobbyPlayers, dealSeed, {
    deadHand: useDeadHand,
    hostId: room.host,
    lastRoundOrder: lastRoundOrder.length >= 2 ? lastRoundOrder : undefined,
  });
  nextState.readyForNextRound = {};
  nextState.dealSeed = dealSeed;
  room.gameState = nextState;
  room.deadHand = useDeadHand;
}

function gameHasDeadHandSlot(room) {
  return !!room?.gameState?.players?.some(
    (p) => p.isDeadHand || p.id === '__dead_hand__',
  );
}

function deadHandSeatOpen(room) {
  if (!room) return false;
  if (!room.inGame) return activePlayerCount(room) === 2;
  return gameHasDeadHandSlot(room) && activePlayerCount(room) === 2;
}

function spectatorCount(room) {
  if (!room) return 0;
  return room.players.filter((p) => !p.disconnectedAt && p.isSpectator).length;
}

function shouldJoinAsSpectator(room) {
  if (!room?.inGame) return false;
  const seated = activePlayerCount(room);
  if (seated >= 3) return false;
  return seated >= 2;
}

function promoteReadySpectator(room) {
  const readyMap = room.gameState?.readyForNextRound || {};
  const spectator = room.players.find(
    (p) => p.isSpectator && !p.disconnectedAt && readyMap[p.id] === true,
  );
  if (spectator) {
    spectator.isSpectator = false;
    console.log(`[Server] ${spectator.name} is replacing the dead hand next round`);
  }
  return spectator;
}

function isLivingPlayer(player) {
  return player && !player.isDeadHand && player.id !== '__dead_hand__';
}

function livingFinishOrder(gameState, finishOrder) {
  const livingIds = new Set(
    (gameState?.players || []).filter(isLivingPlayer).map((p) => p.id),
  );
  return (finishOrder || []).filter((id) => livingIds.has(id));
}

function livingPlayerCount(gameState) {
  return (gameState?.players || []).filter(isLivingPlayer).length;
}

function startNextRound(roomId) {
  const room = rooms[roomId];
  if (!room) return;
  const promoted = promoteReadySpectator(room);
  const dealSeed = Math.floor(Math.random() * 2147483647);
  const lastOrder = livingFinishOrder(
    room.gameState,
    room.gameState?.lastRoundOrder?.slice() ?? [],
  );

  const streakAfterRound = advanceAssholeStreakAfterRound(
    {
      consecutiveAssholeId: room.gameState?.consecutiveAssholeId ?? null,
      consecutiveAssholeCount: room.gameState?.consecutiveAssholeCount ?? 0,
      freshRound: !!room.gameState?.freshRound,
    },
    lastOrder,
    room.gameState?.players ?? [],
  );
  const skipPresidentTrade = shouldSkipPresidentAssholeTrade(streakAfterRound);

  beginAuthoritativeRound(room, dealSeed, { lastRoundOrder: lastOrder });

  room.gameState.consecutiveAssholeId = streakAfterRound.consecutiveAssholeId;
  room.gameState.consecutiveAssholeCount = streakAfterRound.consecutiveAssholeCount;
  room.gameState.freshRound = skipPresidentTrade;

  if (lastOrder.length >= 2) {
    room.gameState.lastRoundOrder = lastOrder;
    assignRolesFromFinishOrder(
      room.gameState,
      livingPlayerCount(room.gameState),
      lastOrder,
    );
    const playerHands = {};
    for (const p of room.gameState.players) {
      playerHands[p.id] = [...p.hand];
    }
    prepareCardTrades(room.gameState, playerHands, { skipPresidentTrade });
    for (const p of room.gameState.players) {
      p.hand = playerHands[p.id] || [];
    }
    room.gameState.playerHands = playerHands;
  } else {
    room.gameState.pendingTrades = {};
  }

  room.gameState.readyForNextRound = {};
  broadcastGameState(io, room);
  io.to(roomId).emit('nextRoundStarting', {
    dealSeed,
    promotedPlayerId: promoted?.id ?? null,
  });
  emitTradesCompleteIfReady(io, roomId, room.gameState, room.host);
}

const app = express();
app.use(cors({ origin: true, credentials: false }));

// Simple health endpoint
app.get('/', (req, res) => res.send('Server is running...\n'));

const pkg = require('../package.json');
const SERVER_APP_VERSION =
  process.env.CLIENT_APP_VERSION?.trim() ||
  process.env.EXPO_PUBLIC_APP_VERSION?.trim() ||
  pkg.version ||
  '0.0.0';
const SERVER_BUILD_ID =
  process.env.CLIENT_BUILD_ID?.trim() ||
  process.env.EXPO_PUBLIC_BUILD_ID?.trim() ||
  'dev';

app.get('/version', (_req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({
    version: SERVER_APP_VERSION,
    buildId: SERVER_BUILD_ID,
    builtAt: process.env.CLIENT_BUILT_AT || null,
  });
});

const server = http.createServer(app);

// io instance — reflect client origin (required when credentials are enabled; '*' is invalid)
const io = new Server(server, {
  cors: {
    origin: true,
    credentials: false,
    methods: ["GET", "POST"],
  },
});

// Debugging: log engine and socket connection errors to help diagnose websocket/xhr issues
io.engine.on && io.engine.on('connection_error', (err) => {
  console.error('[io.engine] connection_error:', err && err.message ? err.message : err);
});

io.on && io.on('connect_error', (err) => {
  console.error('[io] connect_error:', err && err.message ? err.message : err);
});

// PORT and HOST
const PORT = process.env.PORT || 4000;
const HOST = process.env.HOST || '0.0.0.0';

// Simple room-based lobby
// rooms: roomId -> { 
//   players: [{id,name,socketId,ready,disconnectedAt}], 
//   host, hostName, roomName, createdAt, isPublic,
//   gameState: GameState | null,
//   inGame: boolean
// }
const rooms = {};

// Assign roles based on finish order. Mutates gameState object.
function assignRolesFromFinishOrder(gameState, playersCount, finishOrder) {
  const order = livingFinishOrder(gameState, finishOrder ?? gameState.lastRoundOrder ?? []);
  const roles = {};
  // Defaults: everyone neutral
  for (const pid of (order.length ? order : [])) roles[pid] = 'neutral';

  if (order.length === 0) return roles;
  // First -> president
  roles[order[0]] = 'president';
  // Last -> asshole
  const lastIdx = order.length - 1;
  roles[order[lastIdx]] = 'asshole';

  if (playersCount >= 5 && order.length >= 4) {
    roles[order[1]] = 'vice_president';
    roles[order[lastIdx - 1]] = 'vice_asshole';
  }

  gameState.roles = roles;
  return roles;
}

// Prepare trades based on roles and hands. Mutates gameState.pendingTrades and playerHands map.
// playerHands: { [playerId]: Card[] }
function prepareCardTrades(gameState, playerHands, options = {}) {
  const roles = gameState.roles || {};
  const pending = {};
  const skipPresidentTrade = !!options.skipPresidentTrade;

  // President <-> Asshole
  const presidentId = Object.keys(roles).find(k => roles[k] === 'president');
  const assholeId = Object.keys(roles).find(k => roles[k] === 'asshole');

  const playerCount = livingPlayerCount(gameState);

  if (presidentId && assholeId && !skipPresidentTrade) {
    if (playerCount >= 5) {
      // Asshole gives 2 best, President must choose 2 to give back
      const fromHand = playerHands[assholeId] || [];
      const taken = pickHighestCards(fromHand, 2);
      // remove taken from asshole hand
      playerHands[assholeId] = (fromHand || []).filter(c => !taken.find(t => t.suit === c.suit && t.value === c.value));
      pending.president = { fromId: assholeId, count: 2, incoming: taken, selected: null };
    } else {
      // 3-4 players: Asshole gives 1 best, President chooses 1 to return
      const fromHand = playerHands[assholeId] || [];
      const taken = pickHighestCards(fromHand, 1);
      playerHands[assholeId] = (fromHand || []).filter(c => !taken.find(t => t.suit === c.suit && t.value === c.value));
      pending.president = { fromId: assholeId, count: 1, incoming: taken, selected: null };
    }
  }

  // Vice roles for 5+ players
  const vicePresId = Object.keys(roles).find(k => roles[k] === 'vice_president');
  const viceAssId = Object.keys(roles).find(k => roles[k] === 'vice_asshole');
  if (vicePresId && viceAssId) {
    // Vice Asshole gives 1 best, Vice President chooses 1 to return
    const fromHand = playerHands[viceAssId] || [];
    const taken = pickHighestCards(fromHand, 1);
    playerHands[viceAssId] = (fromHand || []).filter(c => !taken.find(t => t.suit === c.suit && t.value === c.value));
    pending.vicePresident = { fromId: viceAssId, count: 1, incoming: taken, selected: null };
  }

  gameState.pendingTrades = pending;
  return { pending, playerHands };
}

// Apply a winner's selected cards back to loser. Returns { ok, message }
function applyWinnerSelectedCards(gameState, playerHands, winnerId, selectedCards) {
  const pending = gameState.pendingTrades || {};
  // Determine which pending trade this winner is responsible for
  let key = null;
  if (pending.president && pending.president.fromId && pending.president.incoming && pending.president.incoming.length > 0) {
    const presId = Object.keys(gameState.roles || {}).find(k => gameState.roles[k] === 'president');
    if (presId === winnerId) key = 'president';
  }
  if (!key && pending.vicePresident) {
    const vpId = Object.keys(gameState.roles || {}).find(k => gameState.roles[k] === 'vice_president');
    if (vpId === winnerId) key = 'vicePresident';
  }
  if (!key) return { ok: false, message: 'No pending trade for this player' };

  const trade = pending[key];
  if (!trade) return { ok: false, message: 'Trade not found' };

  const expectedCount = trade.count;
  if (!Array.isArray(selectedCards) || selectedCards.length !== expectedCount) {
    return { ok: false, message: `Must select exactly ${expectedCount} cards` };
  }

  // Validate that winner currently has these cards
  const winnerHand = playerHands[winnerId] || [];
  for (const sc of selectedCards) {
    const found = winnerHand.findIndex(c => c.suit === sc.suit && c.value === sc.value);
    if (found === -1) return { ok: false, message: 'Selected card not in winner hand' };
  }

  // Remove selected cards from winner and give to loser (trade.fromId)
  playerHands[winnerId] = winnerHand.filter(h => !selectedCards.find(s => s.suit === h.suit && s.value === h.value));
  const loserId = trade.fromId;
  playerHands[loserId] = (playerHands[loserId] || []).concat(selectedCards);

  // Also, the incoming cards that were removed earlier must be added to winner's hand
  playerHands[winnerId] = (playerHands[winnerId] || []).concat(trade.incoming || []);

  // Mark trade as completed
  trade.selected = selectedCards;
  return { ok: true };
}

function allTradesComplete(gameState) {
  const pending = gameState.pendingTrades || {};
  for (const k of Object.keys(pending)) {
    if (!pending[k].selected) return false;
  }
  return true;
}

function snapshotPlayerHands(gameState) {
  const playerHands = {};
  for (const p of gameState.players || []) {
    playerHands[p.id] = [...(p.hand || [])];
  }
  return playerHands;
}

/** After role trades finish, opener is whoever holds 3♣ (not dealer's left). */
function syncOpeningPlayerAfterTrades(gameState, hostId) {
  const lastRoundOrder = gameState.lastRoundOrder;
  if (!lastRoundOrder || lastRoundOrder.length < 2) return;

  const playerHands = gameState.playerHands || {};
  for (const p of gameState.players || []) {
    if (playerHands[p.id]) p.hand = [...playerHands[p.id]];
  }

  const dealerContext = { hostId: hostId ?? null, lastRoundOrder };
  let idx = resolveLeadPlayerIndexAfterTrades(gameState.players, dealerContext);
  if (idx < 0) {
    idx = resolveOpeningPlayerIndex(gameState.players, dealerContext);
  }
  if (idx >= 0 && idx < gameState.players.length) {
    gameState.currentPlayerIndex = idx;
    gameState.mustPlay = true;
  }
}

/** Round 1 (and any round with no pending trades) has no trade UI — tell clients they may unlock. */
function emitTradesCompleteIfReady(io, roomId, gameState, hostId) {
  const pendingKeys = Object.keys(gameState.pendingTrades || {});
  if (pendingKeys.length > 0 && !allTradesComplete(gameState)) return;
  const playerHands = gameState.playerHands || snapshotPlayerHands(gameState);
  gameState.playerHands = playerHands;
  syncOpeningPlayerAfterTrades(gameState, hostId);
  io.to(roomId).emit('tradesComplete', { playerHands });
}

/** Auto-finish trades (no client UI yet) so ready players can start the next deal. */
function finalizePendingTrades(gameState, playerHands) {
  const pending = gameState.pendingTrades || {};
  const roles = gameState.roles || {};

  for (const key of Object.keys(pending)) {
    const trade = pending[key];
    if (!trade || trade.selected) continue;

    const roleName = key === 'president' ? 'president' : 'vice_president';
    const winnerId = Object.keys(roles).find((k) => roles[k] === roleName);
    if (!winnerId) {
      trade.selected = [];
      continue;
    }

    const need = trade.count || 0;
    const winnerHand = playerHands[winnerId] || [];
    const selected = pickLowestCards(winnerHand, need);

    if (selected.length === need) {
      const res = applyWinnerSelectedCards(gameState, playerHands, winnerId, selected);
      if (!res.ok) {
        playerHands[winnerId] = winnerHand.concat(trade.incoming || []);
        trade.selected = selected;
      }
    } else {
      playerHands[winnerId] = winnerHand.concat(trade.incoming || []);
      trade.selected = selected;
    }
  }
}

function activeRoundPlayerIds(room) {
  const gs = room.gameState;
  if (gs?.players?.length) {
    return gs.players
      .filter((p) => !p.isDeadHand && p.id !== '__dead_hand__')
      .map((p) => p.id);
  }
  return room.players
    .filter((p) => !p.disconnectedAt && !p.isSpectator)
    .map((p) => p.id);
}

function initReadyForNextRound(room) {
  room.gameState.readyForNextRound = {};
  for (const id of activeRoundPlayerIds(room)) {
    room.gameState.readyForNextRound[id] = false;
  }
  if (gameHasDeadHandSlot(room)) {
    for (const s of room.players.filter((p) => p.isSpectator && !p.disconnectedAt)) {
      room.gameState.readyForNextRound[s.id] = false;
    }
  }
}

function allPlayersReadyForNextRound(room) {
  const readyMap = room.gameState?.readyForNextRound || {};
  const ids = activeRoundPlayerIds(room);
  return ids.length > 0 && ids.every((id) => readyMap[id] === true);
}

function tryStartNextRoundIfReady(roomId) {
  const room = rooms[roomId];
  if (!room?.gameState) return;
  if (!allPlayersReadyForNextRound(room)) return;
  startNextRound(roomId);
}

// Testing timeouts — raise these for production (e.g. 60s in-game, 2m lobby, 10m empty shell).
const IN_GAME_AWAY_GRACE_MIN_MS = 20 * 1000;
const IN_GAME_AWAY_GRACE_MAX_MS = 30 * 1000;
const LOBBY_DISCONNECT_GRACE = 15 * 1000;
/** How long an empty room shell stays joinable by code before auto-delete. */
const EMPTY_ROOM_REJOIN_MS = 15 * 1000;
const emptyRoomTimers = {};
/** `${roomId}:${playerId}` → removal timer after disconnect / leave. */
const awayRemovalTimers = new Map();

function inGameAwayGraceMs() {
  const span = IN_GAME_AWAY_GRACE_MAX_MS - IN_GAME_AWAY_GRACE_MIN_MS;
  return IN_GAME_AWAY_GRACE_MIN_MS + Math.floor(Math.random() * (span + 1));
}

function cancelAwayRemoval(roomId, playerId) {
  const key = `${roomId}:${playerId}`;
  const timer = awayRemovalTimers.get(key);
  if (timer) {
    clearTimeout(timer);
    awayRemovalTimers.delete(key);
  }
}

function advancePastDisconnectedPlayers(room) {
  const gs = room?.gameState;
  if (!gs?.players) return;
  let working = cloneGameState(gs);
  let safety = gs.players.length + 2;
  while (safety-- > 0) {
    const current = working.players[working.currentPlayerIndex];
    if (!current) break;
    const member = room.players.find((p) => p.id === current.id);
    if (!member?.disconnectedAt) break;
    const next = passTurn(working, current.id);
    if (next === working) break;
    working = next;
  }
  room.gameState = cloneGameState(working);
}

/** Skip seats that cannot act (out, dead hand, already passed this trick). */
function advancePastInactiveSeats(room) {
  const gs = room?.gameState;
  if (!gs?.players) return;
  let working = cloneGameState(gs);
  let safety = gs.players.length + 4;
  while (safety-- > 0) {
    const current = working.players[working.currentPlayerIndex];
    if (!current) break;
    const quadWait =
      working.fourOfAKindChallenge?.active &&
      working.fourOfAKindChallenge.completedAcrossTurns &&
      working.lastPlayPlayerIndex === working.currentPlayerIndex;
    const runOnTopTurn =
      working.runOnTop?.active &&
      working.runOnTop.playerIndex === working.currentPlayerIndex;
    const mustOpenTrick =
      working.mustPlay && isTrickOpeningLead(working);
    const inactive =
      isDeadHandPlayer(current) ||
      !isPlayerStillIn(working, current.id) ||
      (hasPassedInCurrentTrick(working, current.id) && !runOnTopTurn) ||
      quadWait;
    if (!inactive || mustOpenTrick) break;
    if (quadWait) {
      working.currentPlayerIndex = nextActivePlayerIndex(working, working.currentPlayerIndex);
      continue;
    }
    const next = passTurn(working, current.id);
    if (next === working) break;
    working = next;
  }
  room.gameState = cloneGameState(working);
}

function finalizeAwayPlayerRemoval(roomId, playerId) {
  const room = rooms[roomId];
  if (!room) return;

  const player = room.players.find((p) => p.id === playerId);
  if (!player || !player.disconnectedAt) return;

  console.log(`[Server] Grace period expired for ${player.name}, removing from room ${roomId}`);

  if (room.inGame && !player.isSpectator) {
    room.players = room.players.filter((p) => p.id !== playerId);
    const msg =
      player.awayReason === 'left'
        ? `${player.name} left and did not return. The game has ended.`
        : `${player.name} did not reconnect in time. The game has ended.`;
    abortOnlineGame(roomId, msg);
    return;
  }

  room.players = room.players.filter((p) => p.id !== playerId);

  if (room.host === playerId) {
    migrateHost(roomId);
  }

  io.to(roomId).emit('playerRemoved', {
    playerId,
    playerName: player.name,
    reason: player.awayReason || 'disconnected',
  });

  afterPlayerLeftRoom(roomId);
}

function scheduleAwayRemoval(roomId, playerId, graceMs) {
  cancelAwayRemoval(roomId, playerId);
  const key = `${roomId}:${playerId}`;
  const timer = setTimeout(() => {
    awayRemovalTimers.delete(key);
    finalizeAwayPlayerRemoval(roomId, playerId);
  }, graceMs);
  awayRemovalTimers.set(key, timer);
}

function markPlayerAway(roomId, player, reason = 'disconnected') {
  const room = rooms[roomId];
  if (!room || !player) return;
  if (player.disconnectedAt) return;

  const graceMs = room.inGame && !player.isSpectator
    ? inGameAwayGraceMs()
    : LOBBY_DISCONNECT_GRACE;

  player.disconnectedAt = Date.now();
  player.awayReason = reason;

  if (room.inGame && !player.isSpectator && room.gameState) {
    advancePastDisconnectedPlayers(room);
    broadcastGameState(io, room);
    io.to(roomId).emit('playerDisconnected', {
      playerId: player.id,
      playerName: player.name,
      gracePeriod: graceMs,
      reason,
      reconnectUntil: Date.now() + graceMs,
    });
  }

  io.to(roomId).emit('lobbyUpdate', buildLobbyUpdate(room));
  scheduleAwayRemoval(roomId, player.id, graceMs);

  if (room.isPublic) broadcastAvailableRooms();
}

function activePlayerCount(room) {
  return room.players.filter((p) => !p.disconnectedAt && !p.isSpectator).length;
}

function isRoundInProgress(room) {
  if (!room?.inGame || !room.gameState?.players?.length) return false;
  const living = room.gameState.players.filter(
    (p) => !p.isDeadHand && p.id !== '__dead_hand__',
  );
  if (living.length === 0) return false;
  const finished = room.gameState.finishedOrder || [];
  return !living.every((p) => finished.includes(p.id));
}

function roomListingPayload(roomId, room) {
  return {
    roomId,
    hostName: room.hostName,
    roomName: room.roomName || 'Game Room',
    playerCount: activePlayerCount(room),
    maxPlayers: 8,
    createdAt: room.createdAt,
    inGame: !!room.inGame,
    roundInProgress: isRoundInProgress(room),
    deadHandSeatOpen: deadHandSeatOpen(room),
    spectatorCount: spectatorCount(room),
  };
}

function isRoomListedPublic(room) {
  if (!room.isPublic) return false;
  if (room.inGame && activePlayerCount(room) > 0) return true;
  return activePlayerCount(room) > 0;
}

function removePlayerFromActiveGame(room, playerId) {
  const gs = room.gameState;
  if (!gs?.players) return;
  const idx = gs.players.findIndex((p) => p.id === playerId);
  if (idx < 0) return;

  const wasCurrent = gs.players[gs.currentPlayerIndex]?.id === playerId;
  gs.players = gs.players.filter((p) => p.id !== playerId);
  gs.finishedOrder = (gs.finishedOrder || []).filter((id) => id !== playerId);

  if (gs.players.length === 0) {
    room.inGame = false;
    room.gameState = null;
    return;
  }

  if (wasCurrent) {
    gs.currentPlayerIndex = gs.currentPlayerIndex % gs.players.length;
  } else if (idx < gs.currentPlayerIndex) {
    gs.currentPlayerIndex = Math.max(0, gs.currentPlayerIndex - 1);
  }
}

function clearEmptyRoomTimer(roomId) {
  if (emptyRoomTimers[roomId]) {
    clearTimeout(emptyRoomTimers[roomId]);
    delete emptyRoomTimers[roomId];
  }
}

function deleteRoom(roomId) {
  clearEmptyRoomTimer(roomId);
  if (rooms[roomId]) {
    delete rooms[roomId];
    console.log(`[Server] Room ${roomId} deleted`);
  }
}

function onRoomEmptied(roomId) {
  const room = rooms[roomId];
  if (!room) return;
  room.inGame = false;
  room.gameState = null;
  room.emptyAt = Date.now();
  console.log(`[Server] Room ${roomId} is empty — hidden from open games, rejoin by code allowed`);
  if (room.isPublic) broadcastAvailableRooms();
  clearEmptyRoomTimer(roomId);
  emptyRoomTimers[roomId] = setTimeout(() => {
    if (rooms[roomId] && rooms[roomId].players.length === 0) {
      deleteRoom(roomId);
      broadcastAvailableRooms();
    }
    delete emptyRoomTimers[roomId];
  }, EMPTY_ROOM_REJOIN_MS);
}

function buildLobbyUpdate(room) {
  return {
    players: room.players.map((p) => ({
      id: p.id,
      name: p.name,
      ready: p.ready,
      disconnected: !!p.disconnectedAt,
      isSpectator: !!p.isSpectator,
      feltTint: p.feltTint || DEFAULT_FELT_TINT,
    })),
    host: room.host,
    roomName: room.roomName || '',
    deadHandSeatOpen: deadHandSeatOpen(room),
    spectatorCount: spectatorCount(room),
  };
}

function afterPlayerLeftRoom(roomId) {
  const room = rooms[roomId];
  if (!room) return;
  if (room.players.length === 0) {
    onRoomEmptied(roomId);
    return;
  }
  io.to(roomId).emit('lobbyUpdate', buildLobbyUpdate(room));
  if (room.isPublic) broadcastAvailableRooms();
}

function getPlayerBySocket(room, socketId) {
  return room.players.find((p) => p.socketId === socketId);
}

function isRoomHost(room, socketId) {
  const player = getPlayerBySocket(room, socketId);
  return !!(
    player &&
    !player.disconnectedAt &&
    room.host === player.id
  );
}

function resolveProfileId(profileId, socket) {
  return profileId || socket.id;
}

function findReconnectPlayer(room, profileId, name) {
  if (profileId) {
    const byProfile = room.players.find(
      (p) => p.id === profileId || p.profileId === profileId,
    );
    if (byProfile) return byProfile;
  }
  if (name) {
    return room.players.find((p) => p.name === name && p.disconnectedAt);
  }
  return null;
}

function attachPlayerSocket(player, socket, name) {
  player.socketId = socket.id;
  player.disconnectedAt = null;
  if (name && player.name !== name) {
    player.name = name;
  }
}

function renamePlayerInGameState(gameState, playerId, newName) {
  if (!gameState) return;
  for (const p of gameState.players || []) {
    if (p.id === playerId) p.name = newName;
  }
  const patchActions = (actions) => {
    if (!Array.isArray(actions)) return;
    for (const action of actions) {
      if (action.playerId === playerId) action.playerName = newName;
    }
  };
  patchActions(gameState.currentTrick?.actions);
  for (const trick of gameState.trickHistory || []) {
    patchActions(trick.actions);
    if (trick.winnerId === playerId) trick.winnerName = newName;
  }
}

function applyPlayerDisplayName(room, player, newName) {
  if (!player || player.name === newName) return false;
  player.name = newName;
  if (room.host === player.id) {
    room.hostName = newName;
  }
  renamePlayerInGameState(room.gameState, player.id, newName);
  return true;
}

/** Drop a socket/profile from every room except keepRoomId; destroy abandoned host lobbies. */
function removeSocketFromOtherRooms(socket, profileId, keepRoomId) {
  let listChanged = false;

  for (const [roomId, room] of Object.entries(rooms)) {
    if (roomId === keepRoomId) continue;

    const player = room.players.find(
      (p) =>
        p.socketId === socket.id ||
        (profileId && (p.id === profileId || p.profileId === profileId)),
    );
    if (!player) continue;

    const wasCreator =
      room.creatorId === profileId ||
      room.creatorId === player.id ||
      room.creatorId === player.profileId;
    const wasHost = room.host === player.id;
    const lobbyOnly = !room.inGame;

    socket.leave(roomId);

    if (wasCreator && lobbyOnly) {
      console.log(
        `[Server] Destroying previous lobby ${roomId} — creator started a new room`,
      );
      io.to(roomId).emit('roomDismissed', { roomId });
      deleteRoom(roomId);
      listChanged = true;
      continue;
    }

    room.players = room.players.filter((p) => p.id !== player.id);

    io.to(roomId).emit('playerRemoved', {
      playerId: player.id,
      playerName: player.name,
      reason: 'left',
    });

    if (room.players.length === 0) {
      onRoomEmptied(roomId);
    } else {
      if (wasHost) {
        migrateHost(roomId);
      }
      afterPlayerLeftRoom(roomId);
    }
    listChanged = true;
  }

  if (listChanged) {
    broadcastAvailableRooms();
  }
}

// Host migration - transfer host to next available player
function migrateHost(roomId) {
  const room = rooms[roomId];
  if (!room || room.players.length === 0) return null;
  
  const newHost = room.players.find(p => p.socketId && !p.disconnectedAt);
  if (newHost) {
    const oldHost = room.host;
    room.host = newHost.id;
    room.hostName = newHost.name;
    console.log(`[Server] Host migrated in room ${roomId} from ${oldHost} to ${newHost.id} (${newHost.name})`);
    
    io.to(roomId).emit('hostMigrated', { 
      newHost: newHost.id, 
      newHostName: newHost.name 
    });
    
    return newHost;
  }
  return null;
}

/** End an in-progress online game for everyone — unfair to continue short-handed. */
function abortOnlineGame(roomId, message) {
  const room = rooms[roomId];
  if (!room) return;
  console.log(`[Server] Aborting online game in ${roomId}: ${message}`);
  for (const p of room.players) {
    cancelAwayRemoval(roomId, p.id);
  }
  room.inGame = false;
  room.gameState = null;
  io.to(roomId).emit('gameAborted', { roomId, message });
  deleteRoom(roomId);
  broadcastAvailableRooms();
}

// Legacy alias — lobby-only removal after grace (in-game uses markPlayerAway).
function schedulePlayerRemoval(roomId, playerId, _socketId, graceMs = LOBBY_DISCONNECT_GRACE) {
  scheduleAwayRemoval(roomId, playerId, graceMs);
}

// Broadcast available public rooms to all searching clients
function broadcastAvailableRooms() {
  const availableRooms = Object.entries(rooms)
    .filter(([_, room]) => isRoomListedPublic(room))
    .map(([roomId, room]) => roomListingPayload(roomId, room));
  
  io.emit('availableRooms', availableRooms);
}

io.on('connection', (socket) => {
  // log transport and origin for debugging client handshake issues
  const origin = socket.handshake && socket.handshake.headers ? socket.handshake.headers.origin : 'unknown';
  const transport = socket.conn && socket.conn.transport ? socket.conn.transport.name : 'unknown';
  console.log('conn', socket.id, 'transport:', transport, 'from', origin);

  // Send available rooms when client requests discovery
  socket.on('discoverRooms', () => {
    const availableRooms = Object.entries(rooms)
      .filter(([_, room]) => {
        if (!isRoomListedPublic(room)) return false;
        if (room.inGame && isRoundInProgress(room)) return true;
        return activePlayerCount(room) < 8;
      })
      .map(([roomId, room]) => roomListingPayload(roomId, room));
    
    socket.emit('availableRooms', availableRooms);
  });

  socket.on('createRoom', ({ roomId, name, profileId, isPublic = true, roomName, feltTint }) => {
    const pid = resolveProfileId(profileId, socket);
    const code = normalizeRoomCode(roomId);
    if (!isValidRoomCode(code)) {
      socket.emit('error', { message: 'Invalid room code.' });
      return;
    }
    if (rooms[code]) {
      socket.emit('error', { message: 'Room code already in use. Try again.' });
      return;
    }

    const nameCheck = validateDisplayText(name, 'Player name');
    if (!nameCheck.ok) {
      socket.emit('error', { message: nameCheck.reason });
      return;
    }

    const displayName = typeof roomName === 'string' ? roomName.trim() : '';
    const roomTitle = displayName || 'Game Room';
    const roomNameCheck = validateDisplayText(roomTitle, 'Room name');
    if (!roomNameCheck.ok) {
      socket.emit('error', { message: roomNameCheck.reason });
      return;
    }

    removeSocketFromOtherRooms(socket, pid, code);

    rooms[code] = {
      players: [],
      host: pid,
      creatorId: pid,
      hostName: nameCheck.value,
      roomName: roomNameCheck.value,
      createdAt: Date.now(),
      isPublic: isPublic,
      deadHand: false,
      gameState: null,
      inGame: false
    };
    rooms[code].players.push({
      id: pid,
      profileId: pid,
      name: nameCheck.value,
      socketId: socket.id,
      ready: false,
      disconnectedAt: null,
      feltTint: resolveFeltTint(feltTint),
    });
    socket.join(code);
    io.to(code).emit('lobbyUpdate', buildLobbyUpdate(rooms[code]));
    socket.emit('connected', { id: pid, profileId: pid, socketId: socket.id, name: nameCheck.value });
    if (isPublic) broadcastAvailableRooms();
  });

  socket.on('updateRoomName', ({ roomId, roomName }) => {
    const code = normalizeRoomCode(roomId);
    const room = rooms[code];
    if (!room || !isRoomHost(room, socket.id)) return;
    const trimmed = typeof roomName === 'string' ? roomName.trim() : '';
    if (!trimmed) return;
    const roomNameCheck = validateDisplayText(trimmed.slice(0, 64), 'Room name');
    if (!roomNameCheck.ok) {
      socket.emit('error', { message: roomNameCheck.reason });
      return;
    }
    room.roomName = roomNameCheck.value;
    io.to(code).emit('lobbyUpdate', buildLobbyUpdate(room));
    if (room.isPublic) broadcastAvailableRooms();
  });

  socket.on('updatePlayerName', ({ roomId, name }) => {
    const code = normalizeRoomCode(roomId);
    const room = rooms[code];
    if (!room) return;
    const player = getPlayerBySocket(room, socket.id);
    if (!player) return;
    const nameCheck = validateDisplayText(name, 'Player name');
    if (!nameCheck.ok) {
      socket.emit('error', { message: nameCheck.reason });
      return;
    }
    if (!applyPlayerDisplayName(room, player, nameCheck.value)) return;
    io.to(code).emit('lobbyUpdate', buildLobbyUpdate(room));
    if (room.inGame && room.gameState) {
      broadcastGameState(io, room);
    }
    if (room.isPublic) broadcastAvailableRooms();
  });

  socket.on('updatePlayerTheme', ({ roomId, feltTint }) => {
    const code = normalizeRoomCode(roomId);
    const room = rooms[code];
    if (!room) return;
    const player = getPlayerBySocket(room, socket.id);
    if (!player) return;
    player.feltTint = resolveFeltTint(feltTint);
    io.to(code).emit('lobbyUpdate', buildLobbyUpdate(room));
  });

  socket.on('joinRoom', ({ roomId, name, profileId, clientBuildId, feltTint }) => {
    const code = normalizeRoomCode(roomId);
    if (!rooms[code]) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }
    if (
      clientBuildId &&
      SERVER_BUILD_ID !== 'dev' &&
      clientBuildId !== SERVER_BUILD_ID
    ) {
      socket.emit('clientOutdated', {
        version: SERVER_APP_VERSION,
        buildId: SERVER_BUILD_ID,
      });
    }
    const nameCheck = validateDisplayText(name, 'Player name');
    if (!nameCheck.ok) {
      socket.emit('error', { message: nameCheck.reason });
      return;
    }
    const pid = resolveProfileId(profileId, socket);
    removeSocketFromOtherRooms(socket, pid, code);

    const room = rooms[code];
    clearEmptyRoomTimer(code);
    room.emptyAt = null;

    const existingPlayer = findReconnectPlayer(room, pid, nameCheck.value);
    let wasAway = false;
    
    if (existingPlayer) {
      console.log(`[Server] Player ${nameCheck.value} (${pid}) reconnecting to room ${code}`);
      wasAway = !!existingPlayer.disconnectedAt;
      cancelAwayRemoval(code, existingPlayer.id);
      attachPlayerSocket(existingPlayer, socket, nameCheck.value);
      delete existingPlayer.awayReason;
      if (feltTint) {
        existingPlayer.feltTint = resolveFeltTint(feltTint);
      }
      if (existingPlayer.id !== pid) {
        existingPlayer.id = pid;
        existingPlayer.profileId = pid;
      }
      
      if (room.hostName === existingPlayer.name || room.host === existingPlayer.id) {
        room.host = existingPlayer.id;
        room.hostName = existingPlayer.name;
      } else if (room.creatorId === existingPlayer.id) {
        room.host = existingPlayer.id;
        room.hostName = existingPlayer.name;
      }
    } else {
      const seated = activePlayerCount(room);
      if (!room.inGame && seated >= 8) {
        socket.emit('error', { message: 'Room is full' });
        return;
      }
      if (!room.inGame && seated >= 3) {
        socket.emit('error', { message: 'Room is full' });
        return;
      }
      if (room.inGame && seated >= 3) {
        socket.emit('error', { message: 'Game is full' });
        return;
      }
      const joinAsSpectator = shouldJoinAsSpectator(room);
      room.players.push({
        id: pid,
        profileId: pid,
        name: nameCheck.value,
        socketId: socket.id,
        ready: false,
        disconnectedAt: null,
        isSpectator: joinAsSpectator,
        feltTint: resolveFeltTint(feltTint),
      });
      if (joinAsSpectator) {
        console.log(`[Server] ${nameCheck.value} joined room ${code} as spectator (dead hand seat open)`);
      }
    }

    socket.join(code);
    const joined = room.players.find((p) => p.socketId === socket.id);
    io.to(code).emit('lobbyUpdate', buildLobbyUpdate(room));
    if (wasAway && room.inGame && joined && !joined.isSpectator) {
      io.to(code).emit('playerReconnected', {
        playerId: joined.id,
        playerName: joined.name,
      });
      broadcastGameState(io, room);
    }
    socket.emit('connected', {
      id: pid,
      profileId: pid,
      socketId: socket.id,
      name: nameCheck.value,
      isSpectator: !!joined?.isSpectator,
    });
    
    if (room.inGame && room.gameState?.players) {
      if (joined) {
        const { gameState, spectator } = viewForMember(room.gameState, joined);
        socket.emit('gameStateSync', { gameState, spectator });
        socket.emit('startGame', {
          players: room.gameState.players.map((p) => ({
            id: p.id,
            name: p.name,
          })),
          dealSeed: room.gameState.dealSeed,
          spectator,
        });
      }
    }
    
    if (room.isPublic) broadcastAvailableRooms();
  });

  socket.on('leaveRoom', ({ roomId }) => {
    if (!rooms[roomId]) return;
    const room = rooms[roomId];
    const leaving = room.players.find((p) => p.socketId === socket.id);
    if (!leaving) return;
    const wasHost = room.host === leaving.id;

    if (room.inGame && !leaving.isSpectator) {
      leaving.socketId = null;
      socket.leave(roomId);
      markPlayerAway(roomId, leaving, 'left');
      return;
    }

    io.to(roomId).emit('playerRemoved', {
      playerId: leaving.id,
      playerName: leaving.name,
      reason: 'left',
    });

    room.players = room.players.filter((p) => p.socketId !== socket.id);
    if (wasHost && room.players.length > 0) {
      migrateHost(roomId);
    }
    socket.leave(roomId);
    afterPlayerLeftRoom(roomId);
  });

  socket.on('dismissRoom', ({ roomId }) => {
    const room = rooms[roomId];
    if (!room) return;
    if (!isRoomHost(room, socket.id)) {
      socket.emit('error', { message: 'Only the host can dismiss this room' });
      return;
    }
    console.log(`[Server] Host dismissed room ${roomId}`);
    io.to(roomId).emit('roomDismissed', { roomId });
    deleteRoom(roomId);
    broadcastAvailableRooms();
  });

  socket.on('startGame', ({ roomId }) => {
    console.log('[Server] startGame requested for room:', roomId);
    if (!rooms[roomId]) {
      console.log('[Server] Room not found:', roomId);
      return;
    }
    // only host may start
    if (!isRoomHost(rooms[roomId], socket.id)) {
      console.log('[Server] Not host, cannot start. Host:', rooms[roomId].host, 'Requester:', socket.id);
      return;
    }
    // require at least 2 players
    const room = rooms[roomId];
    const seated = activePlayerCount(room);
    if (seated < 2) {
      console.log('[Server] Not enough players to start:', seated);
      socket.emit('error', { message: 'Need at least two players to start.' });
      return;
    }

    const guests = room.players.filter(
      (p) => !p.disconnectedAt && !p.isSpectator && p.id !== room.host,
    );
    if (guests.length > 0 && !guests.every((p) => p.ready)) {
      const readyCount = guests.filter((p) => p.ready).length;
      console.log('[Server] Not all guests ready:', readyCount, '/', guests.length);
      socket.emit('error', {
        message: `All players must be ready before starting (${readyCount}/${guests.length} ready).`,
      });
      return;
    }

    // Game already running — sync clients without redealing (late join / missed broadcast).
    if (room.inGame && room.gameState?.players) {
      console.log('[Server] startGame: room already in game, syncing clients');
      broadcastGameState(io, room);
      io.to(roomId).emit('startGame', {
        players: room.players.map((p) => ({ id: p.id, name: p.name })),
        dealSeed: room.gameState?.dealSeed,
      });
      return;
    }
    
    console.log('[Server] Starting game with players:', room.players.map(p => p.name));

    try {
      const dealSeed = Math.floor(Math.random() * 2147483647);
      beginAuthoritativeRound(room, dealSeed);
      room.inGame = true;
      broadcastGameState(io, room);
      io.to(roomId).emit('startGame', {
        players: room.players
          .filter((p) => !p.isSpectator)
          .map(p => ({ id: p.id, name: p.name })),
        hostId: room.host,
        dealSeed,
      });
      emitTradesCompleteIfReady(io, roomId, room.gameState, room.host);
      if (room.isPublic) broadcastAvailableRooms();
    } catch (err) {
      console.error('[Server] startGame failed:', err);
      room.inGame = false;
      room.gameState = null;
      socket.emit('error', { message: 'Failed to start game on server. Restart the server and try again.' });
    }
  });

  // Game action: play / pass / ten-rule — server is authoritative
  socket.on('gameAction', ({ roomId, action }) => {
    const room = rooms[roomId];
    if (!room || !room.inGame || !room.gameState?.players) return;

    if (action?.type === 'turnNudge') {
      const nudger = room.players.find(p => p.socketId === socket.id);
      if (!nudger) return;
      const target = room.players.find(p => p.id === action.targetPlayerId);
      if (!target) return;
      io.to(roomId).emit('turnNudge', {
        fromPlayerId: nudger.id,
        fromPlayerName: nudger.name,
        targetPlayerId: target.id,
        targetPlayerName: target.name,
      });
      return;
    }

    const pendingKeys = Object.keys(room.gameState.pendingTrades || {});
    if (pendingKeys.length > 0 && !allTradesComplete(room.gameState)) {
      socket.emit('error', { message: 'Complete role trades before playing' });
      return;
    }
    
    const player = room.players.find(p => p.socketId === socket.id);
    if (!player) return;
    if (player.disconnectedAt) {
      socket.emit('error', { message: 'Reconnect to continue playing' });
      return;
    }

    const working = cloneGameState(room.gameState);
    const currentId = working.players[working.currentPlayerIndex]?.id;
    if (player.id !== currentId) {
      socket.emit('error', { message: 'Not your turn' });
      return;
    }

    let next = working;
    if (action?.type === 'play') {
      if (action.playerId && action.playerId !== player.id) return;
      const before = working;
      next = playCards(working, player.id, action.cards || []);
      if (next === before) {
        socket.emit('error', { message: 'Invalid play' });
        return;
      }
      if (next.tenRulePending && action.tenRuleDirection) {
        next = setTenRuleDirection(next, action.tenRuleDirection);
      }
    } else if (action?.type === 'pass') {
      const before = working;
      next = passTurn(working, player.id);
      if (next === before) {
        socket.emit('error', { message: 'Cannot pass now' });
        return;
      }
    } else if (action?.type === 'tenRule') {
      if (!working.tenRulePending) {
        socket.emit('error', { message: 'No ten rule pending' });
        return;
      }
      next = setTenRuleDirection(working, action.direction);
    } else {
      return;
    }

    room.gameState = cloneGameState(next);
    room.gameState.readyForNextRound = room.gameState.readyForNextRound || {};
    advancePastInactiveSeats(room);
    broadcastGameState(io, room);

    if (isRoundComplete(room.gameState) && !room.gameState.tenRulePending) {
      const finishOrder = room.gameState.finishedOrder.slice();
      const hands = {};
      for (const p of room.gameState.players) {
        hands[p.id] = p.hand;
      }
      handleRoundFinished(roomId, finishOrder, hands);
    }
  });

  socket.on('requestGameState', ({ roomId }) => {
    const room = rooms[roomId];
    if (!room) {
      console.warn('[Server] requestGameState: room not found', roomId);
      return;
    }
    if (!room.inGame || !room.gameState?.players) {
      console.warn('[Server] requestGameState: no active game state', roomId, {
        inGame: room.inGame,
        hasPlayers: !!room.gameState?.players,
      });
      return;
    }
    const player = room.players.find(p => p.socketId === socket.id);
    if (!player) {
      console.warn('[Server] requestGameState: socket not in room', roomId, socket.id);
      return;
    }
    const { gameState, spectator } = viewForMember(room.gameState, player);
    socket.emit('gameStateSync', { gameState, spectator });
  });

  socket.on('roundFinished', ({ roomId, finishOrder, hands }) => {
    handleRoundFinished(roomId, finishOrder, hands);
  });

  function handleRoundFinished(roomId, finishOrder, hands) {
    const room = rooms[roomId];
    if (!room) return;
    if (!room.gameState) room.gameState = {};

    room.gameState.lastRoundOrder = livingFinishOrder(
      room.gameState,
      finishOrder || [],
    );
    const playersCount =
      livingPlayerCount(room.gameState) ||
      room.gameState.lastRoundOrder.length ||
      0;
    const roles = assignRolesFromFinishOrder(
      room.gameState,
      playersCount,
      room.gameState.lastRoundOrder,
    );

    initReadyForNextRound(room);
    room.gameState.roles = roles;

    io.to(roomId).emit('roundEnded', { finishOrder, roles });
    io.to(roomId).emit('playerReadyUpdate', {
      readyForNextRound: room.gameState.readyForNextRound,
    });
  }

  // Winner selects cards to send back to loser
  // payload: { roomId, selectedCardObjects: Card[] }
  socket.on('playerTradeSelection', ({ roomId, selectedCardObjects }) => {
    const room = rooms[roomId];
    if (!room || !room.gameState) return;
    const player = room.players.find(p => p.socketId === socket.id);
    if (!player) return;

    const playerHands = room.gameState.playerHands || {};
    const res = applyWinnerSelectedCards(room.gameState, playerHands, player.id, selectedCardObjects || []);
    if (!res.ok) {
      socket.emit('error', { message: res.message || 'Invalid trade selection' });
      return;
    }

    // Save updated hands back to gameState
    room.gameState.playerHands = playerHands;

    for (const p of room.gameState.players) {
      p.hand = playerHands[p.id] || p.hand;
    }

    io.to(roomId).emit('playerHandsUpdate', { playerHands });
    broadcastGameState(io, room);

    if (allTradesComplete(room.gameState)) {
      syncOpeningPlayerAfterTrades(room.gameState, room.host);
      io.to(roomId).emit('tradesComplete', { playerHands });
    }
  });

  // Player indicates they want to continue to next round
  socket.on('playerReadyForNextRound', ({ roomId }) => {
    const room = rooms[roomId];
    if (!room || !room.gameState) return;
    const player = room.players.find(p => p.socketId === socket.id);
    if (!player) return;
    const inRound = activeRoundPlayerIds(room).includes(player.id);
    const canSpectatorReady = player.isSpectator && gameHasDeadHandSlot(room);
    if (!inRound && !canSpectatorReady) return;
    room.gameState.readyForNextRound = room.gameState.readyForNextRound || {};
    room.gameState.readyForNextRound[player.id] = true;

    io.to(roomId).emit('playerReadyUpdate', { readyForNextRound: room.gameState.readyForNextRound });

    tryStartNextRoundIfReady(roomId);
  });

  socket.on('toggleReady', ({ roomId, ready }) => {
    if (!rooms[roomId]) return;
    const player = rooms[roomId].players.find(p => p.socketId === socket.id);
    if (!player) return;
    player.ready = !!ready;
    io.to(roomId).emit('lobbyUpdate', buildLobbyUpdate(rooms[roomId]));
  });

  socket.on('kickPlayer', ({ roomId, playerName }) => {
    if (!rooms[roomId]) return;
    const room = rooms[roomId];
    if (!isRoomHost(room, socket.id)) return;

    const playerToKick = room.players.find(p => p.name === playerName);
    if (!playerToKick) return;

    console.log('Host kicking player:', playerName);

    const wasHost = room.host === playerToKick.id;
    const kickedId = playerToKick.id;
    const kickedSocketId = playerToKick.socketId;

    if (room.inGame && !playerToKick.isSpectator) {
      room.players = room.players.filter(p => p.name !== playerName);
      const kickedSocket = io.sockets.sockets.get(kickedSocketId);
      if (kickedSocket) {
        kickedSocket.leave(roomId);
      }
      abortOnlineGame(
        roomId,
        `${playerToKick.name} was removed. The game has ended.`,
      );
      return;
    }

    io.to(roomId).emit('playerRemoved', {
      playerId: kickedId,
      playerName: playerToKick.name,
      reason: 'kicked',
    });

    room.players = room.players.filter(p => p.name !== playerName);

    io.to(kickedSocketId).emit('kicked', { message: 'You have been removed from the game' });

    const kickedSocket = io.sockets.sockets.get(kickedSocketId);
    if (kickedSocket) {
      kickedSocket.leave(roomId);
    }

    if (wasHost && room.players.length > 0) {
      migrateHost(roomId);
    }

    afterPlayerLeftRoom(roomId);
  });

  socket.on('disconnect', () => {
    console.log(`[Server] Socket ${socket.id} disconnected`);
    
    for (const [roomId, room] of Object.entries(rooms)) {
      const player = room.players.find(p => p.socketId === socket.id);
      
      if (player) {
        console.log(`[Server] Player ${player.name} disconnected from room ${roomId}`);
        player.socketId = null;
        markPlayerAway(roomId, player, 'disconnected');
      }
    }
  });
});

server.listen(PORT, () => console.log('Server listening on', PORT));
