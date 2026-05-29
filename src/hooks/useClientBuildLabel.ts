import { useEffect, useState } from "react";
import { Platform } from "react-native";
import {
  formatBuildLabel,
  resolveClientBuildInfo,
} from "../config/buildVersion";
import { fetchDeployedBuildInfo } from "../services/buildUpdateCheck";

function isPlaceholderBuildId(id: string): boolean {
  return !id || id === "dev" || id === "unknown";
}

/**
 * Build label for UI (main menu). Matches the git-SHA style used by the update
 * refresh overlay — falls back to version.json on web when local id is "dev".
 */
export function useClientBuildLabel(): string {
  const [label, setLabel] = useState(() =>
    formatBuildLabel(resolveClientBuildInfo()),
  );

  useEffect(() => {
    const sync = resolveClientBuildInfo();
    if (!isPlaceholderBuildId(sync.buildId)) {
      setLabel(formatBuildLabel(sync));
      return;
    }
    if (Platform.OS !== "web") return;

    let cancelled = false;
    void fetchDeployedBuildInfo().then((remote) => {
      if (cancelled || !remote?.buildId) return;
      setLabel(formatBuildLabel(remote));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return label;
}
