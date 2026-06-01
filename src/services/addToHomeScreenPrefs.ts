const STORAGE_DISMISS_ADD_TO_HOME_BANNER = "@ps_and_as_dismiss_add_to_home_banner";

async function storage() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require("@react-native-async-storage/async-storage").default;
}

export async function isAddToHomeBannerDismissed(): Promise<boolean> {
  try {
    const AsyncStorage = await storage();
    const value = await AsyncStorage.getItem(STORAGE_DISMISS_ADD_TO_HOME_BANNER);
    return value === "1" || value === "true";
  } catch {
    return false;
  }
}

export async function dismissAddToHomeBanner(): Promise<void> {
  try {
    const AsyncStorage = await storage();
    await AsyncStorage.setItem(STORAGE_DISMISS_ADD_TO_HOME_BANNER, "1");
  } catch {
    // ignore
  }
}

export async function clearAddToHomeBannerDismissed(): Promise<void> {
  try {
    const AsyncStorage = await storage();
    await AsyncStorage.removeItem(STORAGE_DISMISS_ADD_TO_HOME_BANNER);
  } catch {
    // ignore
  }
}
