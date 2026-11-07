import assert from "node:assert/strict";
import { createDecorativeMotionStore } from "../src/utils/decorativeMotionStore";

async function main() {
  let resolveInitial: (value: boolean) => void = () => {};
  let preference: (value: boolean) => void = () => {};
  let activity: (value: boolean) => void = () => {};
  let preferenceSubscriptions = 0;
  let activeSubscriptions = 0;
  let preferenceUnsubscribes = 0;
  let activeUnsubscribes = 0;
  let reads = 0;
  const store = createDecorativeMotionStore({
    readReducedMotion: () => {
      reads += 1;
      return new Promise<boolean>((resolve) => { resolveInitial = resolve; });
    },
    subscribeReducedMotion: (listener) => {
      preferenceSubscriptions += 1;
      preference = listener;
      return () => { preferenceUnsubscribes += 1; };
    },
    readActive: () => true,
    subscribeActive: (listener) => {
      activeSubscriptions += 1;
      activity = listener;
      return () => { activeUnsubscribes += 1; };
    },
  }, true);

  let changes = 0;
  const stop1 = store.subscribe(() => { changes += 1; });
  const stop2 = store.subscribe(() => { changes += 1; });
  assert.equal(preferenceSubscriptions, 1);
  assert.equal(activeSubscriptions, 1);
  assert.equal(store.getSnapshot(), false, "unknown native preference is conservative");
  preference(false);
  assert.equal(store.getSnapshot(), true);
  resolveInitial(true);
  await Promise.resolve();
  assert.equal(store.getSnapshot(), true, "stale initial read must not override an event");
  activity(false);
  assert.equal(store.getSnapshot(), false);
  preference(true);
  activity(true);
  assert.equal(store.getSnapshot(), false, "foreground must still respect reduced motion");
  preference(false);
  assert.equal(store.getSnapshot(), true);
  assert.equal(changes, 6);
  stop1();
  assert.equal(preferenceUnsubscribes, 0);
  stop2();
  assert.equal(preferenceUnsubscribes, 1);
  assert.equal(activeUnsubscribes, 1);

  const stop3 = store.subscribe(() => {});
  assert.equal(reads, 2);
  stop3();
  resolveInitial(true);
  await Promise.resolve();
  assert.equal(store.getSnapshot(), true, "late read after unsubscribe must be ignored");
  assert.equal(preferenceUnsubscribes, 2);
  assert.equal(activeUnsubscribes, 2);
  console.log("test-decorative-motion: ok");
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
