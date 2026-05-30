import { useEffect, useState } from "react";
import { AppState, Platform } from "react-native";
import { io, type Socket } from "socket.io-client";
import { DEFAULT_SERVER_PORT, getServerUrl } from "../config/server";
import { getOrCreatePlayerId } from "../services/gameCenter";

const POLL_MS = 15 * 1000;
const CONNECT_TIMEOUT_MS = 12_000;

type Listener = (count: number) => void;

let socket: Socket | null = null;
let connectPromise: Promise<Socket | null> | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let subscribers = new Set<Listener>();
let latestCount = 0;
let startCount = 0;

function serverUrlsToTry(): string[] {
  const urls: string[] = [];
  const primary = getServerUrl().replace(/\/$/, "");
  if (primary) urls.push(primary);

  if (__DEV__) {
    urls.push(`http://localhost:${DEFAULT_SERVER_PORT}`);
    if (Platform.OS === "web") {
      const loc = (globalThis as { location?: { origin?: string } }).location;
      if (loc?.origin && !urls.includes(loc.origin)) {
        urls.unshift(loc.origin);
      }
    }
  }

  return [...new Set(urls)];
}

function parsePlayerCount(data: { activePlayers?: unknown }): number | null {
  const raw = data?.activePlayers;
  return typeof raw === "number" && Number.isFinite(raw)
    ? Math.max(0, Math.floor(raw))
    : null;
}

function notify(count: number) {
  latestCount = count;
  subscribers.forEach((listener) => listener(count));
}

async function fetchCountHttp(): Promise<number | null> {
  for (const base of serverUrlsToTry()) {
    try {
      const res = await fetch(`${base}/api/online-players`, { cache: "no-store" });
      if (!res.ok) continue;
      const data = (await res.json()) as { activePlayers?: unknown };
      const parsed = parsePlayerCount(data);
      if (parsed != null) return parsed;
    } catch {
      /* try next URL */
    }
  }
  return null;
}

function connectOnce(url: string): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const next = io(url, {
      path: "/socket.io",
      transports: Platform.OS === "web" ? ["polling"] : ["polling", "websocket"],
      withCredentials: false,
      autoConnect: true,
      timeout: CONNECT_TIMEOUT_MS,
    });

    const timeout = setTimeout(() => {
      cleanup();
      next.disconnect();
      reject(new Error("Connection timeout"));
    }, CONNECT_TIMEOUT_MS);

    const cleanup = () => {
      clearTimeout(timeout);
      next.off("connect", onConnect);
      next.off("connect_error", onError);
    };

    const onConnect = () => {
      cleanup();
      resolve(next);
    };
    const onError = (err: Error) => {
      cleanup();
      next.disconnect();
      reject(err);
    };

    next.once("connect", onConnect);
    next.once("connect_error", onError);
  });
}

async function openSocket(): Promise<Socket | null> {
  for (const url of serverUrlsToTry()) {
    try {
      return await connectOnce(url);
    } catch {
      /* try next URL */
    }
  }
  return null;
}

async function registerProfilePresence(activeSocket: Socket): Promise<void> {
  try {
    const profile = await getOrCreatePlayerId();
    activeSocket.emit("registerPresence", { profileId: profile.id });
  } catch {
    activeSocket.emit("registerPresence", {});
  }
}

function attachSocketHandlers(activeSocket: Socket) {
  activeSocket.on("onlinePlayerCount", (data: { activePlayers?: unknown }) => {
    const next = parsePlayerCount(data);
    if (next != null) notify(next);
  });

  activeSocket.on("connect", () => {
    activeSocket.emit("getOnlinePlayerCount");
    void registerProfilePresence(activeSocket);
  });

  if (activeSocket.connected) {
    activeSocket.emit("getOnlinePlayerCount");
    void registerProfilePresence(activeSocket);
  }
}

async function refreshCount() {
  const httpCount = await fetchCountHttp();
  if (httpCount != null) notify(httpCount);

  if (socket?.connected) {
    socket.emit("getOnlinePlayerCount");
  }
}

function ensurePolling() {
  if (pollTimer) return;
  pollTimer = setInterval(() => {
    void refreshCount();
  }, POLL_MS);
}

function stopPolling() {
  if (!pollTimer) return;
  clearInterval(pollTimer);
  pollTimer = null;
}

async function ensureStarted() {
  ensurePolling();
  void refreshCount();

  if (socket?.connected) return socket;
  if (connectPromise) return connectPromise;

  connectPromise = (async () => {
    const next = await openSocket();
    if (!next) return null;
    socket = next;
    attachSocketHandlers(next);
    return next;
  })();

  try {
    return await connectPromise;
  } finally {
    connectPromise = null;
  }
}

function teardownIfIdle() {
  if (subscribers.size > 0 || startCount > 0) return;
  stopPolling();
  socket?.off("onlinePlayerCount");
  socket?.off("connect");
  socket?.disconnect();
  socket = null;
}

export function retainOnlinePresence(): () => void {
  startCount += 1;
  void ensureStarted();
  return () => {
    startCount = Math.max(0, startCount - 1);
    teardownIfIdle();
  };
}

export function subscribeOnlinePlayerCount(listener: Listener): () => void {
  subscribers.add(listener);
  listener(latestCount);
  void ensureStarted();

  return () => {
    subscribers.delete(listener);
    teardownIfIdle();
  };
}

/** Live count of unique clients connected to the multiplayer server. */
export function useOnlinePlayerCount(active: boolean) {
  const [count, setCount] = useState(latestCount);

  useEffect(() => {
    if (!active) return;

    const release = retainOnlinePresence();
    const unsubscribe = subscribeOnlinePlayerCount(setCount);

    const onAppState = (state: string) => {
      if (state === "active") void refreshCount();
    };
    const sub = AppState.addEventListener("change", onAppState);

    let removeVisibility: (() => void) | undefined;
    if (Platform.OS === "web") {
      const doc = (globalThis as {
        document?: {
          visibilityState?: string;
          addEventListener?: (type: string, fn: () => void) => void;
          removeEventListener?: (type: string, fn: () => void) => void;
        };
      }).document;
      const onVisible = () => {
        if (doc?.visibilityState === "visible") void refreshCount();
      };
      doc?.addEventListener?.("visibilitychange", onVisible);
      removeVisibility = () =>
        doc?.removeEventListener?.("visibilitychange", onVisible);
    }

    return () => {
      sub.remove();
      removeVisibility?.();
      unsubscribe();
      release();
    };
  }, [active]);

  return count;
}
