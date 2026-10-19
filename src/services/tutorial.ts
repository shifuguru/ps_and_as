import { type Storage } from "@react-native-async-storage/async-storage";

const TUTORIAL_DONE_KEY = "@ps_and_as_tutorial_done";

/**
 * Reads if the local user has already finished the introductory tutorial.
 * Returns `true` only when the stored value is EXACTLY "1".
 * Any read error or missing value defaults to `false`.
 */
export async function getTutorialDone(): Promise<boolean> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const AsyncStorage = require("@react-native-async-storage/async-storage").default as Storage;
    const raw = await AsyncStorage.getItem(TUTORIAL_DONE_KEY);
    return raw === "1";
  } catch {
    return false;
  }
}

/**
 * Persists the completion state of the tutorial.
 * `true` → store "1", `false` → store "0".
 * Errors are swallowed to avoid crashes.
 */
export async function setTutorialDone(done: boolean): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const AsyncStorage = require("@react-native-async-storage/async-storage").default;
    await AsyncStorage.setItem(TUTORIAL_DONE_KEY, done ? "1" : "0");
  } catch {
    /* ignore – non‑critical */
  }
}
