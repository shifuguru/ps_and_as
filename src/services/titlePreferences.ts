import {
  resolveDisplayedTitle,
  type TitleTrackDef,
  TITLE_TRACKS,
} from "../rewards/titleTracks";
import type { PlayerStats } from "./playerStats";

const STORAGE_KEY = "@ps_and_as_display_title_track";

function getAsyncStorage(): {
  getItem: (k: string) => Promise<string | null>;
  setItem: (k: string, v: string) => Promise<void>;
  removeItem: (k: string) => Promise<void>;
} | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require("@react-native-async-storage/async-storage").default;
  } catch {
    return null;
  }
}

function isValidTrackId(id: string): boolean {
  return TITLE_TRACKS.some((t) => t.id === id);
}

export async function readDisplayTitleTrackId(): Promise<string | null> {
  const store = getAsyncStorage();
  if (!store) return null;
  try {
    const raw = await store.getItem(STORAGE_KEY);
    if (!raw || !isValidTrackId(raw)) return null;
    return raw;
  } catch {
    return null;
  }
}

export async function writeDisplayTitleTrackId(trackId: string | null): Promise<void> {
  const store = getAsyncStorage();
  if (!store) return;
  try {
    if (!trackId || !isValidTrackId(trackId)) {
      await store.removeItem(STORAGE_KEY);
      return;
    }
    await store.setItem(STORAGE_KEY, trackId);
  } catch {
    /* non-critical */
  }
}

export async function setDisplayTitleTrackId(trackId: string | null): Promise<void> {
  await writeDisplayTitleTrackId(trackId);
  const playerId = await resolveStatsPlayerId();
  if (!playerId) return;
  try {
    const { pushCloudPlayerRecord, readLocalCloudProfile } = await import(
      "./playerStatsCloud"
    );
    const profile = await readLocalCloudProfile();
    const nextProfile = {
      ...profile,
      displayTitleTrackId:
        trackId && isValidTrackId(trackId) ? trackId : null,
    };
    void pushCloudPlayerRecord(playerId, { profile: nextProfile });
  } catch {
    /* non-critical */
  }
}

async function resolveStatsPlayerId(): Promise<string | null> {
  try {
    const { getOrCreatePlayerId } = await import("./gameCenter");
    const info = await getOrCreatePlayerId();
    return info.linkedAccountId || info.id || info.installId || null;
  } catch {
    return null;
  }
}

export function displayedTitleForStats(
  stats: PlayerStats,
  displayTrackId: string | null,
): string | null {
  return resolveDisplayedTitle(stats, displayTrackId);
}

export function titleTrackById(id: string): TitleTrackDef | undefined {
  return TITLE_TRACKS.find((t) => t.id === id);
}
