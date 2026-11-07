/**
 * Start the Expo web server, then run:
 * node scripts/test-trade-panel-browser.mjs
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
  const page = await browser.newPage({ viewport: { width: 320, height: 600 } });
  await page.goto(process.env.EXPO_WEB_URL ?? "http://localhost:8081/", {
    waitUntil: "domcontentloaded",
  });
  await page.waitForFunction(() => {
    const modules = globalThis.__r?.getModules?.();
    return modules && [...modules.values()].some(
      (module) => module.verboseName === "src/components/RoleTradeStrip.tsx",
    );
  }, null, { timeout: 60000 });

  const result = await page.evaluate(async () => {
    const get = (name) => {
      const entry = [...globalThis.__r.getModules().entries()].find(
        ([, module]) => module.verboseName === name,
      );
      if (!entry) throw new Error(`Missing Metro module: ${name}`);
      return globalThis.__r(entry[0]);
    };
    const React = get("node_modules/react/index.js");
    const { createRoot } = get("node_modules/react-dom/client.js");
    const RoleTradeStrip = get("src/components/RoleTradeStrip.tsx").default;
    const host = document.createElement("div");
    Object.assign(host.style, {
      position: "fixed", inset: "0", zIndex: "99999",
    });
    document.body.appendChild(host);
    const root = createRoot(host);
    const cards = [
      { suit: "spades", value: 15 },
      { suit: "hearts", value: 14 },
    ];
    const trade = {
      key: "president",
      winnerId: "winner",
      winnerName: "Winner",
      loserId: "loser",
      loserName: "Loser",
      incoming: cards,
      returnedCards: cards,
      returnCount: 2,
      completed: true,
    };
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const counts = { automatic: 0, manual: 0, pending: 0 };
    let rerenders = 0;
    let setMode;

    function Harness() {
      const [mode, updateMode] = React.useState("automatic");
      const [, setTick] = React.useState(0);
      setMode = updateMode;
      React.useEffect(() => {
        const timer = setInterval(() => setTick((tick) => tick + 1), 30);
        return () => clearInterval(timer);
      }, []);
      rerenders += 1;
      if (mode === "hidden") return null;
      return React.createElement(RoleTradeStrip, {
        trade: { ...trade, completed: mode !== "pending" },
        localPlayerId: "loser",
        hand: [],
        onConfirm: () => {},
        onSelectionChange: () => {},
        onDismiss: () => {
          counts[mode] += 1;
          updateMode("hidden");
        },
      });
    }

    try {
      root.render(React.createElement(Harness));
      await sleep(250);
      const swap = host.querySelector('[aria-label="Cards exchanged"]');
      const labels = [...host.querySelectorAll("*")].filter(
        (element) => element.textContent === "You give (best)" || element.textContent === "From Winner",
      );
      const bounds = labels.map((element) => element.getBoundingClientRect());
      const swapBounds = swap?.getBoundingClientRect();
      const swapBetween = bounds.length === 2 && swapBounds &&
        bounds[0].right <= swapBounds.left && swapBounds.right <= bounds[1].left;
      await sleep(3000);
      const visibleBeforeTimeout = host.textContent.includes("Trade complete");
      await sleep(1200);
      const autoHidden = !host.textContent.includes("Trade complete");
      setMode("manual");
      await sleep(100);
      const button = [...host.querySelectorAll("*")].find(
        (element) => element.textContent === "Continue" && !element.children.length,
      );
      button?.click();
      await sleep(100);
      const manualHidden = !host.textContent.includes("Trade complete");
      await sleep(4100);
      setMode("pending");
      await sleep(4200);
      return {
        counts, rerenders, swapBetween: !!swapBetween, visibleBeforeTimeout,
        autoHidden, manualHidden,
        pendingVisible: host.textContent.includes("Waiting for Winner"),
      };
    } finally {
      root.unmount();
      host.remove();
    }
  });

  assert.ok(result.rerenders > 10, "parent should rerender while the panel is visible");
  assert.equal(result.swapBetween, true, "swap symbol should sit between card groups");
  assert.equal(result.visibleBeforeTimeout, true, "completed trade should remain visible before timeout");
  assert.equal(result.autoHidden, true, "completed trade should close automatically");
  assert.equal(result.manualHidden, true, "Continue should close the completed trade");
  assert.equal(result.pendingVisible, true, "pending trade must not auto-dismiss");
  assert.deepEqual(result.counts, { automatic: 1, manual: 1, pending: 0 });
  console.log("Trade panel browser tests passed");
} finally {
  await browser.close();
}
