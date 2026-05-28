export type AppearancePreference = "system" | "light" | "dark";
export type TextContrastPreference = "auto" | "light" | "dark";

const STORAGE_APPEARANCE = "@ps_and_as_appearance_mode";
const STORAGE_TEXT_CONTRAST = "@ps_and_as_text_contrast";

async function storage() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require("@react-native-async-storage/async-storage").default;
}

export async function getAppearancePreference(): Promise<AppearancePreference> {
  try {
    const AsyncStorage = await storage();
    const val = await AsyncStorage.getItem(STORAGE_APPEARANCE);
    if (val === "light" || val === "dark" || val === "system") {
      return val;
    }
  } catch {
    // ignore
  }
  return "system";
}

export async function setAppearancePreference(
  preference: AppearancePreference,
): Promise<void> {
  try {
    const AsyncStorage = await storage();
    await AsyncStorage.setItem(STORAGE_APPEARANCE, preference);
  } catch {
    // ignore
  }
}

export async function getTextContrastPreference(): Promise<TextContrastPreference> {
  try {
    const AsyncStorage = await storage();
    const val = await AsyncStorage.getItem(STORAGE_TEXT_CONTRAST);
    if (val === "auto" || val === "light" || val === "dark") {
      return val;
    }
  } catch {
    // ignore
  }
  return "auto";
}

export async function setTextContrastPreference(
  preference: TextContrastPreference,
): Promise<void> {
  try {
    const AsyncStorage = await storage();
    await AsyncStorage.setItem(STORAGE_TEXT_CONTRAST, preference);
  } catch {
    // ignore
  }
}
