"use strict";
// network.ts
// Minimal network adapter abstraction. We'll provide a MockAdapter for local testing
Object.defineProperty(exports, "__esModule", { value: true });
exports.MockAdapter = void 0;
class MockAdapter {
    constructor() {
        this.handlers = [];
        // simple in-memory rooms: roomId -> players
        this.rooms = {};
        // map roomId -> hostId
        this.hosts = {};
        // map roomId -> creation timestamp
        this.roomCreationTimes = {};
    }
    async connect() {
        // nothing
    }
    async disconnect() { }
    // create/join/leave/start are convenience helpers for tests
    createRoom(roomId, name) {
        const id = `host-${Date.now()}`;
        this.rooms[roomId] = [{ id, name, ready: false }];
        this.hosts[roomId] = id;
        this.roomCreationTimes[roomId] = Date.now();
        // emit connected to creator
        setTimeout(() => this.handlers.forEach((h) => h({ type: "state", state: { type: "connected", id, name } })), 10);
        this.emitLobby(roomId);
    }
    discoverRooms() {
        // Return all available rooms
        const availableRooms = Object.keys(this.rooms)
            .filter(roomId => this.rooms[roomId].length < 8)
            .map(roomId => {
            const host = this.rooms[roomId].find(p => p.id === this.hosts[roomId]);
            return {
                roomId,
                hostName: (host === null || host === void 0 ? void 0 : host.name) || "Unknown Host",
                playerCount: this.rooms[roomId].length,
                maxPlayers: 8,
                createdAt: this.roomCreationTimes[roomId] || Date.now()
            };
        });
        setTimeout(() => {
            this.handlers.forEach((h) => h({
                type: "state",
                state: { type: "availableRooms", rooms: availableRooms }
            }));
        }, 10);
    }
    joinRoom(roomId, name) {
        const id = `p-${Date.now()}`;
        this.rooms[roomId] = this.rooms[roomId] || [];
        this.rooms[roomId].push({ id, name, ready: false });
        setTimeout(() => this.handlers.forEach((h) => h({ type: "state", state: { type: "connected", id, name } })), 10);
        this.emitLobby(roomId);
    }
    leaveRoom(roomId, id) {
        if (!this.rooms[roomId])
            return;
        if (!id)
            return;
        this.rooms[roomId] = this.rooms[roomId].filter((p) => p.id !== id);
        if (this.hosts[roomId] === id) {
            // pick a new host if any
            const next = this.rooms[roomId][0];
            this.hosts[roomId] = next ? next.id : undefined;
        }
        this.emitLobby(roomId);
    }
    startGame(roomId) {
        const players = (this.rooms[roomId] || []).map((p) => p.name);
        // broadcast startGame event
        setTimeout(() => this.handlers.forEach((h) => h({ type: "state", state: { type: "startGame", players } })), 10);
    }
    toggleReady(roomId, id, ready) {
        const room = this.rooms[roomId];
        if (!room)
            return;
        const p = room.find((x) => x.id === id);
        if (!p)
            return;
        p.ready = !!ready;
        this.emitLobby(roomId);
    }
    send(ev) {
        // echo to handlers for testing for play/pass
        setTimeout(() => this.handlers.forEach((h) => h(ev)), 40);
    }
    on(event, cb) {
        if (event === "message")
            this.handlers.push(cb);
    }
    emitLobby(roomId) {
        const players = (this.rooms[roomId] || []).map((p) => ({ id: p.id, name: p.name, ready: !!p.ready }));
        const host = this.hosts[roomId];
        setTimeout(() => this.handlers.forEach((h) => h({ type: "state", state: { type: "lobby", players, host } })), 10);
    }
}
exports.MockAdapter = MockAdapter;
