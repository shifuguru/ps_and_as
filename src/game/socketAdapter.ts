// socketAdapter.ts
import { NetworkAdapter, NetworkEvent } from "./network";

export class SocketAdapter implements NetworkAdapter {
  private socket: any = null;
  private handlers: ((ev: NetworkEvent) => void)[] = [];

  constructor(private url: string, private roomId: string, private name: string) {}

  async connect() {
    try {
      // dynamic require so client can still run without socket.io-client installed
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const io = require("socket.io-client");
      this.socket = io(this.url);
      this.socket.on("connect", () => {
        this.socket.emit("joinRoom", { roomId: this.roomId, name: this.name });
      });

      this.socket.on("lobbyUpdate", (data: any) => {
        this.handlers.forEach((h) => h({ type: "state", state: { type: "lobby", players: data.players, host: data.host } }));
      });

      this.socket.on("startGame", (data: any) => {
        this.handlers.forEach((h) => h({ type: "state", state: { type: "startGame", players: data.players } }));
      });
      this.socket.on("connected", (data: any) => {
        this.handlers.forEach((h) => h({ type: "state", state: { type: "connected", id: data.id, name: data.name } }));
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
    this.socket.emit("createRoom", { roomId, name });
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
    this.socket.emit("startGame", { roomId });
  }

  on(_ev: "message", cb: (ev: NetworkEvent) => void) {
    this.handlers.push(cb);
  }
}
