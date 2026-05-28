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
} = require('./gameBridge');
const { viewForPlayer, broadcastGameState } = require('./gameStateView');

function cloneGameState(state) {
  return JSON.parse(JSON.stringify(state));
}

function isRoundComplete(state) {
  return (
    !!state &&
    Array.isArray(state.players) &&
    Array.isArray(state.finishedOrder) &&
    state.finishedOrder.length === state.players.length &&
    state.players.length > 0
  );
}

function beginAuthoritativeRound(room, dealSeed) {
  const lobbyPlayers = room.players.map((p) => ({ id: p.id, name: p.name }));
  const nextState = createGameFromLobby(lobbyPlayers, dealSeed);
  nextState.readyForNextRound = {};
  room.gameState = nextState;
}

const app = express();
app.use(cors({ origin: true, credentials: false }));

// Simple health endpoint
app.get('/', (req, res) => res.send('Server is running...\n'));

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

// Card rank order used server-side (mirrors client): low -> high
const RANK_ORDER = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 2, 15];
function rankIndex(value) {
  const idx = RANK_ORDER.indexOf(value);
  return idx >= 0 ? idx : -1;
}

function sortCardsByRankDesc(cards) {
  return cards.slice().sort((a, b) => rankIndex(b.value) - rankIndex(a.value));
}

// Assign roles based on finish order. Mutates gameState object.
function assignRolesFromFinishOrder(gameState, playersCount) {
  // gameState.lastRoundOrder expected: [winnerId, ..., loserId]
  const order = gameState.lastRoundOrder || [];
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
function prepareCardTrades(gameState, playerHands) {
  const roles = gameState.roles || {};
  const pending = {};

  // President <-> Asshole
  const presidentId = Object.keys(roles).find(k => roles[k] === 'president');
  const assholeId = Object.keys(roles).find(k => roles[k] === 'asshole');

  const playerCount = Object.keys(playerHands).length;

  if (presidentId && assholeId) {
    if (playerCount >= 5) {
      // Asshole gives 2 best, President must choose 2 to give back
      const fromHand = playerHands[assholeId] || [];
      const taken = sortCardsByRankDesc(fromHand).slice(0, 2);
      // remove taken from asshole hand
      playerHands[assholeId] = (fromHand || []).filter(c => !taken.find(t => t.suit === c.suit && t.value === c.value));
      pending.president = { fromId: assholeId, count: 2, incoming: taken, selected: null };
    } else {
      // 3-4 players: Asshole gives 1 best, President chooses 1 to return
      const fromHand = playerHands[assholeId] || [];
      const taken = sortCardsByRankDesc(fromHand).slice(0, 1);
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
    const taken = sortCardsByRankDesc(fromHand).slice(0, 1);
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

// Grace period for reconnection (60 seconds in-game, 2 minutes in lobby)
const DISCONNECT_GRACE_PERIOD = 60 * 1000;
const LOBBY_DISCONNECT_GRACE = 2 * 60 * 1000;
/** How long an empty room shell stays joinable by code before auto-delete. */
const EMPTY_ROOM_REJOIN_MS = 10 * 60 * 1000;
const emptyRoomTimers = {};

function activePlayerCount(room) {
  return room.players.filter((p) => !p.disconnectedAt).length;
}

function isRoomListedPublic(room) {
  return room.isPublic && activePlayerCount(room) > 0;
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

function afterPlayerLeftRoom(roomId) {
  const room = rooms[roomId];
  if (!room) return;
  if (room.players.length === 0) {
    onRoomEmptied(roomId);
    return;
  }
  io.to(roomId).emit('lobbyUpdate', {
    players: room.players.map((p) => ({
      id: p.id,
      name: p.name,
      ready: p.ready,
      disconnected: !!p.disconnectedAt,
    })),
    host: room.host,
  });
  if (room.isPublic) broadcastAvailableRooms();
}

function getPlayerBySocket(room, socketId) {
  return room.players.find((p) => p.socketId === socketId);
}

function isRoomHost(room, socketId) {
  const player = getPlayerBySocket(room, socketId);
  return !!(player && room.host === player.id);
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

// Remove player after grace period expires
function schedulePlayerRemoval(roomId, playerId, _socketId, graceMs = DISCONNECT_GRACE_PERIOD) {
  setTimeout(() => {
    const room = rooms[roomId];
    if (!room) return;
    
    const player = room.players.find(p => p.id === playerId);
    if (!player || !player.disconnectedAt) return;
    
    console.log(`[Server] Grace period expired for ${player.name}, removing from room ${roomId}`);
    
    room.players = room.players.filter(p => p.id !== playerId);
    
    if (room.host === playerId) {
      migrateHost(roomId);
    }
    
    io.to(roomId).emit('playerRemoved', { 
      playerId, 
      playerName: player.name,
      reason: 'disconnected'
    });
    
    afterPlayerLeftRoom(roomId);
  }, graceMs);
}

// Broadcast available public rooms to all searching clients
function broadcastAvailableRooms() {
  const availableRooms = Object.entries(rooms)
    .filter(([_, room]) => isRoomListedPublic(room))
    .map(([roomId, room]) => ({
      roomId,
      hostName: room.hostName,
      roomName: room.roomName || roomId,
      playerCount: activePlayerCount(room),
      maxPlayers: 8,
      createdAt: room.createdAt
    }));
  
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
      .filter(([_, room]) => isRoomListedPublic(room) && activePlayerCount(room) < 8)
      .map(([roomId, room]) => ({
        roomId,
        hostName: room.hostName,
        roomName: room.roomName || roomId,
        playerCount: activePlayerCount(room),
        maxPlayers: 8,
        createdAt: room.createdAt
      }));
    
    socket.emit('availableRooms', availableRooms);
  });

  socket.on('createRoom', ({ roomId, name, profileId, isPublic = true, roomName }) => {
    const pid = resolveProfileId(profileId, socket);
    rooms[roomId] = rooms[roomId] || { 
      players: [], 
      host: pid, 
      hostName: name,
      roomName: roomName || roomId,
      createdAt: Date.now(),
      isPublic: isPublic,
      gameState: null,
      inGame: false
    };
    rooms[roomId].players.push({ 
      id: pid,
      profileId: pid,
      name, 
      socketId: socket.id, 
      ready: false,
      disconnectedAt: null 
    });
    socket.join(roomId);
    io.to(roomId).emit('lobbyUpdate', { 
      players: rooms[roomId].players.map(p => ({ 
        id: p.id, 
        name: p.name, 
        ready: p.ready,
        disconnected: !!p.disconnectedAt 
      })), 
      host: rooms[roomId].host 
    });
    socket.emit('connected', { id: pid, profileId: pid, socketId: socket.id, name });
    if (isPublic) broadcastAvailableRooms();
  });

  socket.on('joinRoom', ({ roomId, name, profileId }) => {
    if (!rooms[roomId]) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }
    const room = rooms[roomId];
    const pid = resolveProfileId(profileId, socket);
    clearEmptyRoomTimer(roomId);
    room.emptyAt = null;

    const existingPlayer = findReconnectPlayer(room, pid, name);
    
    if (existingPlayer) {
      console.log(`[Server] Player ${name} (${pid}) reconnecting to room ${roomId}`);
      attachPlayerSocket(existingPlayer, socket, name);
      if (existingPlayer.id !== pid) {
        existingPlayer.id = pid;
        existingPlayer.profileId = pid;
      }
      
      if (rooms[roomId].hostName === existingPlayer.name || rooms[roomId].host === existingPlayer.id) {
        rooms[roomId].host = existingPlayer.id;
        rooms[roomId].hostName = existingPlayer.name;
      }
    } else {
      if (activePlayerCount(room) >= 8) {
        socket.emit('error', { message: 'Room is full' });
        return;
      }
      rooms[roomId].players.push({ 
        id: pid,
        profileId: pid,
        name, 
        socketId: socket.id, 
        ready: false,
        disconnectedAt: null 
      });
    }
    
    socket.join(roomId);
    io.to(roomId).emit('lobbyUpdate', { 
      players: rooms[roomId].players.map(p => ({ 
        id: p.id, 
        name: p.name, 
        ready: p.ready,
        disconnected: !!p.disconnectedAt 
      })), 
      host: rooms[roomId].host 
    });
    socket.emit('connected', { id: pid, profileId: pid, socketId: socket.id, name });
    
    if (rooms[roomId].inGame && rooms[roomId].gameState?.players) {
      const joined = rooms[roomId].players.find((p) => p.socketId === socket.id);
      if (joined) {
        socket.emit('gameStateSync', {
          gameState: viewForPlayer(rooms[roomId].gameState, joined.id),
        });
        socket.emit('startGame', {
          players: rooms[roomId].players.map((p) => ({ id: p.id, name: p.name })),
        });
      }
    }
    
    if (rooms[roomId].isPublic) broadcastAvailableRooms();
  });

  socket.on('leaveRoom', ({ roomId }) => {
    if (!rooms[roomId]) return;
    const room = rooms[roomId];
    const leaving = room.players.find((p) => p.socketId === socket.id);
    if (!leaving) return;
    const wasHost = room.host === leaving.id;
    room.players = room.players.filter((p) => p.socketId !== socket.id);
    if (wasHost && room.players.length > 0) {
      migrateHost(roomId);
    }
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
    if (room.players.length < 2) {
      console.log('[Server] Not enough players:', room.players.length);
      return;
    }

    // Game already running — sync clients without redealing (late join / missed broadcast).
    if (room.inGame && room.gameState?.players) {
      console.log('[Server] startGame: room already in game, syncing clients');
      broadcastGameState(io, room);
      io.to(roomId).emit('startGame', {
        players: room.players.map((p) => ({ id: p.id, name: p.name })),
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
        players: room.players.map(p => ({ id: p.id, name: p.name })),
      });
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
    
    const player = room.players.find(p => p.socketId === socket.id);
    if (!player) return;

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
    broadcastGameState(io, room);

    if (isRoundComplete(room.gameState)) {
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
    socket.emit('gameStateSync', {
      gameState: viewForPlayer(room.gameState, player.id),
    });
  });

  socket.on('roundFinished', ({ roomId, finishOrder, hands }) => {
    handleRoundFinished(roomId, finishOrder, hands);
  });

  function handleRoundFinished(roomId, finishOrder, hands) {
    const room = rooms[roomId];
    if (!room) return;
    if (!room.gameState) room.gameState = {};

    // Persist finish order and prepare roles
    room.gameState.lastRoundOrder = finishOrder || [];
    const playersCount = room.players.length;
    const roles = assignRolesFromFinishOrder(room.gameState, playersCount);

    // Use provided hands mapping (server expects clients to send reliable hands payload)
    const playerHands = hands || {};

    // Prepare trades (this will remove obligatory cards from losers and stash them for winners)
    const prep = prepareCardTrades(room.gameState, playerHands);
    room.gameState.playerHands = prep.playerHands;

    // Mark everyone as not-yet-ready for next round
    room.gameState.readyForNextRound = {};
    for (const p of room.players) room.gameState.readyForNextRound[p.id] = false;

    // Persist the hands and roles
    room.gameState.roles = roles;
    room.gameState.lastRoundOrder = finishOrder;

    // Emit roundEnded to all with finish order and roles
    io.to(roomId).emit('roundEnded', { finishOrder, roles });

    // Notify winners that trades have been prepared with their incoming cards and how many they must select
    const pending = room.gameState.pendingTrades || {};
    // Notify president
    if (pending.president) {
      const presId = Object.keys(roles).find(k => roles[k] === 'president');
      const presSocket = room.players.find(p => p.id === presId)?.socketId;
      if (presSocket) {
        io.to(presSocket).emit('roundTradesPrepared', { role: 'president', incoming: pending.president.incoming, selectCount: pending.president.count });
      }
    }
    if (pending.vicePresident) {
      const vpId = Object.keys(roles).find(k => roles[k] === 'vice_president');
      const vpSocket = room.players.find(p => p.id === vpId)?.socketId;
      if (vpSocket) {
        io.to(vpSocket).emit('roundTradesPrepared', { role: 'vice_president', incoming: pending.vicePresident.incoming, selectCount: pending.vicePresident.count });
      }
    }

    // Broadcast updated hands to room (losers have had their mandatory cards removed already)
    io.to(roomId).emit('playerHandsUpdate', { playerHands: room.gameState.playerHands });
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

    // Notify room about hands update
    io.to(roomId).emit('playerHandsUpdate', { playerHands });

    // If all trades are complete, emit tradesComplete
    if (allTradesComplete(room.gameState)) {
      io.to(roomId).emit('tradesComplete', { playerHands });
      // If everyone also already marked ready, start next round
      const readyMap = room.gameState.readyForNextRound || {};
      const allReady = Object.keys(readyMap).length > 0 && Object.values(readyMap).every(v => v === true);
      if (allReady) {
        startNextRound(roomId);
      }
    }
  });

  // Player indicates they want to continue to next round
  socket.on('playerReadyForNextRound', ({ roomId }) => {
    const room = rooms[roomId];
    if (!room || !room.gameState) return;
    const player = room.players.find(p => p.socketId === socket.id);
    if (!player) return;
    room.gameState.readyForNextRound = room.gameState.readyForNextRound || {};
    room.gameState.readyForNextRound[player.id] = true;

    io.to(roomId).emit('playerReadyUpdate', { readyForNextRound: room.gameState.readyForNextRound });

    // If all players are ready and trades complete, start next round
    const readyMap = room.gameState.readyForNextRound || {};
    const allReady = Object.keys(readyMap).length > 0 && Object.values(readyMap).every(v => v === true);
    const tradesDone = allTradesComplete(room.gameState);
    if (allReady && tradesDone) startNextRound(roomId);
  });

  // Helper: start next round (minimal server-driven state reset)
  function startNextRound(roomId) {
    const room = rooms[roomId];
    if (!room) return;
    const dealSeed = Math.floor(Math.random() * 2147483647);
    beginAuthoritativeRound(room, dealSeed);
    broadcastGameState(io, room);
    io.to(roomId).emit('nextRoundStarting', { dealSeed });
  }

  socket.on('toggleReady', ({ roomId, ready }) => {
    if (!rooms[roomId]) return;
    const player = rooms[roomId].players.find(p => p.socketId === socket.id);
    if (!player) return;
    player.ready = !!ready;
    io.to(roomId).emit('lobbyUpdate', { players: rooms[roomId].players.map(p => ({ id: p.id, name: p.name, ready: p.ready })), host: rooms[roomId].host });
  });

  socket.on('kickPlayer', ({ roomId, playerName }) => {
    if (!rooms[roomId]) return;
    // Only host can kick
    if (!isRoomHost(rooms[roomId], socket.id)) return;
    
    const playerToKick = rooms[roomId].players.find(p => p.name === playerName);
    if (!playerToKick) return;
    
    console.log('Host kicking player:', playerName);
    
    const wasHost = rooms[roomId].host === playerToKick.id;
    
    // Remove player from room
    rooms[roomId].players = rooms[roomId].players.filter(p => p.name !== playerName);
    
    // Notify the kicked player
    io.to(playerToKick.socketId).emit('kicked', { message: 'You have been removed from the game' });
    
    if (wasHost && rooms[roomId].players.length > 0) {
      migrateHost(roomId);
    }
    
    afterPlayerLeftRoom(roomId);
  });

  socket.on('disconnect', () => {
    console.log(`[Server] Socket ${socket.id} disconnected`);
    
    // Find all rooms this socket was in and mark as disconnected
    for (const [roomId, room] of Object.entries(rooms)) {
      const player = room.players.find(p => p.socketId === socket.id);
      
      if (player) {
        console.log(`[Server] Player ${player.name} disconnected from room ${roomId}`);
        
        // Mark as disconnected with timestamp
        player.disconnectedAt = Date.now();
        
        const wasHost = room.host === player.id;
        const wasPublic = room.isPublic;
        const graceMs = room.inGame ? DISCONNECT_GRACE_PERIOD : LOBBY_DISCONNECT_GRACE;
        
        if (room.inGame) {
          console.log(`[Server] Game in progress, giving ${player.name} grace period to reconnect`);
          
          io.to(roomId).emit('playerDisconnected', { 
            playerId: player.id,
            playerName: player.name,
            gracePeriod: graceMs
          });
          
          if (wasHost) {
            migrateHost(roomId);
          }
          
          io.to(roomId).emit('lobbyUpdate', { 
            players: room.players.map(p => ({ 
              id: p.id, 
              name: p.name, 
              ready: p.ready,
              disconnected: !!p.disconnectedAt 
            })), 
            host: room.host 
          });
          
          schedulePlayerRemoval(roomId, player.id, socket.id, graceMs);
        } else {
          console.log(`[Server] Lobby disconnect for ${player.name}, grace period before removal`);
          
          if (wasHost) {
            migrateHost(roomId);
          }
          
          io.to(roomId).emit('lobbyUpdate', { 
            players: room.players.map(p => ({ 
              id: p.id, 
              name: p.name, 
              ready: p.ready,
              disconnected: !!p.disconnectedAt 
            })), 
            host: room.host 
          });
          
          schedulePlayerRemoval(roomId, player.id, socket.id, graceMs);
        }
        
        if (wasPublic) broadcastAvailableRooms();
      }
    }
  });
});

server.listen(PORT, () => console.log('Server listening on', PORT));
