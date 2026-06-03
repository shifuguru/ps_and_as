import { NetworkAdapter, NetworkEvent } from "./network";
import { io as socketIo } from "socket.io-client";
import { Platform } from "react-native";
import { getServerUrl } from "../config/server";
import { CLIENT_BUILD_ID } from "../config/buildVersion";
import { DEFAULT_FELT_COLOR } from "../services/wallpaper";
import { normalizeRoomCode } from "../utils/roomCode";

export function isSocketAdapter(adapter: unknown): adapter is SocketAdapter {
  return (
    !!adapter &&
    typeof adapter === "object" &&
    typeof (adapter as SocketAdapter).joinRoom === "function" &&
    typeof (adapter as SocketAdapter).dismissRoom === "function"
  );
}

export class SocketAdapter implements NetworkAdapter {
  private socket: any = null;
  private handlers: ((ev: NetworkEvent) => void)[] = [];
  private shouldAutoJoin: boolean;
  private connectPromise: Promise<void> | null = null;
  private discoverQueued = false;
  private cachedGameState: unknown = null;
  private cachedTradesComplete: Record<string, unknown> | null = null;
  private cachedDealSeed: number | undefined;
  /** Room the client belongs to — used to rejoin after socket reconnect. */
  private activeRoomId: string | null = null;
  private cachedHostId: string | null = null;
  private cachedSkipDealAnimations = false;
  private feltTint: string = DEFAULT_FELT_COLOR;

  constructor(
    private url: string | undefined,
    private roomId: string,
    private name: string,
    private profileId: string,
    autoJoin: boolean = true,
    feltTint: string = DEFAULT_FELT_COLOR,
  ) {
    this.shouldAutoJoin = autoJoin;
    this.feltTint = feltTint;
    if (roomId) {
      this.activeRoomId = roomId;
    }
  }

  getFeltTint(): string {
    return this.feltTint;
  }

  setFeltTint(tint: string) {
    this.feltTint = tint;
  }

  getProfileId(): string {
    return this.profileId;
  }

  getHostId(): string | null {
    return this.cachedHostId;
  }

  getSkipDealAnimations(): boolean {
    return this.cachedSkipDealAnimations;
  }

  getActiveRoomId(): string | null {
    return this.activeRoomId;
  }

  setActiveRoomId(roomId: string) {
    this.activeRoomId = roomId;
    this.roomId = roomId;
  }

  /** Drop room membership locally so reconnect does not auto-rejoin. */
  clearRoomSession() {
    this.activeRoomId = null;
    this.roomId = "";
    this.shouldAutoJoin = false;
    this.clearCachedGameState();
  }

  private rejoinActiveRoom() {
    const targetRoomId = this.activeRoomId || this.roomId;
    if (!targetRoomId || !this.socket?.connected) return;
    console.log("[SocketAdapter] Rejoining room after reconnect:", targetRoomId);
    this.socket.emit("joinRoom", {
      roomId: targetRoomId,
      name: this.name,
      profileId: this.profileId,
      clientBuildId: CLIENT_BUILD_ID,
      feltTint: this.feltTint,
    });
  }

  isConnected(): boolean {
    return !!this.socket?.connected;
  }

  /** Last authoritative snapshot from the server (survives screen transitions). */
  getCachedGameState(): unknown {
    return this.cachedGameState;
  }

  getCachedTradesComplete(): Record<string, unknown> | null {
    return this.cachedTradesComplete;
  }

  getCachedDealSeed(): number | undefined {
    return this.cachedDealSeed;
  }

  clearCachedGameState() {
    this.cachedGameState = null;
  }

  clearCachedTradesComplete() {
    this.cachedTradesComplete = null;
  }

  clearCachedDealSeed() {
    this.cachedDealSeed = undefined;
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

  private emitRegisterPresence() {
    if (!this.socket?.connected) return;
    const profileId = this.profileId?.trim();
    if (profileId) {
      this.socket.emit("registerPresence", { profileId });
      return;
    }
    void (async () => {
      try {
        const { getOrCreatePlayerId } = await import("../services/gameCenter");
        const profile = await getOrCreatePlayerId();
        this.profileId = profile.id;
        if (this.socket?.connected) {
          this.socket.emit("registerPresence", { profileId: profile.id });
        }
      } catch {
        if (this.socket?.connected) {
          this.socket.emit("registerPresence", {});
        }
      }
    })();
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
          if (this.activeRoomId || this.roomId) {
            this.rejoinActiveRoom();
          } else if (this.shouldAutoJoin && this.roomId) {
            this.rejoinActiveRoom();
          }
          this.flushDiscoverQueue();
          this.emitRegisterPresence();
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
      if (data?.host) {
        this.cachedHostId = data.host;
      }
      if (typeof data?.skipDealAnimations === "boolean") {
        this.cachedSkipDealAnimations = data.skipDealAnimations;
      }
      this.handlers.forEach((h) =>
        h({
          type: "state",
          state: {
            type: "lobby",
            players: data.players,
            host: data.host,
            roomName: data.roomName,
            skipDealAnimations: !!data.skipDealAnimations,
            deadHandSeatOpen: !!data.deadHandSeatOpen,
            spectatorCount: data.spectatorCount ?? 0,
          },
        }),
      );
    });

    this.socket.on("startGame", (data: any) => {
      console.log("[SocketAdapter] Received startGame:", data);
      if (data?.hostId) {
        this.cachedHostId = data.hostId;
      }
      if (typeof data?.skipDealAnimations === "boolean") {
        this.cachedSkipDealAnimations = data.skipDealAnimations;
      }
      if (typeof data?.dealSeed === "number") {
        this.cachedDealSeed = data.dealSeed;
      }
      const players = Array.isArray(data?.players)
        ? data.players.map((p: any) =>
            typeof p === "string" ? { id: p, name: p } : p,
          )
        : [];
      this.handlers.forEach((h) =>
        h({
          type: "state",
          state: {
            type: "startGame",
            players,
            dealSeed: data?.dealSeed,
            skipDealAnimations: !!data?.skipDealAnimations,
            spectator: !!data?.spectator,
          },
        }),
      );
    });

    this.socket.on("connected", (data: any) => {
      console.log("[SocketAdapter] Received connected:", data);
      this.handlers.forEach((h) =>
        h({
          type: "state",
          state: {
            type: "connected",
            id: data.id,
            name: data.name,
            isSpectator: !!data?.isSpectator,
          },
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

    this.socket.on("clientOutdated", (data: any) => {
      this.handlers.forEach((h) =>
        h({
          type: "state",
          state: {
            type: "clientOutdated",
            version: data?.version,
            buildId: data?.buildId,
          },
        }),
      );
    });

    this.socket.on("disconnect", (reason: string) => {
      console.log("[SocketAdapter] Disconnected:", reason);
      this.handlers.forEach((h) =>
        h({
          type: "state",
          state: { type: "socketDisconnected", reason },
        }),
      );
    });

    this.socket.on("connect", () => {
      this.handlers.forEach((h) =>
        h({
          type: "state",
          state: { type: "socketConnected" },
        }),
      );
    });

    this.socket.on("kicked", (data: any) => {
      console.warn("[SocketAdapter] Kicked from room:", data.message);
      this.clearRoomSession();
      this.handlers.forEach((h) =>
        h({
          type: "state",
          state: { type: "kicked", message: data.message },
        }),
      );
    });

    this.socket.on("roomDismissed", (data: any) => {
      console.log("[SocketAdapter] Room dismissed:", data?.roomId);
      this.clearRoomSession();
      this.handlers.forEach((h) =>
        h({
          type: "state",
          state: { type: "roomDismissed", roomId: data?.roomId },
        }),
      );
    });

    this.socket.on("gameAborted", (data: any) => {
      console.log("[SocketAdapter] Game aborted:", data?.message);
      this.clearRoomSession();
      this.handlers.forEach((h) =>
        h({
          type: "state",
          state: {
            type: "gameAborted",
            roomId: data?.roomId,
            message: data?.message,
          },
        }),
      );
    });

    this.socket.on("botTableSkipped", (data: any) => {
      this.handlers.forEach((h) =>
        h({
          type: "state",
          state: {
            type: "botTableSkipped",
            roomId: data?.roomId,
            message: data?.message,
          },
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
            reason: data.reason,
            reconnectUntil: data.reconnectUntil,
          },
        }),
      );
    });

    this.socket.on("playerReconnected", (data: any) => {
      this.handlers.forEach((h) =>
        h({
          type: "state",
          state: {
            type: "playerReconnected",
            playerId: data.playerId,
            playerName: data.playerName,
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

    this.socket.on("playerLeft", (data: any) => {
      this.handlers.forEach((h) =>
        h({
          type: "state",
          state: {
            type: "playerLeft",
            playerId: data.playerId,
            playerName: data.playerName,
            reason: data.reason,
          },
        }),
      );
    });

    this.socket.on("turnNudge", (data: any) => {
      this.handlers.forEach((h) =>
        h({
          type: "state",
          state: {
            type: "turnNudge",
            targetPlayerId: data.targetPlayerId,
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
      if (data?.gameState) {
        this.cachedGameState = data.gameState;
      }
      this.handlers.forEach((h) =>
        h({
          type: "state",
          state: {
            type: "gameStateSync",
            gameState: data.gameState,
            spectator: !!data?.spectator,
          },
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
            lastPlayerHand: data.lastPlayerHand ?? null,
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
      if (data?.playerHands) {
        this.cachedTradesComplete = data.playerHands;
      }
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
      this.cachedTradesComplete = null;
      if (typeof data?.dealSeed === "number") {
        this.cachedDealSeed = data.dealSeed;
      }
      this.handlers.forEach((h) =>
        h({
          type: "state",
          state: {
            type: "nextRoundStarting",
            gameState: data.gameState,
            dealSeed: data.dealSeed,
            promotedPlayerId: data.promotedPlayerId ?? null,
            promotedPlayerIds: Array.isArray(data.promotedPlayerIds)
              ? data.promotedPlayerIds
              : data.promotedPlayerId
                ? [data.promotedPlayerId]
                : [],
          },
        }),
      );
    });
  }

  async disconnect() {
    this.discoverQueued = false;
    this.clearCachedGameState();
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
    const code = roomId.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    const previousRoomId = this.activeRoomId;
    if (previousRoomId && previousRoomId !== code) {
      console.log(
        "[SocketAdapter] Dismissing previous room before create:",
        previousRoomId,
      );
      this.socket.emit("dismissRoom", { roomId: previousRoomId });
    }
    this.setActiveRoomId(code);
    this.name = name;
    console.log("[SocketAdapter] Creating room:", code, "with host:", name);
    this.socket.emit("createRoom", {
      roomId: code,
      name,
      profileId: this.profileId,
      isPublic: true,
      roomName: roomName || "Game Room",
      feltTint: this.feltTint,
    });
  }

  updateRoomName(roomId: string, roomName: string) {
    if (!this.socket?.connected) return;
    const trimmed = roomName.trim();
    if (!trimmed) return;
    this.socket.emit("updateRoomName", { roomId, roomName: trimmed });
  }

  updatePlayerName(roomId: string, name: string) {
    if (!this.socket?.connected) return;
    const code = roomId.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    const trimmed = name.trim();
    if (!code || !trimmed) return;
    this.name = trimmed;
    this.socket.emit("updatePlayerName", { roomId: code, name: trimmed });
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
    const code = roomId.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    this.setActiveRoomId(code);
    this.name = name;
    this.socket.emit("joinRoom", {
      roomId: code,
      name,
      profileId: this.profileId,
      clientBuildId: CLIENT_BUILD_ID,
      feltTint: this.feltTint,
    });
  }

  updatePlayerTheme(roomId: string, feltTint: string) {
    if (!this.socket?.connected) return;
    const code = roomId.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!code || !feltTint) return;
    this.feltTint = feltTint;
    this.socket.emit("updatePlayerTheme", { roomId: code, feltTint });
  }

  leaveRoom(roomId: string) {
    if (!this.socket) return;
    this.socket.emit("leaveRoom", { roomId });
  }

  dismissRoom(roomId: string) {
    if (!this.socket) return;
    this.socket.emit("dismissRoom", { roomId });
  }

  startGame(roomId: string, skipDealAnimations?: boolean) {
    if (!this.socket) return;
    console.log("[SocketAdapter] Emitting startGame for roomId:", roomId);
    this.socket.emit("startGame", {
      roomId,
      skipDealAnimations: !!skipDealAnimations,
    });
  }

  updateRoomOptions(roomId: string, options: { skipDealAnimations?: boolean }) {
    if (!this.socket) return;
    this.socket.emit("updateRoomOptions", { roomId, ...options });
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
    if (!this.socket?.connected) {
      console.warn("[SocketAdapter] requestGameState: socket not connected");
      return;
    }
    console.log("[SocketAdapter] Requesting game state for room:", roomId);
    this.socket.emit("requestGameState", { roomId });
  }

  skipBotTable(roomId: string) {
    if (!this.socket?.connected) {
      console.warn("[SocketAdapter] skipBotTable: socket not connected");
      return;
    }
    const code = roomId.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!code) return;
    this.socket.emit("skipBotTable", { roomId: code });
  }

  playerReadyForNextRound(roomId: string) {
    if (!this.socket) return;
    const code = normalizeRoomCode(roomId);
    if (!code) return;
    this.socket.emit("playerReadyForNextRound", { roomId: code });
  }

  submitTradeSelection(roomId: string, selectedCardObjects: unknown[]) {
    if (!this.socket) return;
    this.socket.emit("playerTradeSelection", { roomId, selectedCardObjects });
  }

  on(_ev: "message", cb: (ev: NetworkEvent) => void) {
    this.handlers.push(cb);
  }

  off(_ev: "message", cb: (ev: NetworkEvent) => void) {
    this.handlers = this.handlers.filter((h) => h !== cb);
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
