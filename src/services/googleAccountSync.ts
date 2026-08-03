/**
 * Google Sign-in / Play Games account sync — product surface for upcoming
 * Play Store release and durable game stats.
 *
 * OAuth is not wired yet. Display-name setup and Settings use this module so
 * the browser-continue path stays coupled to the future account link.
 *
 * When ready: map Google `sub` (or Play Games id) to profile id the same way
 * Game Center uses `linkedAccountId`, then call `resetPlayerStatsRestore()`.
 */

export type GoogleAccountSyncStatus = "coming_soon" | "ready" | "unavailable";

export type GoogleAccountLink = {
  accountId: string;
  email?: string;
  displayName?: string;
};

/** Flip to `ready` when web Google Identity / Play Games client ships. */
export function getGoogleAccountSyncStatus(): GoogleAccountSyncStatus {
  return "coming_soon";
}

export function isGoogleAccountSyncOffered(): boolean {
  return getGoogleAccountSyncStatus() !== "unavailable";
}

export function getGoogleSignInButtonLabel(
  status: GoogleAccountSyncStatus = getGoogleAccountSyncStatus(),
): string {
  if (status === "ready") return "Sign in with Google";
  if (status === "coming_soon") return "Sign in with Google (coming soon)";
  return "Google Sign-in unavailable";
}

/**
 * Placeholder for the upcoming OAuth flow.
 * Returns null until Google Identity is configured.
 */
export async function requestGoogleAccountLink(): Promise<GoogleAccountLink | null> {
  if (getGoogleAccountSyncStatus() !== "ready") {
    return null;
  }
  // Future: GIS / Play Games Services → durable account id + optional name.
  return null;
}

export function googleAccountSyncBlurb(status: GoogleAccountSyncStatus = getGoogleAccountSyncStatus()): string {
  if (status === "ready") {
    return "Sign in with Google to keep your display name and game stats across devices and the Play Store build.";
  }
  return "Google Sign-in is coming soon — it will keep your display name and game stats synced across devices and the Play Store release.";
}
