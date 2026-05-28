import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Platform } from "react-native";
import { CLIENT_BUILD_ID, type BuildVersionInfo } from "../config/buildVersion";
import {
  fetchLatestBuildInfo,
  isRemoteBuildNewer,
} from "../services/buildUpdateCheck";
import type { NetworkAdapter } from "../game/network";
import { isSocketAdapter } from "../game/socketAdapter";

const POLL_MS = 5 * 60 * 1000;

export function useBuildUpdateCheck(
  enabled = true,
  networkAdapter?: NetworkAdapter | null,
) {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [latestBuild, setLatestBuild] = useState<BuildVersionInfo | null>(null);
  const checkingRef = useRef(false);

  const checkForUpdate = useCallback(async () => {
    if (!enabled || __DEV__) return;
    if (checkingRef.current) return;
    if (CLIENT_BUILD_ID === "dev" || CLIENT_BUILD_ID === "unknown") return;

    checkingRef.current = true;
    try {
      const remote = await fetchLatestBuildInfo();
      if (remote && isRemoteBuildNewer(remote)) {
        setLatestBuild(remote);
        setUpdateAvailable(true);
      }
    } finally {
      checkingRef.current = false;
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled || __DEV__) return;

    void checkForUpdate();
    const interval = setInterval(() => {
      void checkForUpdate();
    }, POLL_MS);

    const onAppState = (state: string) => {
      if (state === "active") void checkForUpdate();
    };
    const sub = AppState.addEventListener("change", onAppState);

    if (Platform.OS === "web") {
      const doc = (globalThis as { document?: Document }).document;
      const onVisible = () => {
        if (doc?.visibilityState === "visible") void checkForUpdate();
      };
      doc?.addEventListener("visibilitychange", onVisible);
      return () => {
        clearInterval(interval);
        sub.remove();
        doc?.removeEventListener("visibilitychange", onVisible);
      };
    }

    return () => {
      clearInterval(interval);
      sub.remove();
    };
  }, [checkForUpdate, enabled]);

  useEffect(() => {
    if (!enabled || __DEV__ || !networkAdapter || !isSocketAdapter(networkAdapter)) {
      return;
    }

    const onMessage = (ev: {
      type: string;
      state?: { type?: string; buildId?: string; version?: string };
    }) => {
      if (ev.type !== "state" || ev.state?.type !== "clientOutdated") return;
      const buildId = ev.state.buildId;
      if (!buildId) return;
      const remote: BuildVersionInfo = {
        buildId,
        version: ev.state.version ?? "0.0.0",
      };
      if (isRemoteBuildNewer(remote)) {
        setLatestBuild(remote);
        setUpdateAvailable(true);
      }
    };

    networkAdapter.on("message", onMessage);
    return () => {
      networkAdapter.off("message", onMessage);
    };
  }, [enabled, networkAdapter]);

  return {
    updateAvailable,
    latestBuild,
    currentBuildId: CLIENT_BUILD_ID,
    checkForUpdate,
  };
}
