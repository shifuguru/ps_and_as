type HintStorage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
};

const STORAGE_KEY = "@ps_and_as_hint_expanded";

export function createHintPreferenceStore(storage: HintStorage) {
  let expanded = true;
  let loaded = false;
  let revision = 0;
  let loading: Promise<void> | null = null;
  let pendingWrite: Promise<void> = Promise.resolve();
  const listeners = new Set<() => void>();

  function notify() {
    listeners.forEach((listener) => listener());
  }

  function preload(): Promise<void> {
    if (loaded) return Promise.resolve();
    if (loading) return loading;
    const readRevision = revision;
    loading = Promise.resolve().then(() => storage.getItem(STORAGE_KEY)).then((value) => {
      if (revision === readRevision) {
        expanded = value !== "0";
        notify();
      }
      loaded = true;
    }).finally(() => {
      loading = null;
    });
    return loading;
  }

  function setExpanded(value: boolean): Promise<void> {
    revision += 1;
    expanded = value;
    notify();
    const write = pendingWrite.catch(() => {}).then(() =>
      storage.setItem(STORAGE_KEY, value ? "1" : "0"),
    );
    pendingWrite = write;
    return write;
  }

  return {
    getSnapshot: () => expanded,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    preload,
    setExpanded,
  };
}

const hintPreference = createHintPreferenceStore({
  getItem: (key) =>
    require("@react-native-async-storage/async-storage").default.getItem(key),
  setItem: (key, value) =>
    require("@react-native-async-storage/async-storage").default.setItem(key, value),
});

export default hintPreference;
