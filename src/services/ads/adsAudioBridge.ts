/**
 * Temporary audio suppress while an H5 ad is on screen (AdSense policy).
 * useMenuAudio.playEffect / bg mute check this flag.
 */

type Listener = (suppressed: boolean) => void;

let depth = 0;
const listeners = new Set<Listener>();

function notify(): void {
  const suppressed = depth > 0;
  listeners.forEach((l) => {
    try {
      l(suppressed);
    } catch {
      // ignore
    }
  });
}

export function isAdsAudioSuppressed(): boolean {
  return depth > 0;
}

export function suppressAdsAudio(): void {
  depth += 1;
  if (depth === 1) notify();
}

export function releaseAdsAudio(): void {
  if (depth <= 0) return;
  depth -= 1;
  if (depth === 0) notify();
}

export function subscribeAdsAudioSuppress(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
