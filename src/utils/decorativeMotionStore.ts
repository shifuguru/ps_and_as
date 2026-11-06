type MotionSource = {
  readReducedMotion: () => Promise<boolean>;
  subscribeReducedMotion: (listener: (value: boolean) => void) => () => void;
  readActive: () => boolean;
  subscribeActive: (listener: (active: boolean) => void) => () => void;
};

/** One subscription per application, shared by every decorative animation. */
export function createDecorativeMotionStore(
  source: MotionSource,
  initialReducedMotion: boolean,
) {
  let reduced = initialReducedMotion;
  let active = source.readActive();
  let generation = 0;
  let stop: (() => void) | null = null;
  const listeners = new Set<() => void>();
  const snapshot = () => active && !reduced;

  const update = (change: () => void) => {
    const previous = snapshot();
    change();
    if (previous !== snapshot()) listeners.forEach((listener) => listener());
  };

  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    if (!stop) {
      const current = ++generation;
      let preferenceChanged = false;
      const unsubscribePreference = source.subscribeReducedMotion((value) => {
        preferenceChanged = true;
        update(() => { reduced = value; });
      });
      const unsubscribeActive = source.subscribeActive((value) =>
        update(() => { active = value; }),
      );
      update(() => { active = source.readActive(); });
      void source.readReducedMotion().then((value) => {
        if (generation === current && !preferenceChanged) {
          update(() => { reduced = value; });
        }
      }).catch((error) => {
        console.warn("Unable to read reduced-motion preference", error);
      });
      stop = () => {
        generation += 1;
        unsubscribePreference();
        unsubscribeActive();
      };
    }
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0 && stop) {
        stop();
        stop = null;
      }
    };
  };

  return { subscribe, getSnapshot: snapshot };
}
