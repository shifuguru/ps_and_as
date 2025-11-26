// Simple Socket.IO server for lobbies and game state
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors({ origin: true, credentials: true }));

// Simple health endpoint
app.get('/', (req, res) => res.send('Server is running...\n'));

const server = http.createServer(app);

// io instance with permissive CORS for clients on LAN/dev
const io = new Server(server, { cors: { origin: '*', credentials: true } });

// Debugging: log engine and socket connection errors to help diagnose websocket/xhr issues
io.engine.on && io.engine.on('connection_error', (err) => {
  console.error('[io.engine] connection_error:', err && err.message ? err.message : err);
});

io.on && io.on('connect_error', (err) => {
  console.error('[io] connect_error:', err && err.message ? err.message : err);
});

// PORT and HOST
const PORT = process.env.PORT || 3000;
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

// Grace period for reconnection (60 seconds)
const DISCONNECT_GRACE_PERIOD = 60 * 1000;

// Host migration - transfer host to next available player
function migrateHost(roomId) {
  const room = rooms[roomId];
  if (!room || room.players.length === 0) return null;
  
  // Find first connected player
  const newHost = room.players.find(p => p.socketId && !p.disconnectedAt);
  if (newHost) {
    const oldHost = room.host;
    room.host = newHost.socketId;
    room.hostName = newHost.name;
    console.log(`[Server] Host migrated in room ${roomId} from ${oldHost} to ${newHost.socketId} (${newHost.name})`);
    
    // Notify all players of new host
    io.to(roomId).emit('hostMigrated', { 
      newHost: newHost.socketId, 
      newHostName: newHost.name 
    });
    
    return newHost;
  }
  return null;
}

// Remove player after grace period expires
function schedulePlayerRemoval(roomId, playerId, socketId) {
  setTimeout(() => {
    const room = rooms[roomId];
    if (!room) return;
    
    const player = room.players.find(p => p.id === playerId);
    if (!player || !player.disconnectedAt) return; // Player reconnected
    
    console.log(`[Server] Grace period expired for ${player.name}, removing from room ${roomId}`);
    
    // Remove player
    room.players = room.players.filter(p => p.id !== playerId);
    
    // If was host, migrate
    if (room.host === socketId) {
      migrateHost(roomId);
    }
    
    // Notify remaining players
    io.to(roomId).emit('playerRemoved', { 
      playerId, 
      playerName: player.name,
      reason: 'disconnected'
    });
    
    // Update lobby
    io.to(roomId).emit('lobbyUpdate', { 
      players: room.players.map(p => ({ 
        id: p.id, 
        name: p.name, 
        ready: p.ready,
        disconnected: !!p.disconnectedAt 
      })), 
      host: room.host 
    });
    
    // Clean up empty rooms
    if (room.players.length === 0) {
      console.log(`[Server] Room ${roomId} is now empty, deleting`);
      delete rooms[roomId];
    }
    
    // Broadcast updated room list if public
    if (room.isPublic) broadcastAvailableRooms();
  }, DISCONNECT_GRACE_PERIOD);
}

// Broadcast available public rooms to all searching clients
function broadcastAvailableRooms() {
  const availableRooms = Object.entries(rooms)
    .filter(([_, room]) => room.isPublic && room.players.length < 8)
    .map(([roomId, room]) => ({
      roomId,
      hostName: room.hostName,
      roomName: room.roomName || roomId,
      playerCount: room.players.length,
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
      .filter(([_, room]) => room.isPublic && room.players.length < 8)
      .map(([roomId, room]) => ({
        roomId,
        hostName: room.hostName,
        roomName: room.roomName || roomId,
        playerCount: room.players.length,
        maxPlayers: 8,
        createdAt: room.createdAt
      }));
    
    socket.emit('availableRooms', availableRooms);
  });

  socket.on('createRoom', ({ roomId, name, isPublic = true, roomName }) => {
    rooms[roomId] = rooms[roomId] || { 
      players: [], 
      host: socket.id, 
      hostName: name,
      roomName: roomName || roomId,
      createdAt: Date.now(),
      isPublic: isPublic,
      gameState: null,
      inGame: false
    };
    rooms[roomId].players.push({ 
      id: socket.id, 
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
    // notify creator of their id
    socket.emit('connected', { id: socket.id, name });
    // broadcast updated room list
    if (isPublic) broadcastAvailableRooms();
  });

  socket.on('joinRoom', ({ roomId, name }) => {
    if (!rooms[roomId]) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }
    if (rooms[roomId].players.length >= 8) {
      socket.emit('error', { message: 'Room is full' });
      return;
    }
    
    // Check if this is a reconnection (same name as disconnected player)
    const existingPlayer = rooms[roomId].players.find(p => p.name === name && p.disconnectedAt);
    
    if (existingPlayer) {
      console.log(`[Server] Player ${name} reconnecting to room ${roomId}`);
      existingPlayer.socketId = socket.id;
      existingPlayer.id = socket.id;
      existingPlayer.disconnectedAt = null;
      
      // If they were host, restore host status
      if (rooms[roomId].host !== socket.id && rooms[roomId].hostName === name) {
        console.log(`[Server] Restoring host status to reconnected player ${name}`);
        rooms[roomId].host = socket.id;
      }
    } else {
      // New player joining
      rooms[roomId].players.push({ 
        id: socket.id, 
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
    socket.emit('connected', { id: socket.id, name });
    
    // If game is in progress, send current game state to reconnected player
    if (rooms[roomId].inGame && rooms[roomId].gameState) {
      socket.emit('gameStateSync', { gameState: rooms[roomId].gameState });
    }
    
    // broadcast updated room list
    if (rooms[roomId].isPublic) broadcastAvailableRooms();
  });

  socket.on('leaveRoom', ({ roomId }) => {
    if (!rooms[roomId]) return;
    const wasPublic = rooms[roomId].isPublic;
    rooms[roomId].players = rooms[roomId].players.filter(p => p.socketId !== socket.id);
    io.to(roomId).emit('lobbyUpdate', { players: rooms[roomId].players.map(p => ({ id: p.id, name: p.name, ready: p.ready })), host: rooms[roomId].host });
    // broadcast updated room list
    if (wasPublic) broadcastAvailableRooms();
  });

  socket.on('startGame', ({ roomId }) => {
    console.log('[Server] startGame requested for room:', roomId);
    if (!rooms[roomId]) {
      console.log('[Server] Room not found:', roomId);
      return;
    }
    // only host may start
    if (rooms[roomId].host !== socket.id) {
      console.log('[Server] Not host, cannot start. Host:', rooms[roomId].host, 'Requester:', socket.id);
      return;
    }
    // require at least 2 players
    const room = rooms[roomId];
    if (room.players.length < 2) {
      console.log('[Server] Not enough players:', room.players.length);
      return;
    }
    
    console.log('[Server] Starting game with players:', room.players.map(p => p.name));
    
    // Mark room as in-game
    room.inGame = true;
    
    // Initialize server-side game state (just track player names for now)
    // The actual game logic runs on clients, but server validates and syncs
    room.gameState = {
      playerNames: room.players.map(p => p.name),
      started: true,
      startedAt: Date.now()
    };
    
    io.to(roomId).emit('startGame', { 
      players: room.players.map(p => p.name) 
    });
  });

  // Game action: play cards
  socket.on('gameAction', ({ roomId, action }) => {
    const room = rooms[roomId];
    if (!room || !room.inGame) return;
    
    const player = room.players.find(p => p.socketId === socket.id);
    if (!player) return;
    
    console.log(`[Server] Game action from ${player.name} in room ${roomId}:`, action.type);
    
    // Server validates and broadcasts action to all players
    // This ensures all clients stay synchronized
    io.to(roomId).emit('gameAction', {
      playerId: player.id,
      playerName: player.name,
      action
    });
  });

  // Client requests full game state sync
  socket.on('requestGameState', ({ roomId }) => {
    const room = rooms[roomId];
    if (!room) return;
    
    if (room.inGame && room.gameState) {
      socket.emit('gameStateSync', { gameState: room.gameState });
    }
  });

  // Round finished reported by a client (clients detect finish and notify server)
  // payload: { roomId, finishOrder: [playerId...], hands: { [playerId]: Card[] } }
  socket.on('roundFinished', ({ roomId, finishOrder, hands }) => {
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
  });

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
    // Clear per-round metadata but keep players and their current hands
    if (room.gameState) {
      room.gameState.lastRoundOrder = [];
      room.gameState.roles = {};
      room.gameState.pendingTrades = {};
      room.gameState.readyForNextRound = {};
      // Keep playerHands as-is — clients may reshuffle/deal locally or server may implement dealing later
    }
    io.to(roomId).emit('nextRoundStarting', { gameState: room.gameState });
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
    if (rooms[roomId].host !== socket.id) return;
    
    const playerToKick = rooms[roomId].players.find(p => p.name === playerName);
    if (!playerToKick) return;
    
    console.log('Host kicking player:', playerName);
    
    // Remove player from room
    rooms[roomId].players = rooms[roomId].players.filter(p => p.name !== playerName);
    
    // Notify the kicked player
    io.to(playerToKick.socketId).emit('kicked', { message: 'You have been removed from the game' });
    
    // Update lobby for remaining players
    io.to(roomId).emit('lobbyUpdate', { players: rooms[roomId].players.map(p => ({ id: p.id, name: p.name, ready: p.ready })), host: rooms[roomId].host });
    
    // Broadcast updated room list if public
    if (rooms[roomId].isPublic) broadcastAvailableRooms();
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
        
        const wasHost = room.host === socket.id;
        const wasPublic = room.isPublic;
        
        // If in game, give grace period for reconnection
        if (room.inGame) {
          console.log(`[Server] Game in progress, giving ${player.name} grace period to reconnect`);
          
          // Notify other players
          io.to(roomId).emit('playerDisconnected', { 
            playerId: player.id,
            playerName: player.name,
            gracePeriod: DISCONNECT_GRACE_PERIOD
          });
          
          // Update lobby to show disconnected status
          io.to(roomId).emit('lobbyUpdate', { 
            players: room.players.map(p => ({ 
              id: p.id, 
              name: p.name, 
              ready: p.ready,
              disconnected: !!p.disconnectedAt 
            })), 
            host: room.host 
          });
          
          // If host disconnected, migrate immediately but keep player in game
          if (wasHost) {
            migrateHost(roomId);
          }
          
          // Schedule removal after grace period
          schedulePlayerRemoval(roomId, player.id, socket.id);
        } else {
          // Not in game, remove immediately
          room.players = room.players.filter(p => p.socketId !== socket.id);
          
          if (wasHost && room.players.length > 0) {
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
          
          // Clean up empty rooms
          if (room.players.length === 0) {
            console.log(`[Server] Room ${roomId} is now empty, deleting`);
            delete rooms[roomId];
          }
        }
        
        // broadcast updated room list if affected a public room
        if (wasPublic) broadcastAvailableRooms();
      }
    }
  });
});

server.listen(PORT, () => console.log('Server listening on', PORT));
