import { NetworkAdapter, NetworkEvent } from "./network";
import { io as socketIo } from "socket.io-client";
import { Platform } from "react-native";
import { getServerUrl } from "../config/server";

export function isSocketAdapter(adapter: unknown): adapter is SocketAdapter {
  return (
    !!adapter &&
    typeof adapter === "object" &&
    (adapter as SocketAdapter).constructor?.name === "SocketAdapter"
  );
}

export class SocketAdapter implements NetworkAdapter {
  private socket: any = null;
  private handlers: ((ev: NetworkEvent) => void)[] = [];
  private shouldAutoJoin: boolean;
  private connectPromise: Promise<void> | null = null;
  private discoverQueued = false;

  constructor(
    private url: string | undefined,
    private roomId: string,
    private name: string,
    autoJoin: boolean = true,
  ) {
    this.shouldAutoJoin = autoJoin;
  }

  isConnected(): boolean {
    return !!this.socket?.connected;
  }

  private waitForConnect(timeoutMs = 15000): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.socket?.connected) {
        resolve();
        return;
      }
      if (!this.socket) {
        reject(new Error("Socket not initialized"));
        return;
      }

      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error("Connection timeout"));
      }, timeoutMs);

      const onConnect = () => {
        cleanup();
        resolve();
      };
      const onError = (error: Error) => {
        cleanup();
        reject(error);
      };

      const cleanup = () => {
        clearTimeout(timeout);
        this.socket.off("connect", onConnect);
        this.socket.off("connect_error", onError);
      };

      this.socket.once("connect", onConnect);
      this.socket.once("connect_error", onError);

      if (!this.socket.active) {
        this.socket.connect();
      }
    });
  }

  private flushDiscoverQueue() {
    if (!this.discoverQueued || !this.socket?.connected) return;
    this.discoverQueued = false;
    console.log("[SocketAdapter] Emitting discoverRooms...");
    this.socket.emit("discoverRooms");
  }

  async connect(): Promise<void> {
    if (this.socket?.connected) return;
    if (this.connectPromise) return this.connectPromise;

    this.connectPromise = (async () => {
      if (!this.socket) {
        const target = getServerUrl(this.url);
        console.log("[SocketAdapter] Connecting to:", target);

        this.socket = socketIo(target, {
          path: "/socket.io",
          // Web dev uses Metro proxy; polling-only avoids WS upgrade issues.
          transports:
            Platform.OS === "web" ? ["polling"] : ["polling", "websocket"],
          withCredentials: false,
          reconnection: true,
          reconnectionAttempts: Infinity,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 5000,
        });

        this.registerEventHandlers();

        this.socket.on("connect", () => {
          console.log("[SocketAdapter] Connected! Socket ID:", this.socket.id);
          if (this.shouldAutoJoin && this.roomId) {
            this.socket.emit("joinRoom", {
              roomId: this.roomId,
              name: this.name,
            });
          }
          this.flushDiscoverQueue();
        });

        this.socket.on("connect_error", (error: Error) => {
          console.error("[SocketAdapter] Connection error:", error.message);
          this.handlers.forEach((h) =>
            h({
              type: "state",
              state: {
                type: "error",
                message: "Connection failed: " + error.message,
              },
            }),
          );
        });
      }

      await this.waitForConnect();
    })();

    try {
      await this.connectPromise;
    } catch (e) {
      throw e;
    } finally {
      this.connectPromise = null;
    }
  }

  private registerEventHandlers() {
    if (!this.socket) return;

    this.socket.on("lobbyUpdate", (data: any) => {
      console.log("[SocketAdapter] Received lobbyUpdate:", data);
      this.handlers.forEach((h) =>
        h({
          type: "state",
          state: {
            type: "lobby",
            players: data.players,
            host: data.host,
          },
        }),
      );
    });

    this.socket.on("startGame", (data: any) => {
      console.log("[SocketAdapter] Received startGame:", data);
      this.handlers.forEach((h) =>
        h({
          type: "state",
          state: { type: "startGame", players: data.players },
        }),
      );
    });

    this.socket.on("connected", (data: any) => {
      console.log("[SocketAdapter] Received connected:", data);
      this.handlers.forEach((h) =>
        h({
          type: "state",
          state: { type: "connected", id: data.id, name: data.name },
        }),
      );
    });

    this.socket.on("availableRooms", (rooms: any[]) => {
      console.log("[SocketAdapter] Received availableRooms:", rooms);
      this.handlers.forEach((h) =>
        h({
          type: "state",
          state: { type: "availableRooms", rooms },
        }),
      );
    });

    this.socket.on("error", (data: any) => {
      console.warn("[SocketAdapter] Socket error:", data.message);
      this.handlers.forEach((h) =>
        h({
          type: "state",
          state: { type: "error", message: data.message },
        }),
      );
    });

    this.socket.on("disconnect", (reason: string) => {
      console.log("[SocketAdapter] Disconnected:", reason);
    });

    this.socket.on("kicked", (data: any) => {
      console.warn("[SocketAdapter] Kicked from room:", data.message);
      this.handlers.forEach((h) =>
        h({
          type: "state",
          state: { type: "kicked", message: data.message },
        }),
      );
    });

    this.socket.on("hostMigrated", (data: any) => {
      console.log("[SocketAdapter] Host migrated to:", data.newHostName);
      this.handlers.forEach((h) =>
        h({
          type: "state",
          state: {
            type: "hostMigrated",
            newHost: data.newHost,
            newHostName: data.newHostName,
          },
        }),
      );
    });

    this.socket.on("playerDisconnected", (data: any) => {
      this.handlers.forEach((h) =>
        h({
          type: "state",
          state: {
            type: "playerDisconnected",
            playerId: data.playerId,
            playerName: data.playerName,
            gracePeriod: data.gracePeriod,
          },
        }),
      );
    });

    this.socket.on("playerRemoved", (data: any) => {
      this.handlers.forEach((h) =>
        h({
          type: "state",
          state: {
            type: "playerRemoved",
            playerId: data.playerId,
            playerName: data.playerName,
            reason: data.reason,
          },
        }),
      );
    });

    this.socket.on("gameAction", (data: any) => {
      console.log(
        "[SocketAdapter] Game action from",
        data.playerName,
        ":",
        data.action.type,
      );
      this.handlers.forEach((h) =>
        h({
          type: "state",
          state: {
            type: "gameAction",
            playerId: data.playerId,
            playerName: data.playerName,
            action: data.action,
          },
        }),
      );
    });

    this.socket.on("gameStateSync", (data: any) => {
      this.handlers.forEach((h) =>
        h({
          type: "state",
          state: { type: "gameStateSync", gameState: data.gameState },
        }),
      );
    });

    this.socket.on("roundEnded", (data: any) => {
      this.handlers.forEach((h) =>
        h({
          type: "state",
          state: {
            type: "roundEnded",
            finishOrder: data.finishOrder,
            roles: data.roles,
            stats: data.stats,
          },
        }),
      );
    });

    this.socket.on("roundTradesPrepared", (data: any) => {
      this.handlers.forEach((h) =>
        h({
          type: "state",
          state: { type: "roundTradesPrepared", payload: data },
        }),
      );
    });

    this.socket.on("playerHandsUpdate", (data: any) => {
      this.handlers.forEach((h) =>
        h({
          type: "state",
          state: { type: "playerHandsUpdate", playerHands: data.playerHands },
        }),
      );
    });

    this.socket.on("tradesComplete", (data: any) => {
      this.handlers.forEach((h) =>
        h({
          type: "state",
          state: { type: "tradesComplete", playerHands: data.playerHands },
        }),
      );
    });

    this.socket.on("playerReadyUpdate", (data: any) => {
      this.handlers.forEach((h) =>
        h({
          type: "state",
          state: {
            type: "playerReadyUpdate",
            readyForNextRound: data.readyForNextRound,
          },
        }),
      );
    });

    this.socket.on("nextRoundStarting", (data: any) => {
      this.handlers.forEach((h) =>
        h({
          type: "state",
          state: { type: "nextRoundStarting", gameState: data.gameState },
        }),
      );
    });
  }

  async disconnect() {
    this.discoverQueued = false;
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.connectPromise = null;
  }

  send(ev: NetworkEvent) {
    if (!this.socket) return;
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

  createRoom(roomId: string, name: string, roomName?: string) {
    if (!this.socket?.connected) {
      console.warn("[SocketAdapter] createRoom: socket not connected");
      return;
    }
    console.log("[SocketAdapter] Creating room:", roomId, "with host:", name);
    this.socket.emit("createRoom", {
      roomId,
      name,
      isPublic: true,
      roomName: roomName || roomId,
    });
  }

  async discoverRooms(): Promise<void> {
    if (this.socket?.connected) {
      console.log("[SocketAdapter] Emitting discoverRooms...");
      this.socket.emit("discoverRooms");
      return;
    }

    this.discoverQueued = true;

    try {
      await this.connect();
    } catch {
      this.discoverQueued = false;
      console.warn("[SocketAdapter] discoverRooms: could not connect to server");
      return;
    }

    if (this.socket?.connected) {
      this.discoverQueued = false;
      console.log("[SocketAdapter] Emitting discoverRooms...");
      this.socket.emit("discoverRooms");
    }
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
    this.socket.emit("kickPlayer", { roomId, playerName });
  }

  toggleReady(roomId: string, _playerId: string, ready: boolean) {
    if (!this.socket) return;
    this.socket.emit("toggleReady", { roomId, ready });
  }

  sendGameAction(roomId: string, action: any) {
    if (!this.socket) return;
    console.log("[SocketAdapter] Sending game action:", action.type);
    this.socket.emit("gameAction", { roomId, action });
  }

  requestGameState(roomId: string) {
    if (!this.socket) return;
    this.socket.emit("requestGameState", { roomId });
  }

  on(_ev: "message", cb: (ev: NetworkEvent) => void) {
    this.handlers.push(cb);
  }

  emitEvent(eventName: string, data: any) {
    if (!this.socket) return;
    try {
      this.socket.emit(eventName, data);
    } catch (e) {
      console.warn("[SocketAdapter] emitEvent failed", e);
    }
  }
}
