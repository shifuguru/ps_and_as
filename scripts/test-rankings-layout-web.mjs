/**
 * Start Expo web before running. PLAYWRIGHT_BROWSER_EXECUTABLE_PATH can select
 * an installed browser.
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
  const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
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
      "src/components/RoundCompleteModal.tsx",
    ].every((name) => names.includes(name));
  }, null, { timeout: 60000 });
  await page.waitForFunction(() =>
    document.querySelector("#root")?.textContent?.includes("Online") &&
    ![...document.querySelectorAll("*")].some((element) =>
      element.children.length === 0 && element.textContent === "App designed by Shifuguru"),
  null, { timeout: 60000 });

  await page.evaluate(() => {
    const modules = globalThis.__r.getModules();
    const get = (name) => {
      const entry = [...modules.entries()].find(([, module]) => module.verboseName === name);
      if (!entry) throw new Error(`Missing Metro module: ${name}`);
      return globalThis.__r(entry[0]);
    };
    const React = get("node_modules/react/index.js");
    const { createRoot } = get("node_modules/react-dom/client.js");
    const Modal = get("src/components/RoundCompleteModal.tsx").default;
    const { SafeAreaInsetsContext } = get("node_modules/react-native-safe-area-context/lib/module/SafeAreaContext.js");
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    globalThis.rankingsLayoutTest = {
      quit: 0,
      ready: 0,
      render: (count, spectator = false) => {
        const players = Array.from({ length: count }, (_, i) => ({
          id: `rank-test-${i}`,
          name: `Rank Test ${i}`,
        }));
        root.render(React.createElement(SafeAreaInsetsContext.Provider,
          { value: { top: 0, bottom: 0, left: 0, right: 0 } },
          React.createElement(Modal, {
          visible: true,
          players,
          finishedOrder: players.map((player) => player.id),
          readyStates: {},
          localPlayerId: players[0].id,
          spectatorMode: spectator,
          deadHandSeatOpen: spectator,
          botsAutoReady: spectator,
          botNextRoundAt: spectator ? Date.now() + 60000 : null,
          onQuit: () => { globalThis.rankingsLayoutTest.quit += 1; },
          onToggleReady: () => { globalThis.rankingsLayoutTest.ready += 1; },
          }),
        ));
      },
      cleanup: () => { root.unmount(); host.remove(); },
    };
  });

  try {
    // Test the first opening without a resize, with a stationary bubble outside the card.
    await page.evaluate(() => globalThis.rankingsLayoutTest.render(4));
    await page.waitForFunction(() => {
      const backdrop = document.querySelector('[data-testid="modal-backdrop-blur"]');
      if (!backdrop) return false;
      const opacity = Number(getComputedStyle(backdrop).opacity);
      if (opacity <= 0 || opacity >= 0.95) return false;
      const celebration = document.querySelector('[data-testid="round-end-celebration"]');
      for (let ancestor = backdrop.parentElement; ancestor !== celebration?.parentElement; ancestor = ancestor.parentElement) {
        if (!ancestor || Number(getComputedStyle(ancestor).opacity) !== 1) {
          throw new Error("Backdrop has an opacity ancestor during its fade");
        }
      }
      return true;
    }, null, { timeout: 5000 });
    await page.getByText("Final Rankings", { exact: true }).waitFor({ timeout: 5000 });
    await page.waitForTimeout(600);
    await page.evaluate(() => {
      const celebration = document.querySelector('[data-testid="round-end-celebration"]');
      const backdrop = document.querySelector('[data-testid="modal-backdrop-blur"]');
      if (!celebration || !backdrop) throw new Error("Missing celebration or backdrop");
      for (let ancestor = backdrop.parentElement; ancestor !== celebration.parentElement; ancestor = ancestor.parentElement) {
        if (!ancestor) throw new Error("Backdrop and celebration do not share a parent");
        if (Number(getComputedStyle(ancestor).opacity) !== 1) {
          throw new Error("Backdrop has an opacity ancestor between it and the celebration");
        }
      }
      const style = document.createElement("style");
      style.id = "blur-test-styles";
      style.textContent = `
        [data-testid="round-end-celebration"] > :not(:first-child) { display: none !important; }
        [data-testid="round-end-celebration"] > :first-child {
          left: 30px !important; top: 30px !important; width: 100px !important;
          height: 100px !important; border-radius: 50px !important;
          transform: none !important; opacity: 1 !important;
        }
        [data-testid="modal-backdrop-blur"] { opacity: 0.5 !important; }
      `;
      document.head.appendChild(style);
    });
    const blurred = await page.screenshot({ clip: { x: 0, y: 0, width: 160, height: 160 } });
    await page.evaluate(() => {
      document.getElementById("blur-test-styles").textContent += `
        [data-testid="modal-backdrop-blur"] {
          backdrop-filter: none !important; -webkit-backdrop-filter: none !important;
        }
      `;
    });
    const unblurred = await page.screenshot({ clip: { x: 0, y: 0, width: 160, height: 160 } });
    const pixelDifference = await page.evaluate(async ([first, second]) => {
      const pixels = async (data) => {
        const image = new Image();
        image.src = `data:image/png;base64,${data}`;
        await image.decode();
        const canvas = document.createElement("canvas");
        canvas.width = image.width;
        canvas.height = image.height;
        const context = canvas.getContext("2d");
        context.drawImage(image, 0, 0);
        return context.getImageData(0, 0, image.width, image.height).data;
      };
      const a = await pixels(first);
      const b = await pixels(second);
      let total = 0;
      for (let i = 0; i < a.length; i += 4) {
        total += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]);
      }
      return total;
    }, [blurred.toString("base64"), unblurred.toString("base64")]);
    assert.ok(pixelDifference > 10000, `backdrop must visibly blur the celebration on first open: ${pixelDifference}`);
    await page.evaluate(() => {
      document.getElementById("blur-test-styles").remove();
    });

    for (const scenario of [
      { width: 390, height: 844, count: 2, spectator: false },
      { width: 390, height: 844, count: 4, spectator: false },
      { width: 320, height: 480, count: 8, spectator: false },
      { width: 390, height: 667, count: 8, spectator: true },
      { width: 1024, height: 768, count: 4, spectator: false },
    ]) {
      await page.setViewportSize({ width: scenario.width, height: scenario.height });
      await page.evaluate(({ count, spectator }) => {
        globalThis.rankingsLayoutTest.render(count, spectator);
      }, scenario);
      await page.getByText("Final Rankings", { exact: true }).waitFor({ timeout: 5000 });
      await page.waitForTimeout(600);
      const result = await page.evaluate(() => {
        const title = [...document.querySelectorAll("*")].find((element) =>
          element.textContent === "Final Rankings" && element.children.length === 0,
        );
        const content = title.parentElement;
        const panel = content.parentElement;
        const quit = document.querySelector('[aria-label="Quit Game"]');
        const action = document.querySelector('[aria-label="Ready For Next Round"], [aria-label="Take dead hand seat next round"]');
        const rect = (element) => {
          const box = element.getBoundingClientRect();
          return { top: box.top, bottom: box.bottom, width: box.width, height: box.height };
        };
        const scroll = [...content.querySelectorAll("*")].find((element) =>
          getComputedStyle(element).overflowY === "auto",
        );
        return {
          panel: rect(panel),
          content: rect(content),
          quit: rect(quit),
          action: rect(action),
          scroll: scroll && {
            ...rect(scroll),
            scrollHeight: scroll.scrollHeight,
            clientHeight: scroll.clientHeight,
          },
        };
      });
      assert.ok(Math.abs(result.panel.width - Math.min(scenario.width - 32, 480)) < 2,
        `panel should use available width: ${JSON.stringify({ scenario, result })}`);
      assert.ok(result.panel.bottom - result.quit.bottom <= 24,
        `buttons should sit at bottom of panel: ${JSON.stringify({ scenario, result })}`);
      assert.ok(result.quit.bottom <= scenario.height && result.action.bottom <= scenario.height,
        `buttons should remain visible: ${JSON.stringify({ scenario, result })}`);
      assert.ok(result.scroll && result.scroll.height > 0,
        `rankings need a visible scroll area: ${JSON.stringify({ scenario, result })}`);
      if (scenario.count === 8) {
        assert.ok(result.scroll.scrollHeight > result.scroll.clientHeight,
          `long rankings should scroll: ${JSON.stringify({ scenario, result })}`);
        const scrolled = await page.evaluate(() => {
          const title = [...document.querySelectorAll("*")].find((element) =>
            element.textContent === "Final Rankings" && element.children.length === 0,
          );
          const scroll = [...title.parentElement.querySelectorAll("*")].find((element) =>
            getComputedStyle(element).overflowY === "auto",
          );
          scroll.scrollTop = scroll.scrollHeight;
          const last = [...scroll.querySelectorAll("*")].find((element) =>
            element.textContent === "Rank Test 7" && element.children.length === 0,
          );
          return {
            scrollTop: scroll.scrollTop,
            lastTop: last.getBoundingClientRect().top,
            lastBottom: last.getBoundingClientRect().bottom,
            scrollTopEdge: scroll.getBoundingClientRect().top,
            scrollBottomEdge: scroll.getBoundingClientRect().bottom,
            quitBottom: document.querySelector('[aria-label="Quit Game"]').getBoundingClientRect().bottom,
          };
        });
        assert.ok(scrolled.scrollTop > 0 &&
          scrolled.lastTop >= scrolled.scrollTopEdge &&
          scrolled.lastBottom <= scrolled.scrollBottomEdge,
        `last ranking should be reachable: ${JSON.stringify({ scenario, scrolled })}`);
        assert.ok(Math.abs(scrolled.quitBottom - result.quit.bottom) < 1,
          "footer must stay fixed while rankings scroll");
      }
      console.log("rankings layout:", scenario, result);
    }
    await page.getByRole("button", { name: "Quit Game" }).click();
    await page.getByRole("button", { name: "Ready For Next Round" }).click();
    const actions = await page.evaluate(() => ({
      quit: globalThis.rankingsLayoutTest.quit,
      ready: globalThis.rankingsLayoutTest.ready,
    }));
    assert.deepEqual(actions, { quit: 1, ready: 1 });
    assert.deepEqual(pageErrors, []);
    console.log("test-rankings-layout-web: ok");
  } finally {
    await page.evaluate(() => globalThis.rankingsLayoutTest.cleanup());
  }
} finally {
  await browser.close();
}
