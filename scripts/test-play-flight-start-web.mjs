/**
 * Start Expo web, then run this script. PLAYWRIGHT_BROWSER_EXECUTABLE_PATH may
 * point to an installed browser.
 */
import assert from "node:assert/strict";
import { chromium } from "playwright";

const browser = await chromium.launch({
  headless: true,
  ...(process.env.PLAYWRIGHT_BROWSER_EXECUTABLE_PATH
    ? { executablePath: process.env.PLAYWRIGHT_BROWSER_EXECUTABLE_PATH }
    : {}),
});

try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  if (process.env.TEST_REDUCED_MOTION === "1") {
    await page.emulateMedia({ reducedMotion: "reduce" });
  }
  await page.goto(process.env.EXPO_WEB_URL ?? "http://localhost:8081/", {
    waitUntil: "domcontentloaded",
  });
  await page.waitForFunction(() => {
    const modules = globalThis.__r?.getModules?.();
    if (!modules) return false;
    const names = [...modules.values()].map((module) => module.verboseName);
    return [
      "node_modules/react/index.js",
      "node_modules/react-dom/client.js",
      "src/components/GamePlayArea.tsx",
      "src/components/GameTable.tsx",
    ].every((name) => names.includes(name));
  }, null, { timeout: 60000 });

  await page.evaluate(() => {
    const modules = globalThis.__r.getModules();
    const get = (name) => {
      const entry = [...modules.entries()].find(([, module]) => module.verboseName === name);
      if (!entry) throw new Error(`Missing Metro module: ${name}`);
      return globalThis.__r(entry[0]);
    };
    const React = get("node_modules/react/index.js");
    const { createRoot } = get("node_modules/react-dom/client.js");
    const GamePlayArea = get("src/components/GamePlayArea.tsx").default;
    const GameTable = get("src/components/GameTable.tsx").default;
    const players = [
      { id: "local", name: "Local", handCount: 5, role: "Neutral" },
      { id: "cpu", name: "CPU", handCount: 5, role: "Neutral" },
    ];
    const localIds = ["local"];
    const seats = ["local", "cpu"];
    const empty = [];
    const play = [{ playerId: "cpu", cards: [{ suit: "hearts", value: 7 }] }];
    const host = document.createElement("div");
    host.style.cssText = "display:flex;position:fixed;left:0;top:0;width:390px;height:480px;z-index:9999";
    document.body.appendChild(host);
    const root = createRoot(host);
    const test = globalThis.playFlightTest = {
      started: 0,
      landed: 0,
      pending: false,
      ready: false,
      cleanup: () => { root.unmount(); host.remove(); },
    };

    function Harness() {
      const [plays, setPlays] = React.useState(empty);
      const [pending, setPending] = React.useState(false);
      test.play = () => setPlays(play);
      return React.createElement(
        GamePlayArea,
        {
          players,
          localPlayerIds: localIds,
          layoutSeatIds: seats,
          currentPlayerId: "cpu",
          finishedOrder: empty,
          passedPlayerIds: empty,
          plays,
          onPlayAreaMetrics: () => { test.ready = true; },
          onPendingPlayFlightsChange: (value) => { test.pending = value; setPending(value); },
          onPlayFlightStarted: () => { test.started += 1; },
          onPlayFlightLanded: () => {
            test.landed += 1;
            test.landedAt = performance.now();
          },
          playCountLabel: pending ? "Pending" : null,
        },
        React.createElement(GameTable, { plays }),
      );
    }
    root.render(React.createElement(Harness));
  });

  try {
    await page.waitForFunction(() => globalThis.playFlightTest.ready, null, { timeout: 5000 });
    await page.waitForTimeout(100);
    await page.evaluate(() => {
      globalThis.playFlightTest.startedAt = performance.now();
      globalThis.playFlightTest.play();
    });
    await page.waitForFunction(() => globalThis.playFlightTest.pending, null, { timeout: 2000 });
    await page.waitForFunction(() => globalThis.playFlightTest.landed === 1, null, { timeout: 2000 });
    await page.waitForFunction(() => !globalThis.playFlightTest.pending, null, { timeout: 2000 });
    await page.waitForTimeout(150);
    const result = await page.evaluate(() => ({
      started: globalThis.playFlightTest.started,
      landed: globalThis.playFlightTest.landed,
      pending: globalThis.playFlightTest.pending,
      elapsedMs: Math.round(globalThis.playFlightTest.landedAt - globalThis.playFlightTest.startedAt),
    }));
    assert.ok(result.started >= 1, "flight should start");
    assert.equal(result.landed, 1, "flight should land once");
    assert.equal(result.pending, false, "turn presentation should unblock");
    console.log("test-play-flight-start-web: ok", result);
  } finally {
    await page.evaluate(() => globalThis.playFlightTest.cleanup());
  }
} finally {
  await browser.close();
}
