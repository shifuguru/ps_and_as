/**
 * Lightweight presentation toast bus — no gameplay state ownership.
 * Retains recent toasts briefly so a newly mounted host (e.g. rankings modal)
 * can still show an unlock that fired a moment earlier.
 */
export type GameplayToast = {
  id: string;
  title: string;
  body?: string;
  kind: "xp" | "achievement" | "streak";
};

type Listener = (toast: GameplayToast) => void;

const listeners = new Set<Listener>();
const recent: { toast: GameplayToast; expiresAt: number }[] = [];
const RETAIN_MS = 4200;
let seq = 0;

function pruneRecent(now = Date.now()): void {
  while (recent.length > 0 && recent[0].expiresAt <= now) {
    recent.shift();
  }
}

export function pushGameplayToast(
  toast: Omit<GameplayToast, "id"> & { id?: string },
): void {
  const full: GameplayToast = {
    id: toast.id ?? `toast-${Date.now()}-${seq++}`,
    title: toast.title,
    body: toast.body,
    kind: toast.kind,
  };
  const now = Date.now();
  pruneRecent(now);
  // Only achievements need modal handoff (round-end unlocks often fire just before rankings).
  if (full.kind === "achievement") {
    recent.push({ toast: full, expiresAt: now + RETAIN_MS });
  }
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
  pruneRecent();
  for (const entry of recent) {
    try {
      fn(entry.toast);
    } catch {
      /* ignore */
    }
  }
  return () => {
    listeners.delete(fn);
  };
}
