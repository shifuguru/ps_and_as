import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SocketAdapter } from "../game/socketAdapter";
import {
  filterPublicRooms,
  type AvailableRoom,
} from "../services/availableRooms";

export type HubConnectionStatus =
  | "disconnected"
  | "connecting"
  | "connected";

type Options = {
  enabled: boolean;
};

export function useHubRoomDiscovery({ enabled }: Options) {
  const [availableRooms, setAvailableRooms] = useState<AvailableRoom[]>([]);
  const [roomsLoaded, setRoomsLoaded] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] =
    useState<HubConnectionStatus>("disconnected");
  const adapterRef = useRef<SocketAdapter | null>(null);

  const publicRooms = useMemo(
    () => filterPublicRooms(availableRooms),
    [availableRooms],
  );

  const refreshRooms = useCallback(async () => {
    const socket = adapterRef.current;
    if (!socket?.discoverRooms) return;
    setIsSearching(true);
    await socket.discoverRooms();
  }, []);

  useEffect(() => {
    if (!enabled) {
      setAvailableRooms([]);
      setRoomsLoaded(false);
      setIsSearching(false);
      setError(null);
      setConnectionStatus("disconnected");
      const prev = adapterRef.current;
      adapterRef.current = null;
      if (prev) void prev.disconnect();
      return;
    }

    let mounted = true;
    let interval: ReturnType<typeof setInterval> | null = null;

    try {
      const adapter = new SocketAdapter(undefined, "", "", "", false);
      adapterRef.current = adapter;

      adapter.on("message", (ev) => {
        if (!mounted || ev.type !== "state" || !ev.state) return;

        if (ev.state.type === "availableRooms") {
          setAvailableRooms(ev.state.rooms || []);
          setRoomsLoaded(true);
          setIsSearching(false);
          setError(null);
        } else if (ev.state.type === "error") {
          setError(ev.state.message);
          setIsSearching(false);
          setConnectionStatus("disconnected");
        } else if (ev.state.type === "socketConnected") {
          setConnectionStatus("connected");
          setError(null);
          void refreshRooms();
        } else if (ev.state.type === "socketDisconnected") {
          setConnectionStatus("disconnected");
          setIsSearching(false);
        } else if (ev.state.type === "connected") {
          setConnectionStatus("connected");
        }
      });

      (async () => {
        try {
          setConnectionStatus("connecting");
          setIsSearching(true);
          await adapter.connect();
          if (!mounted) return;
          setConnectionStatus("connected");
          await refreshRooms();
        } catch {
          if (mounted) {
            setError("Could not reach the game server. Check your connection.");
            setIsSearching(false);
            setConnectionStatus("disconnected");
          }
        }
      })();

      interval = setInterval(() => {
        if (!mounted || !adapter.isConnected?.()) return;
        void refreshRooms();
      }, 4000);
    } catch {
      if (mounted) {
        setError("Could not start online discovery.");
        setConnectionStatus("disconnected");
      }
    }

    return () => {
      mounted = false;
      if (interval) clearInterval(interval);
      const adapter = adapterRef.current;
      adapterRef.current = null;
      if (adapter) void adapter.disconnect();
    };
  }, [enabled, refreshRooms]);

  return {
    publicRooms,
    roomsLoaded,
    isSearching,
    error,
    connectionStatus,
    refreshRooms,
    setError,
  };
}
