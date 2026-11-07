import { useEffect, useState } from "react";
import { resolveAvatarBorder, type AvatarBorderDesign } from "../rewards/avatarBorders";
import { getPlayerStats, subscribePlayerStats } from "../services/playerStats";
import { readDisplayTitleTrackId, subscribeDisplayTitleTrack } from "../services/titlePreferences";

export function usePlayerAvatarBorder(): AvatarBorderDesign | null {
  const [border, setBorder] = useState<AvatarBorderDesign | null>(null);

  useEffect(() => {
    let active = true;
    let generation = 0;
    const refresh = () => {
      const current = ++generation;
      void getPlayerStats()
        .then(async (stats) => {
          const trackId = await readDisplayTitleTrackId();
          if (active && current === generation) {
            setBorder(resolveAvatarBorder(stats, trackId));
          }
        })
        .catch((error) => console.error("[AvatarBorder] Failed to load decoration:", error));
    };
    const unsubscribeStats = subscribePlayerStats(refresh);
    const unsubscribeTitle = subscribeDisplayTitleTrack(refresh);
    refresh();
    return () => {
      active = false;
      unsubscribeStats();
      unsubscribeTitle();
    };
  }, []);

  return border;
}
