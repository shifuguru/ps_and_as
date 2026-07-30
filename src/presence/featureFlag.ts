/**
 * Presence Ring v1 — unified avatar turn / waiting highlight.
 * Default off; enable locally with EXPO_PUBLIC_PRESENCE_RING_V1=1
 */
const envFlag = process.env.EXPO_PUBLIC_PRESENCE_RING_V1?.trim().toLowerCase();

export const PRESENCE_RING_V1 =
  envFlag === "1" || envFlag === "true" || envFlag === "yes";
