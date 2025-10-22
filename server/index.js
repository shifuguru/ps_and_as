// Simple Socket.IO server for lobbies
const http = require('http');
const { Server } = require('socket.io');

const PORT = process.env.PORT || 3000;
const server = http.createServer();
const io = new Server(server, {
  cors: { origin: '*' }
});

// Simple room-based lobby
// rooms: roomId -> { players: [{id,name,socketId,ready}], host }
const rooms = {};

io.on('connection', (socket) => {
  console.log('conn', socket.id);

  socket.on('createRoom', ({ roomId, name }) => {
    rooms[roomId] = rooms[roomId] || { players: [], host: socket.id };
    rooms[roomId].players.push({ id: socket.id, name, socketId: socket.id, ready: false });
    socket.join(roomId);
    io.to(roomId).emit('lobbyUpdate', { players: rooms[roomId].players.map(p => ({ id: p.id, name: p.name, ready: p.ready })), host: rooms[roomId].host });
    // notify creator of their id
    socket.emit('connected', { id: socket.id, name });
  });

  socket.on('joinRoom', ({ roomId, name }) => {
    rooms[roomId] = rooms[roomId] || { players: [], host: socket.id };
    rooms[roomId].players.push({ id: socket.id, name, socketId: socket.id, ready: false });
    socket.join(roomId);
    io.to(roomId).emit('lobbyUpdate', { players: rooms[roomId].players.map(p => ({ id: p.id, name: p.name, ready: p.ready })), host: rooms[roomId].host });
    socket.emit('connected', { id: socket.id, name });
  });

  socket.on('leaveRoom', ({ roomId }) => {
    if (!rooms[roomId]) return;
    rooms[roomId].players = rooms[roomId].players.filter(p => p.socketId !== socket.id);
    io.to(roomId).emit('lobbyUpdate', { players: rooms[roomId].players.map(p => ({ id: p.id, name: p.name, ready: p.ready })), host: rooms[roomId].host });
  });

  socket.on('startGame', ({ roomId }) => {
    if (!rooms[roomId]) return;
    // only host may start
    if (rooms[roomId].host !== socket.id) return;
    // require at least 2 players and all ready
    const room = rooms[roomId];
    if (room.players.length < 2) return;
    const allReady = room.players.every(p => p.ready === true);
    if (!allReady) return;
    io.to(roomId).emit('startGame', { players: room.players.map(p => p.name) });
  });

  socket.on('toggleReady', ({ roomId, ready }) => {
    if (!rooms[roomId]) return;
    const player = rooms[roomId].players.find(p => p.socketId === socket.id);
    if (!player) return;
    player.ready = !!ready;
    io.to(roomId).emit('lobbyUpdate', { players: rooms[roomId].players.map(p => ({ id: p.id, name: p.name, ready: p.ready })), host: rooms[roomId].host });
  });

  socket.on('disconnect', () => {
    // remove from any rooms
    for (const [roomId, room] of Object.entries(rooms)) {
      room.players = room.players.filter(p => p.socketId !== socket.id);
      io.to(roomId).emit('lobbyUpdate', { players: room.players.map(p => ({ id: p.id, name: p.name })) });
    }
  });
});

server.listen(PORT, () => console.log('Server listening on', PORT));
