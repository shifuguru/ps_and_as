/**
 * Start the Expo web server, then run node scripts/test-reduced-motion-web.mjs.
 * PLAYWRIGHT_BROWSER_EXECUTABLE_PATH can select an installed browser.
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
  await page.emulateMedia({ reducedMotion: "no-preference" });
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
      "src/gameplayPresentation/RunsEffect/RunsPill.tsx",
      "src/gameplayPresentation/GameplayAchievementWidget.tsx",
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
    const RunsPill = get("src/gameplayPresentation/RunsEffect/RunsPill.tsx").default;
    const AchievementWidget = get("src/gameplayPresentation/GameplayAchievementWidget.tsx").default;
    const host = document.createElement("div");
    host.id = "motion-test-host";
    host.style.cssText = "position:fixed;left:0;top:0;width:180px;height:80px;z-index:9999";
    document.body.appendChild(host);
    const root = createRoot(host);
    globalThis.motionTest = {
      render: (active) => root.render(React.createElement(RunsPill, {
        label: "Runs!",
        active,
        pillStyle: { width: 120, height: 36 },
      })),
      unmount: () => { root.unmount(); host.remove(); },
      mountAchievement: () => {
        const achievementHost = document.createElement("div");
        achievementHost.id = "achievement-motion-test-host";
        document.body.appendChild(achievementHost);
        const achievementRoot = createRoot(achievementHost);
        achievementRoot.render(React.createElement(AchievementWidget));
        globalThis.motionTest.unmountAchievement = () => {
          achievementRoot.unmount();
          achievementHost.remove();
        };
      },
    };
    globalThis.motionTest.render(true);
  });
  const host = page.locator("#motion-test-host");
  await host.locator("canvas").waitFor({ state: "attached", timeout: 10000 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await host.locator("canvas").waitFor({ state: "detached" });
  assert.match(await host.innerText(), /Runs!/);
  await page.evaluate(() => globalThis.motionTest.mountAchievement());
  const achievement = page.locator("#achievement-motion-test-host");
  await achievement.getByText(/Upcoming|Next Prestige/).waitFor({ timeout: 10000 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await host.locator("canvas").waitFor({ state: "attached" });
  assert.match(await achievement.innerText(), /Upcoming|Next Prestige/i);
  await page.evaluate(() => globalThis.motionTest.unmountAchievement());
  await page.evaluate(() => globalThis.motionTest.render(false));
  await host.locator("canvas").waitFor({ state: "detached" });
  await page.evaluate(() => globalThis.motionTest.unmount());
  assert.equal(await host.count(), 0);
  console.log("test-reduced-motion-web: ok");
} finally {
  await browser.close();
}
