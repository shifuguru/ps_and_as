import { isValidDisplayText, validateDisplayText } from "../utils/profanityFilter";

export const PLAYER_NAME_CHOSEN_KEY = "@player_name_chosen";
export const IMPLICIT_PLAYER_NAME_FALLBACK = "Player";

export function makeTemporaryPlayerName(profileId: string): string {
  const suffix = profileId.replace(/[^a-zA-Z0-9]/g, "").slice(-4).toLowerCase();
  const name = suffix ? `Player_${suffix}` : IMPLICIT_PLAYER_NAME_FALLBACK;
  if (isValidDisplayText(validateDisplayText(name, "Player name"))) return name;

  let hash = 0;
  for (let i = 0; i < profileId.length; i++) {
    hash = (Math.imul(hash, 31) + profileId.charCodeAt(i)) >>> 0;
  }
  return `Player_${hash}`;
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
