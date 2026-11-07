/**
 * Start Expo web, then run node scripts/test-hint-game-web.mjs.
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
  for (const [mode, viewport] of [
    ["dark", { width: 390, height: 844 }],
    ["light", { width: 320, height: 568 }],
    ["dark", { width: 1200, height: 900 }],
  ]) {
    const page = await browser.newPage({
      viewport,
      reducedMotion: "reduce",
    });
    await page.addInitScript((appearance) => {
      localStorage.setItem("@ps_and_as_appearance_mode", appearance);
    }, mode);
    await page.goto(process.env.EXPO_WEB_URL ?? "http://localhost:8081/", {
      waitUntil: "domcontentloaded",
    });
    await page.getByRole("button", {
      name: "Play. Practice versus AI and learn in one round",
    }).click({ timeout: 60000 });
    const hint = page.getByRole("button", { name: "Hide hint" });
    await hint.waitFor({ timeout: 60000 });
    const pass = page.getByRole("button", { name: /Pass Turn/ });
    const play = page.getByRole("button", { name: "Play", exact: true });
    const [passBox, hintBox, playBox, messageBox] = await Promise.all([
      pass.boundingBox(),
      hint.boundingBox(),
      play.boundingBox(),
      page.getByTestId("hint-message").boundingBox(),
    ]);
    assert.ok(passBox && hintBox && playBox && messageBox);
    assert.ok(passBox.x + passBox.width <= hintBox.x &&
      hintBox.x + hintBox.width <= playBox.x,
    `${mode} ${viewport.width}: hint button must sit between Pass and Play`);
    assert.ok(hintBox.y < passBox.y + passBox.height && hintBox.y + hintBox.height > passBox.y,
      `${mode} ${viewport.width}: hint must be in the action row`);
    assert.ok(messageBox.y + messageBox.height <= hintBox.y,
      `${mode} ${viewport.width}: hint message must remain above the action row`);
    const fill = hint.getByTestId("hint-turn-fill");
    await fill.waitFor({ timeout: 60000 });
    const colors = await hint.evaluate((node) => ({
      background: getComputedStyle(node).backgroundColor,
      stroke: getComputedStyle(node.querySelector("svg path")).stroke,
    }));
    assert.notEqual(colors.background, colors.stroke, `${mode} bulb must contrast with its fill`);
    await page.waitForFunction(() => {
      const fill = document.querySelector('[data-testid="hint-turn-fill"]');
      return fill && Number(getComputedStyle(fill).opacity) > 0.12;
    }, null, { timeout: 5000 });
    await page.waitForFunction(() => {
      const fill = document.querySelector('[data-testid="hint-turn-fill"]');
      return fill && Number(getComputedStyle(fill).opacity) < 0.01;
    }, null, { timeout: 5000 });
    await hint.click();
    const collapsed = page.getByRole("button", { name: "Show hint" });
    await collapsed.waitFor();
    assert.equal(await page.getByTestId("hint-message").count(), 0);
    assert.equal(
      await collapsed.getByTestId("hint-turn-fill").count(),
      1,
      "hiding the message must not stop the turn cue",
    );
    await collapsed.click();
    await page.getByTestId("hint-message").waitFor();
    await page.close();
  }
  console.log("test-hint-game-web: ok");
} finally {
  await browser.close();
}
