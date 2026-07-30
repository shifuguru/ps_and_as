/**
 * Capture review-package screenshots from a running web build.
 * Usage: node scripts/review-package-screenshots.mjs [baseUrl]
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const base = (process.argv[2] ?? "https://shifuguru.github.io/ps_and_as/").replace(/\/?$/, "/");
const outDir = path.join("docs", "review-assets", "screenshots");
fs.mkdirSync(outDir, { recursive: true });

const viewport = { width: 1440, height: 900 };

async function shot(page, name) {
  const file = path.join(outDir, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log("saved", file);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport });
page.setDefaultTimeout(60000);

try {
  await page.goto(base, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("text=Quick Game", { timeout: 45000 });
  await page.waitForTimeout(1500);
  await shot(page, "01-main-menu");

  await page.getByText("Create Game", { exact: true }).click();
  await page.waitForSelector("text=Start Game", { timeout: 30000 });
  await page.waitForTimeout(1200);
  await shot(page, "02-create-game-lobby");

  await page.getByText("Leave Game", { exact: true }).click({ timeout: 10000 }).catch(() => {});
  await page.waitForSelector("text=Quick Game", { timeout: 30000 }).catch(() => {});

  await page.getByText("Join Game", { exact: true }).click();
  await page.waitForSelector("text=Find Game", { timeout: 30000 });
  await page.waitForTimeout(1200);
  await shot(page, "03-join-game");

  await page.getByText("Back", { exact: true }).first().click().catch(async () => {
    await page.goto(base, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("text=Quick Game", { timeout: 30000 });
  });
  await page.waitForSelector("text=Quick Game", { timeout: 30000 });

  await page.getByText("Quick Game", { exact: true }).click();
  await page.waitForSelector("text=Leave Game", { timeout: 30000 });
  await page.waitForTimeout(3500);
  await shot(page, "04-deal-ceremony-or-mid-deal");

  // Wait for deal animation / trade or gameplay
  await page.waitForTimeout(8000);
  await shot(page, "05-mid-round");

  // Try to reach rankings by passing repeatedly (CPU plays)
  for (let i = 0; i < 40; i++) {
    const passBtn = page.getByText("Pass", { exact: true });
    const readyBtn = page.getByText("Ready", { exact: true });
    if (await readyBtn.isVisible().catch(() => false)) {
      await shot(page, "11-rankings");
      break;
    }
    if (await passBtn.isVisible().catch(() => false)) {
      await passBtn.click().catch(() => {});
    }
    await page.waitForTimeout(2500);
    if (i === 15) await shot(page, "06-gameplay-continued");
  }

  await page.goto(`${base}mission-control`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4000);
  await shot(page, "12-mission-control");
} catch (err) {
  console.error("capture error:", err.message);
  await shot(page, "error-state");
} finally {
  await browser.close();
}

console.log("done:", outDir);
