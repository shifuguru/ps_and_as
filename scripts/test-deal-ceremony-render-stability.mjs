/**
 * Browser regression for trade flights under repeated parent renders.
 * Start the Expo web server first, then run:
 * node scripts/test-deal-ceremony-render-stability.mjs
 *
 * Set PLAYWRIGHT_BROWSER_EXECUTABLE_PATH if Playwright's browser is unavailable.
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
  const updateDepthErrors = [];
  page.on("console", (message) => {
    if (message.text().includes("Maximum update depth")) {
      updateDepthErrors.push(message.text());
    }
  });
  await page.goto(process.env.EXPO_WEB_URL ?? "http://localhost:8081/", {
    waitUntil: "domcontentloaded",
  });
  await page.waitForFunction(() => {
    const requireModule = globalThis.__r;
    if (!requireModule?.getModules) return false;
    const names = [...requireModule.getModules().values()].map((m) => m.verboseName);
    return [
      "node_modules/react/index.js",
      "node_modules/react-dom/client.js",
      "src/components/DealCeremonyOverlay.tsx",
      "src/utils/tableLayout.ts",
    ].every((name) => names.includes(name));
  }, null, { timeout: 60000 });

  const result = await page.evaluate(async () => {
    const modules = globalThis.__r.getModules();
    const get = (name) => {
      const entry = [...modules.entries()].find(([, module]) => module.verboseName === name);
      if (!entry) throw new Error(`Missing Metro module: ${name}`);
      return globalThis.__r(entry[0]);
    };
    const React = get("node_modules/react/index.js");
    const { createRoot } = get("node_modules/react-dom/client.js");
    const Overlay = get("src/components/DealCeremonyOverlay.tsx").default;
    const { computePlayAreaLayout } = get("src/utils/tableLayout.ts");
    const host = document.createElement("div");
    host.style.display = "none";
    document.body.appendChild(host);
    const root = createRoot(host);
    const start = performance.now();
    const ids = ["p1", "p2", "p3", "p4"];
    const locals = ["p1"];
    const layout = computePlayAreaLayout(390, 480, 4, 844);
    const trades = [{
      loserId: "p1",
      winnerId: "p2",
      incoming: [{ suit: "clubs", value: 3 }],
      completed: false,
    }];
    const progress = [];
    const completed = [];
    const mandatory = [];
    let renders = 0;

    function Harness() {
      const [, setTick] = React.useState(0);
      const [, setProgress] = React.useState(null);
      renders += 1;
      React.useEffect(() => {
        const timer = setInterval(() => setTick((tick) => tick + 1), 30);
        return () => clearInterval(timer);
      }, []);
      return React.createElement(Overlay, {
        visible: true,
        playerIds: ids,
        layoutSeatIds: ids,
        localPlayerIds: locals,
        dealerId: "p1",
        layout,
        playAreaHeight: 480,
        cardsPerPlayer: 14,
        totalCards: 54,
        pendingTrades: trades,
        skipDealPhases: true,
        onDealProgressChange: (value) => {
          progress.push(value);
          setProgress(value);
        },
        onMandatoryTradesAnimated: () => mandatory.push(performance.now() - start),
        onDealComplete: () => completed.push(performance.now() - start),
      });
    }

    try {
      root.render(React.createElement(Harness));
      await new Promise((resolve) => setTimeout(resolve, 2000));
      return { progress, completed, mandatory, renders };
    } finally {
      root.unmount();
      host.remove();
    }
  });

  assert.ok(result.renders > 10, "parent should rerender during the trade");
  assert.deepEqual(result.progress.map((p) => p.phase), ["shuffle", "trade", "done"]);
  assert.equal(result.mandatory.length, 1, "trade animation must finish without watchdog fallback");
  assert.equal(result.completed.length, 1, "ceremony must complete exactly once");
  assert.deepEqual(updateDepthErrors, []);
  if (process.env.TEST_REDUCED_MOTION === "1") {
    await page.evaluate(() => {
      const modules = globalThis.__r.getModules();
      const get = (name) => {
        const entry = [...modules.entries()].find(([, module]) => module.verboseName === name);
        if (!entry) throw new Error(`Missing Metro module: ${name}`);
        return globalThis.__r(entry[0]);
      };
      const React = get("node_modules/react/index.js");
      const { createRoot } = get("node_modules/react-dom/client.js");
      const Overlay = get("src/components/DealCeremonyOverlay.tsx").default;
      const { computePlayAreaLayout } = get("src/utils/tableLayout.ts");
      const host = document.createElement("div");
      host.style.display = "none";
      document.body.appendChild(host);
      const root = createRoot(host);
      const ids = ["p1", "p2"];
      const phases = [];
      globalThis.dealMotionTest = {
        phases,
        completed: 0,
        cleanup: () => { root.unmount(); host.remove(); },
      };
      root.render(React.createElement(Overlay, {
        visible: true,
        playerIds: ids,
        layoutSeatIds: ids,
        localPlayerIds: ["p1"],
        dealerId: "p1",
        layout: computePlayAreaLayout(390, 480, 2, 844),
        playAreaHeight: 480,
        cardsPerPlayer: 1,
        totalCards: 2,
        pendingTrades: [],
        onDealProgressChange: (value) => phases.push(value.phase),
        onDealComplete: () => { globalThis.dealMotionTest.completed += 1; },
      }));
    });
    try {
      await page.waitForFunction(() => globalThis.dealMotionTest.completed > 0, null, {
        timeout: 12000,
      });
      const deal = await page.evaluate(() => ({
        phases: globalThis.dealMotionTest.phases,
        completed: globalThis.dealMotionTest.completed,
      }));
      assert.ok(deal.phases.includes("shuffle"));
      assert.ok(deal.phases.includes("deal"));
      assert.equal(deal.completed, 1, "reduced-motion shuffle and deal must complete");
      assert.deepEqual(updateDepthErrors, []);
    } finally {
      await page.evaluate(() => globalThis.dealMotionTest.cleanup());
    }
  }
  console.log("test-deal-ceremony-render-stability: ok", {
    renders: result.renders,
    tradeFinishedMs: Math.round(result.mandatory[0]),
  });
} finally {
  await browser.close();
}
