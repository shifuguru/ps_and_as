/**
 * Local display-name identity helpers.
 *
 * `@player_name` remains the display-name source of truth.
 * `@player_name_chosen` records that the user explicitly confirmed a name
 * (including the literal name "Player").
 *
 * Distinguishing states:
 * 1. Fresh install — no cached name, chosen=false → setup required
 * 2. Existing configured name — cached name is set and not the legacy
 *    implicit "Player" fallback (or chosen=true) → setup skipped;
 *    meaningful names without a flag are migrated to chosen=true once
 * 3. Legacy implicit "Player" — cached name is null/"Player" and
 *    chosen=false → setup required
 * 4. Explicitly chose "Player" — chosen=true → setup skipped
 */
import {
  cachePlayerName,
  getCachedPlayerName,
  getOrCreatePlayerId,
} from "./gameCenter";
import {
  isValidDisplayText,
  validateDisplayText,
} from "../utils/profanityFilter";

export const PLAYER_NAME_CHOSEN_KEY = "@player_name_chosen";

/** Legacy runtime / storage fallback — not an explicit user choice. */
export const IMPLICIT_PLAYER_NAME_FALLBACK = "Player";

export type DisplayNameSetupSnapshot = {
  cachedName: string | null;
  nameChosen: boolean;
};

/**
 * Pure gate: whether first-launch name setup should be shown.
 * Does not read storage or migrate state.
 */
export function needsDisplayNameSetup(
  snapshot: DisplayNameSetupSnapshot,
): boolean {
  if (snapshot.nameChosen) return false;
  const trimmed = snapshot.cachedName?.trim() ?? "";
  if (!trimmed) return true;
  if (trimmed === IMPLICIT_PLAYER_NAME_FALLBACK) return true;
  return false;
}

export async function getDisplayNameChosen(): Promise<boolean> {
  try {
    const AsyncStorage =
      require("@react-native-async-storage/async-storage").default;
    const raw = await AsyncStorage.getItem(PLAYER_NAME_CHOSEN_KEY);
    return raw === "1" || raw === "true";
  } catch {
    return false;
  }
}

export async function markDisplayNameChosen(): Promise<void> {
  try {
    const AsyncStorage =
      require("@react-native-async-storage/async-storage").default;
    await AsyncStorage.setItem(PLAYER_NAME_CHOSEN_KEY, "1");
  } catch {
    // ignore
  }
}

/**
 * Persist a validated display name and mark it as an explicit user choice.
 * Shared by first-launch setup and Settings.
 */
export async function saveChosenDisplayName(name: string): Promise<string> {
  const check = validateDisplayText(name, "Player name");
  if (!isValidDisplayText(check)) {
    throw new Error(check.reason);
  }
  await cachePlayerName(check.value);
  await markDisplayNameChosen();
  return check.value;
}

export type ResolvedDisplayNameSetup = {
  needsSetup: boolean;
  displayName: string | null;
  profileId: string;
};

/**
 * Resolve setup state for App boot.
 * Migrates existing installs that already have a meaningful cached name
 * (not the implicit "Player" fallback) by setting the chosen flag once.
 */
export async function resolveDisplayNameSetupState(): Promise<ResolvedDisplayNameSetup> {
  const profile = await getOrCreatePlayerId();
  const cachedName = await getCachedPlayerName();
  let nameChosen = await getDisplayNameChosen();

  const trimmed = cachedName?.trim() ?? "";
  if (
    !nameChosen &&
    trimmed &&
    trimmed !== IMPLICIT_PLAYER_NAME_FALLBACK
  ) {
    await markDisplayNameChosen();
    nameChosen = true;
  }

  const needsSetup = needsDisplayNameSetup({ cachedName, nameChosen });
  return {
    needsSetup,
    displayName: needsSetup ? null : trimmed || profile.displayName,
    profileId: profile.id,
  };
}
