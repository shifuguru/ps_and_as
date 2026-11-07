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
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 320, height: 568 },
    { width: 375, height: 667 },
    { width: 1200, height: 900 },
  ]) {
    const page = await browser.newPage({ viewport, reducedMotion: "reduce" });
    await page.goto(process.env.EXPO_WEB_URL ?? "http://localhost:8081/", {
      waitUntil: "domcontentloaded",
    });
    await page.getByRole("button", {
      name: "Play. Practice versus AI and learn in one round",
    }).click({ timeout: 60000 });
    const chat = page.getByRole("button", { name: "Quick chat", exact: true });
    await chat.waitFor({ timeout: 60000 });
    await page.locator('[aria-label^="View "][aria-label$=" profile"]').first().waitFor();
    assert.equal(await chat.count(), 1);
    assert.equal(await chat.locator("..").getByText("You", { exact: true }).count(), 1,
      `${viewport.width}: quick chat must be the local player's avatar`);
    assert.equal(await chat.locator("svg").count(), 1,
      `${viewport.width}: the avatar must show the chat indicator`);
    const unobstructed = await chat.evaluate((element) => {
      const box = element.getBoundingClientRect();
      return [[0.5, 0.1], [0.9, 0.5], [0.5, 0.5], [0.1, 0.5], [0.5, 0.9]]
        .map(([x, y]) => {
          const hit = document.elementFromPoint(box.x + box.width * x, box.y + box.height * y);
          return element.contains(hit) ? "ok" : hit?.outerHTML.slice(0, 250);
        });
    });
    assert.ok(unobstructed.every((point) => point === "ok"),
      `${viewport.width}: chat hit target is obstructed: ${unobstructed}`);
    await chat.click();
    await page.getByText("Quick Chat", { exact: true }).waitFor();
    await page.getByRole("button", { name: "Nice one", exact: true }).click();
    await chat.getByText("Nice one", { exact: true }).waitFor();
    const opponent = page.locator('[aria-label^="View "][aria-label$=" profile"]').first();
    await opponent.click();
    await page.getByText("CPU skill tier", { exact: false }).waitFor();
    await page.close();
  }
  console.log("test-table-chat-seat-web: ok");
} finally {
  await browser.close();
}
