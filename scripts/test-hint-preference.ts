import assert from "node:assert/strict";
import { createHintPreferenceStore } from "../src/services/hintPreference";

async function main() {
  let saved: string | null = null;
  const storage = {
    getItem: async () => saved,
    setItem: async (_key: string, value: string) => { saved = value; },
  };
  const first = createHintPreferenceStore(storage);
  assert.equal(first.getSnapshot(), true, "hints are shown by default");
  await first.preload();
  let notifications = 0;
  const unsubscribe = first.subscribe(() => { notifications += 1; });
  await first.setExpanded(false);
  assert.equal(first.getSnapshot(), false);
  assert.equal(saved, "0");
  assert.equal(notifications, 1);
  unsubscribe();

  const nextSession = createHintPreferenceStore(storage);
  await nextSession.preload();
  assert.equal(nextSession.getSnapshot(), false, "hidden choice survives a restart");
  await nextSession.setExpanded(true);
  const thirdSession = createHintPreferenceStore(storage);
  await thirdSession.preload();
  assert.equal(thirdSession.getSnapshot(), true, "showing hints is saved too");

  let finishRead: (value: string | null) => void = () => {};
  const racing = createHintPreferenceStore({
    getItem: () => new Promise((resolve) => { finishRead = resolve; }),
    setItem: async () => {},
  });
  const load = racing.preload();
  await Promise.resolve();
  await racing.setExpanded(false);
  finishRead("1");
  await load;
  assert.equal(racing.getSnapshot(), false, "late reads cannot overwrite a player's choice");

  const writes: string[] = [];
  let finishWrite: () => void = () => {};
  const ordered = createHintPreferenceStore({
    getItem: async () => null,
    setItem: async (_key, value) => {
      writes.push(value);
      if (value === "0") await new Promise<void>((resolve) => { finishWrite = resolve; });
    },
  });
  const hide = ordered.setExpanded(false);
  const show = ordered.setExpanded(true);
  await Promise.resolve();
  await Promise.resolve();
  assert.deepEqual(writes, ["0"]);
  finishWrite();
  await Promise.all([hide, show]);
  assert.deepEqual(writes, ["0", "1"], "rapid choices persist in order");
  assert.equal(ordered.getSnapshot(), true);

  let attempts = 0;
  const failing = createHintPreferenceStore({
    getItem: async () => { throw new Error("read failed"); },
    setItem: async () => {
      attempts += 1;
      if (attempts === 1) throw new Error("write failed");
    },
  });
  await assert.rejects(failing.preload(), /read failed/);
  await assert.rejects(failing.setExpanded(false), /write failed/);
  await failing.setExpanded(true);
  assert.equal(attempts, 2, "a failed write does not block later choices");
  console.log("test-hint-preference: ok");
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
