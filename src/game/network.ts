// network.ts
// Minimal network adapter abstraction. We'll provide a MockAdapter for local testing

export type NetworkEvent =
  | { type: "state"; state: any }
  | { type: "player_join"; id: string; name: string }
  | { type: "player_leave"; id: string }
  | { type: "play"; playerId: string; cards: any[] }
  | { type: "pass"; playerId: string };

export interface NetworkAdapter {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  send(event: NetworkEvent): void;
  on(event: "message", cb: (ev: NetworkEvent) => void): void;
}

export interface Player {
  id: string;
  name: string;
  ready?: boolean;
}

export class MockAdapter implements NetworkAdapter {
  private handlers: ((ev: NetworkEvent) => void)[] = [];
  // simple in-memory rooms: roomId -> players
  private rooms: Record<string, Player[]> = {};
  // map roomId -> hostId
  private hosts: Record<string, string> = {};
  // map roomId -> creation timestamp
  private roomCreationTimes: Record<string, number> = {};

  async connect() {
    // nothing
  }
  async disconnect() {}

  // create/join/leave/start are convenience helpers for tests
  createRoom(roomId: string, name: string) {
    const id = `host-${Date.now()}`;
    this.rooms[roomId] = [{ id, name, ready: false } as any];
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
          hostName: host?.name || "Unknown Host",
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

  joinRoom(roomId: string, name: string) {
    const id = `p-${Date.now()}`;
    this.rooms[roomId] = this.rooms[roomId] || [];
    this.rooms[roomId].push({ id, name, ready: false } as any);
    setTimeout(() => this.handlers.forEach((h) => h({ type: "state", state: { type: "connected", id, name } })), 10);
    this.emitLobby(roomId);
  }

  leaveRoom(roomId: string, id?: string) {
    if (!this.rooms[roomId]) return;
    if (!id) return;
    this.rooms[roomId] = this.rooms[roomId].filter((p) => p.id !== id);
    if (this.hosts[roomId] === id) {
      // pick a new host if any
      const next = this.rooms[roomId][0];
      this.hosts[roomId] = next ? next.id : undefined as any;
    }
    this.emitLobby(roomId);
  }

  startGame(roomId: string) {
    const players = (this.rooms[roomId] || []).map((p) => p.name);
    // broadcast startGame event
    setTimeout(() => this.handlers.forEach((h) => h({ type: "state", state: { type: "startGame", players } })), 10);
  }

  toggleReady(roomId: string, id: string, ready: boolean) {
    const room = this.rooms[roomId];
    if (!room) return;
    const p = room.find((x: any) => x.id === id);
    if (!p) return;
    p.ready = !!ready;
    this.emitLobby(roomId);
  }

  send(ev: NetworkEvent) {
    // echo to handlers for testing for play/pass
    setTimeout(() => this.handlers.forEach((h) => h(ev)), 40);
  }

  on(event: "message", cb: (ev: NetworkEvent) => void) {
    if (event === "message") this.handlers.push(cb);
  }

  private emitLobby(roomId: string) {
    const players = (this.rooms[roomId] || []).map((p) => ({ id: p.id, name: p.name, ready: !!(p as any).ready }));
    const host = this.hosts[roomId];
    setTimeout(() => this.handlers.forEach((h) => h({ type: "state", state: { type: "lobby", players, host } })), 10);
  }
}
