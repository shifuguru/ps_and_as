import { useFonts } from "expo-font";
import { Platform } from "react-native";
import { PinyonScript_400Regular } from "@expo-google-fonts/pinyon-script";

/**
 * Load the bundled game-title script on Android and web only.
 * iOS keeps using the system Snell Roundhand face.
 */
export function useAppFonts(): { ready: boolean; error: Error | null } {
  const [loaded, error] = useFonts({
    PinyonScript_400Regular,
  });

  if (Platform.OS === "ios") {
    return { ready: true, error: null };
  }

  return { ready: loaded, error: error ?? null };
}
