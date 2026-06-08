/**
 * Optional Quick Game UI smoke — skipped when @playwright/test is not installed.
 *
 *   npx playwright test scripts/release-gate/playwright/quick-game.spec.mjs
 */
import { test } from "@playwright/test";

test.describe("Quick Game smoke", () => {
  test.skip(
    !process.env.PLAYWRIGHT_QUICK_GAME,
    "Set PLAYWRIGHT_QUICK_GAME=1 after installing Playwright and starting web dev server",
  );

  test("home → quick game reaches playing phase", async ({ page }) => {
    const base = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:8081";
    await page.goto(base);
    // Hook data-testid on Home/Quick Game when wiring this test for real.
    await page.getByRole("button", { name: /quick game/i }).click();
    await page.getByRole("button", { name: /start|play/i }).click();
    await page.waitForTimeout(2000);
    // Gameplay assertion placeholder — prefer data-testid="game-phase-playing"
    const body = await page.locator("body").innerText();
    if (!/pass|play|your turn/i.test(body)) {
      throw new Error("Quick Game did not reach an interactive playing state");
    }
  });
});
