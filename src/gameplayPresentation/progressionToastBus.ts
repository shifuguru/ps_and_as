/**
 * Lightweight presentation toast bus — no gameplay state ownership.
 */
export type GameplayToast = {
  id: string;
  title: string;
  body?: string;
  kind: "xp" | "achievement" | "streak";
};

type Listener = (toast: GameplayToast) => void;

const listeners = new Set<Listener>();
let seq = 0;

export function pushGameplayToast(
  toast: Omit<GameplayToast, "id"> & { id?: string },
): void {
  const full: GameplayToast = {
    id: toast.id ?? `toast-${Date.now()}-${seq++}`,
    title: toast.title,
    body: toast.body,
    kind: toast.kind,
  };
  listeners.forEach((fn) => {
    try {
      fn(full);
    } catch {
      /* ignore listener errors */
    }
  });
}

export function subscribeGameplayToasts(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
