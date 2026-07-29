import { useEffect, useState } from "react";
import { AppState, Platform } from "react-native";
import { io, type Socket } from "socket.io-client";
import { DEFAULT_SERVER_PORT, getServerUrl } from "../config/server";
import {
  EMPTY_ONLINE_PRESENCE,
  mergeOnlinePresence,
  parseOnlinePresencePayload,
  withLocalPresenceFallback,
  type OnlinePresenceSnapshot,
} from "../services/onlinePresence";
import { getOrCreatePlayerId } from "../services/gameCenter";

const POLL_MS = 15 * 1000;
const CONNECT_TIMEOUT_MS = 12_000;

type Listener = (snapshot: OnlinePresenceSnapshot) => void;

let socket: Socket | null = null;
let connectPromise: Promise<Socket | null> | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let subscribers = new Set<Listener>();
let latestPresence: OnlinePresenceSnapshot = EMPTY_ONLINE_PRESENCE;
let startCount = 0;
let lastRegisteredDisplayName: string | null = null;

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

function notify(snapshot: OnlinePresenceSnapshot) {
  latestPresence = snapshot;
  subscribers.forEach((listener) => listener(snapshot));
}

function applyPresencePayload(data: {
  activePlayers?: unknown;
  players?: unknown;
}) {
  const parsed = parseOnlinePresencePayload(data);
  if (parsed == null) return;
  notify(mergeOnlinePresence(latestPresence, parsed));
}

async function fetchPresenceHttp(): Promise<OnlinePresenceSnapshot | null> {
  for (const base of serverUrlsToTry()) {
    try {
      const res = await fetch(`${base}/api/online-players`, { cache: "no-store" });
      if (!res.ok) continue;
      const data = (await res.json()) as {
        activePlayers?: unknown;
        players?: unknown;
      };
      const parsed = parseOnlinePresencePayload(data);
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

async function registerProfilePresence(
  activeSocket: Socket,
  preferredDisplayName?: string | null,
): Promise<void> {
  const preferred = preferredDisplayName?.trim() || null;
  try {
    const profile = await getOrCreatePlayerId();
    const displayName = preferred || profile.displayName || "Player";
    lastRegisteredDisplayName = displayName;
    activeSocket.emit("registerPresence", {
      profileId: profile.id,
      displayName,
    });
  } catch {
    const displayName = preferred || "Player";
    lastRegisteredDisplayName = displayName;
    activeSocket.emit("registerPresence", {
      displayName,
    });
  }
}

function attachSocketHandlers(activeSocket: Socket) {
  activeSocket.on(
    "onlinePlayerCount",
    (data: { activePlayers?: unknown; players?: unknown }) => {
      applyPresencePayload(data);
    },
  );

  activeSocket.on("connect", () => {
    activeSocket.emit("getOnlinePlayerCount");
    void registerProfilePresence(activeSocket, lastRegisteredDisplayName);
  });

  if (activeSocket.connected) {
    activeSocket.emit("getOnlinePlayerCount");
    void registerProfilePresence(activeSocket, lastRegisteredDisplayName);
  }
}

async function refreshPresence() {
  const httpPresence = await fetchPresenceHttp();
  if (httpPresence != null) {
    notify(mergeOnlinePresence(latestPresence, httpPresence));
  }

  if (socket?.connected) {
    socket.emit("getOnlinePlayerCount");
  }
}

function ensurePolling() {
  if (pollTimer) return;
  pollTimer = setInterval(() => {
    void refreshPresence();
  }, POLL_MS);
}

function stopPolling() {
  if (!pollTimer) return;
  clearInterval(pollTimer);
  pollTimer = null;
}

async function ensureStarted() {
  ensurePolling();
  void refreshPresence();

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
  lastRegisteredDisplayName = null;
}

export function retainOnlinePresence(): () => void {
  startCount += 1;
  void ensureStarted();
  return () => {
    startCount = Math.max(0, startCount - 1);
    teardownIfIdle();
  };
}

export function subscribeOnlinePresence(listener: Listener): () => void {
  subscribers.add(listener);
  listener(latestPresence);
  void ensureStarted();

  return () => {
    subscribers.delete(listener);
    teardownIfIdle();
  };
}

/** @deprecated Prefer subscribeOnlinePresence — kept for callers that only need count. */
export function subscribeOnlinePlayerCount(listener: (count: number) => void): () => void {
  return subscribeOnlinePresence((snapshot) => listener(snapshot.count));
}

/** Push the latest known display name onto the presence socket. */
export function updateOnlinePresenceDisplayName(
  displayName: string | null | undefined,
): void {
  const trimmed = displayName?.trim() || null;
  if (!trimmed || trimmed === lastRegisteredDisplayName) return;
  lastRegisteredDisplayName = trimmed;
  if (socket?.connected) {
    void registerProfilePresence(socket, trimmed);
  }
}

/** Live presence snapshot from the multiplayer server. */
export function useOnlinePresence(
  active: boolean,
  displayName?: string | null,
): OnlinePresenceSnapshot {
  const [presence, setPresence] = useState(latestPresence);

  useEffect(() => {
    if (!active) return;

    const release = retainOnlinePresence();
    const unsubscribe = subscribeOnlinePresence(setPresence);
    updateOnlinePresenceDisplayName(displayName);

    const onAppState = (state: string) => {
      if (state === "active") void refreshPresence();
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
        if (doc?.visibilityState === "visible") void refreshPresence();
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
  }, [active, displayName]);

  useEffect(() => {
    if (!active) return;
    updateOnlinePresenceDisplayName(displayName);
  }, [active, displayName]);

  return withLocalPresenceFallback(presence, displayName);
}

/** Live count of unique clients connected to the multiplayer server. */
export function useOnlinePlayerCount(active: boolean) {
  return useOnlinePresence(active).count;
}
