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
