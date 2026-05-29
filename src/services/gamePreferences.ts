const STORAGE_SKIP_DEAL_ANIMATIONS = "@ps_and_as_skip_deal_animations";

type Listener = () => void;
const listeners = new Set<Listener>();

async function storage() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require("@react-native-async-storage/async-storage").default;
}

export function subscribeGamePreferences(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notifyGamePreferences(): void {
  listeners.forEach((listener) => listener());
}

export async function getSkipDealAnimations(): Promise<boolean> {
  try {
    const AsyncStorage = await storage();
    const val = await AsyncStorage.getItem(STORAGE_SKIP_DEAL_ANIMATIONS);
    return val === "1" || val === "true";
  } catch {
    return false;
  }
}

export async function setSkipDealAnimations(skip: boolean): Promise<void> {
  try {
    const AsyncStorage = await storage();
    await AsyncStorage.setItem(STORAGE_SKIP_DEAL_ANIMATIONS, skip ? "1" : "0");
    notifyGamePreferences();
  } catch {
    // ignore
  }
}
