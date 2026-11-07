/**
 * Start the Expo web server, then run node scripts/test-hint-web.mjs.
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

  async function mountHint() {
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
        "src/gameplayPresentation/GameplayHint.tsx",
        "src/context/ThemeContext.tsx",
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
      const Hint = get("src/gameplayPresentation/GameplayHint.tsx").default;
      const { ThemeProvider, useAppTheme } = get("src/context/ThemeContext.tsx");
      function TestHint({ yourTurn, visible }) {
        const theme = useAppTheme();
        globalThis.hintTheme = theme;
        return React.createElement(
          "div",
          { "data-theme": theme.mode, "data-loaded": String(theme.preferencesLoaded) },
          React.createElement(Hint, { message: "Test tip", yourTurn, visible }),
        );
      }
      const host = document.createElement("div");
      host.id = "hint-test-host";
      host.style.cssText = "position:fixed;left:0;top:0;width:100%;z-index:9999";
      document.body.appendChild(host);
      const root = createRoot(host);
      globalThis.hintTest = {
        render: (yourTurn, visible = true) => root.render(
          React.createElement(ThemeProvider, null, React.createElement(TestHint, { yourTurn, visible })),
        ),
      };
      globalThis.hintTest.render(true);
    });
  }

  await mountHint();
  const host = page.locator("#hint-test-host");
  await host.locator('[data-loaded="true"]').waitFor();
  await host.getByText("Test tip").waitFor();
  const hide = host.getByRole("button", { name: "Hide hint" });
  await hide.waitFor();
  let turnBackground;
  for (const mode of ["dark", "light"]) {
    await page.evaluate((value) => globalThis.hintTheme.setAppearancePreference(value), mode);
    await host.locator(`[data-theme="${mode}"]`).waitFor();
    for (const tint of ["#1d5537", "#7a2424", "#1a3978", "#806b1d", "#762e6d", "#808080"]) {
      await page.evaluate((value) => globalThis.hintTheme.setFeltTint(value), tint);
      await page.waitForFunction((value) => globalThis.hintTheme.feltTint === value, tint);
      const appearance = await hide.evaluate((node) => {
        const color = (value) => {
          const parts = value.match(/[\d.]+/g).map(Number);
          return parts.slice(0, 3).map((part) => part / 255);
        };
        const luminance = (rgb) => rgb.reduce((sum, channel, index) => {
          const linear = channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
          return sum + linear * [0.2126, 0.7152, 0.0722][index];
        }, 0);
        const background = getComputedStyle(node).backgroundColor;
        const stroke = color(getComputedStyle(node.querySelector("svg path")).stroke);
        const base = color(background);
        const shade = color(getComputedStyle(node.querySelector('[data-testid="hint-turn-fill"]')).backgroundColor);
        const maxOpacity = globalThis.hintTheme.mode === "dark" ? 0.32 : 0.14;
        const contrasts = [0, maxOpacity].map((opacity) => {
          const backdrop = base.map((value, index) => value * (1 - opacity) + shade[index] * opacity);
          const [a, b] = [luminance(backdrop), luminance(stroke)].sort((x, y) => y - x);
          return (a + 0.05) / (b + 0.05);
        });
        return { background, contrast: Math.min(...contrasts) };
      });
      assert.ok(appearance.contrast >= 3, `${mode} ${tint} bulb contrast: ${appearance.contrast}`);
      turnBackground = appearance.background;
    }
    const halo = host.getByTestId("hint-turn-pulse");
    await halo.waitFor();
    await page.waitForFunction(() => {
      const node = document.querySelector('#hint-test-host [data-testid="hint-turn-pulse"]');
      return node && new DOMMatrixReadOnly(getComputedStyle(node).transform).a >= 1.35;
    }, null, { timeout: 5000 });
    await page.waitForFunction(() => {
      const node = document.querySelector('#hint-test-host [data-testid="hint-turn-pulse"]');
      return node && new DOMMatrixReadOnly(getComputedStyle(node).transform).a <= 1.05;
    }, null, { timeout: 5000 });
    await page.waitForFunction(() => {
      const node = document.querySelector('#hint-test-host [data-testid="hint-turn-fill"]');
      return node && Number(getComputedStyle(node).opacity) < 0.01;
    }, null, { timeout: 5000 });
    await page.waitForFunction(() => {
      const node = document.querySelector('#hint-test-host [data-testid="hint-turn-fill"]');
      return node && Number(getComputedStyle(node).opacity) > 0.12;
    }, null, { timeout: 5000 });
  }
  await hide.click();
  await host.getByRole("button", { name: "Show hint" }).waitFor();
  await page.waitForFunction(() => localStorage.getItem("@ps_and_as_hint_expanded") === "0");

  await page.evaluate(() => globalThis.hintTest.render(false, false));
  await page.evaluate(() => globalThis.hintTest.render(false, true));
  const show = host.getByRole("button", { name: "Show hint" });
  await show.waitFor();
  assert.equal(await host.getByText("Test tip").count(), 0);
  assert.notEqual(await show.evaluate((node) => getComputedStyle(node).backgroundColor), turnBackground);
  assert.equal(await host.getByTestId("hint-turn-pulse").count(), 0);

  await mountHint();
  await host.getByRole("button", { name: "Show hint" }).waitFor();
  assert.equal(await host.getByText("Test tip").count(), 0);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await host.getByTestId("hint-turn-pulse").waitFor();
  await page.waitForFunction(() => {
    const node = document.querySelector('#hint-test-host [data-testid="hint-turn-pulse"]');
    return node && new DOMMatrixReadOnly(getComputedStyle(node).transform).a >= 1.35;
  }, null, { timeout: 5000 });
  await host.getByRole("button", { name: "Show hint" }).click();
  await host.getByText("Test tip").waitFor();
  await page.waitForFunction(() => localStorage.getItem("@ps_and_as_hint_expanded") === "1");
  console.log("test-hint-web: ok");
} finally {
  await browser.close();
}
