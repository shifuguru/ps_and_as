/** Server snapshot metadata (authoritative multiplayer v2). */

export type ServerGamePhase =
  | "LOBBY"
  | "DEALING"
  | "TRADES"
  | "PLAYING"
  | "ROUND_COMPLETE";

export type ServerSyncMeta = {
  stateVersion?: number;
  phase?: ServerGamePhase;
};

export function readStateVersion(state: unknown): number | null {
  if (
    state &&
    typeof state === "object" &&
    typeof (state as ServerSyncMeta).stateVersion === "number"
  ) {
    return (state as ServerSyncMeta).stateVersion ?? null;
  }
  return null;
}

export function readServerPhase(state: unknown): ServerGamePhase | null {
  const phase = (state as ServerSyncMeta | null)?.phase;
  if (
    phase === "LOBBY" ||
    phase === "DEALING" ||
    phase === "TRADES" ||
    phase === "PLAYING" ||
    phase === "ROUND_COMPLETE"
  ) {
    return phase;
  }
  return null;
}

/** Ignore out-of-order snapshots after a newer one was applied. */
export function shouldApplyServerSnapshot(
  incomingVersion: number | null,
  lastApplied: number,
): boolean {
  if (incomingVersion == null) return true;
  return incomingVersion >= lastApplied;
}
