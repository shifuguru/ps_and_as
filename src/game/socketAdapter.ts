// socketAdapter.ts
import { NetworkAdapter, NetworkEvent } from "./network";
import { io as socketIo } from "socket.io-client";

export class SocketAdapter implements NetworkAdapter {
  private socket: any = null;
  private handlers: ((ev: NetworkEvent) => void)[] = [];
  private shouldAutoJoin: boolean;

  constructor(private url: string, private roomId: string, private name: string, autoJoin: boolean = true) {
    this.shouldAutoJoin = autoJoin;
  }

  async connect() {
    try {
      console.log("[SocketAdapter] Connecting to:", this.url);
      this.socket = socketIo(this.url);
      
      this.socket.on("connect", () => {
        console.log("[SocketAdapter] Connected! Socket ID:", this.socket.id);
        // Only auto-join if specified (for createRoom/joinRoom, not for discovery)
        if (this.shouldAutoJoin) {
          this.socket.emit("joinRoom", { roomId: this.roomId, name: this.name });
        }
      });

      this.socket.on("lobbyUpdate", (data: any) => {
        console.log("[SocketAdapter] Received lobbyUpdate:", data);
        this.handlers.forEach((h) => h({ type: "state", state: { type: "lobby", players: data.players, host: data.host } }));
      });

      this.socket.on("startGame", (data: any) => {
        console.log("[SocketAdapter] Received startGame:", data);
        this.handlers.forEach((h) => h({ type: "state", state: { type: "startGame", players: data.players } }));
      });
      
      this.socket.on("connected", (data: any) => {
        console.log("[SocketAdapter] Received connected:", data);
        this.handlers.forEach((h) => h({ type: "state", state: { type: "connected", id: data.id, name: data.name } }));
      });

      this.socket.on("availableRooms", (rooms: any[]) => {
        console.log("[SocketAdapter] Received availableRooms:", rooms);
        this.handlers.forEach((h) => h({ type: "state", state: { type: "availableRooms", rooms } }));
      });

      this.socket.on("error", (data: any) => {
        console.warn("[SocketAdapter] Socket error:", data.message);
        this.handlers.forEach((h) => h({ type: "state", state: { type: "error", message: data.message } }));
      });

      this.socket.on("connect_error", (error: any) => {
        console.error("[SocketAdapter] Connection error:", error.message);
        this.handlers.forEach((h) => h({ type: "state", state: { type: "error", message: "Connection failed: " + error.message } }));
      });

      this.socket.on("disconnect", (reason: string) => {
        console.log("[SocketAdapter] Disconnected:", reason);
      });

      this.socket.on("kicked", (data: any) => {
        console.warn("[SocketAdapter] Kicked from room:", data.message);
        this.handlers.forEach((h) => h({ type: "state", state: { type: "kicked", message: data.message } }));
      });

      this.socket.on("hostMigrated", (data: any) => {
        console.log("[SocketAdapter] Host migrated to:", data.newHostName);
        this.handlers.forEach((h) => h({ type: "state", state: { type: "hostMigrated", newHost: data.newHost, newHostName: data.newHostName } }));
      });

      this.socket.on("playerDisconnected", (data: any) => {
        console.log("[SocketAdapter] Player disconnected:", data.playerName, "Grace period:", data.gracePeriod);
        this.handlers.forEach((h) => h({ type: "state", state: { type: "playerDisconnected", playerId: data.playerId, playerName: data.playerName, gracePeriod: data.gracePeriod } }));
      });

      this.socket.on("playerRemoved", (data: any) => {
        console.log("[SocketAdapter] Player removed:", data.playerName, "Reason:", data.reason);
        this.handlers.forEach((h) => h({ type: "state", state: { type: "playerRemoved", playerId: data.playerId, playerName: data.playerName, reason: data.reason } }));
      });

      this.socket.on("gameAction", (data: any) => {
        console.log("[SocketAdapter] Game action from", data.playerName, ":", data.action.type);
        this.handlers.forEach((h) => h({ type: "state", state: { type: "gameAction", playerId: data.playerId, playerName: data.playerName, action: data.action } }));
      });

      this.socket.on("gameStateSync", (data: any) => {
        console.log("[SocketAdapter] Received game state sync");
        this.handlers.forEach((h) => h({ type: "state", state: { type: "gameStateSync", gameState: data.gameState } }));
      });
    } catch (e) {
      console.warn("socket.io-client not available, falling back to MockAdapter", e);
    }
  }

  async disconnect() {
    if (this.socket) this.socket.disconnect();
  }

  send(ev: NetworkEvent) {
    if (!this.socket) return;
    // map local events to socket messages
    switch (ev.type) {
      case "play":
        this.socket.emit("play", ev);
        break;
      case "pass":
        this.socket.emit("pass", ev);
        break;
      default:
        break;
    }
  }

  createRoom(roomId: string, name: string) {
    if (!this.socket) return;
    console.log("[SocketAdapter] Creating room:", roomId, "with host:", name);
    this.socket.emit("createRoom", { roomId: name, name, isPublic: true, roomName: roomId });
  }

  discoverRooms() {
    if (!this.socket) {
      console.warn("[SocketAdapter] discoverRooms: socket not connected");
      return;
    }
    console.log("[SocketAdapter] Emitting discoverRooms...");
    this.socket.emit("discoverRooms");
  }

  joinRoom(roomId: string, name: string) {
    if (!this.socket) return;
    this.socket.emit("joinRoom", { roomId, name });
  }

  leaveRoom(roomId: string) {
    if (!this.socket) return;
    this.socket.emit("leaveRoom", { roomId });
  }

  startGame(roomId: string) {
    if (!this.socket) return;
    console.log("[SocketAdapter] Emitting startGame for roomId:", roomId);
    this.socket.emit("startGame", { roomId });
  }

  kickPlayer(roomId: string, playerName: string) {
    if (!this.socket) return;
    console.log("[SocketAdapter] Kicking player:", playerName, "from room:", roomId);
    this.socket.emit("kickPlayer", { roomId, playerName });
  }

  toggleReady(roomId: string, playerId: string, ready: boolean) {
    if (!this.socket) return;
    console.log("[SocketAdapter] Toggle ready:", ready, "for room:", roomId);
    this.socket.emit("toggleReady", { roomId, ready });
  }

  sendGameAction(roomId: string, action: any) {
    if (!this.socket) return;
    console.log("[SocketAdapter] Sending game action:", action.type);
    this.socket.emit("gameAction", { roomId, action });
  }

  requestGameState(roomId: string) {
    if (!this.socket) return;
    console.log("[SocketAdapter] Requesting game state sync for room:", roomId);
    this.socket.emit("requestGameState", { roomId });
  }

  on(_ev: "message", cb: (ev: NetworkEvent) => void) {
    this.handlers.push(cb);
  }
}
