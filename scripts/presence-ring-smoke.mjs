import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const base = process.argv[2] ?? "http://localhost:8081/";
const outDir = path.join("scripts", "presence-ring-screenshots");
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));

await page.goto(base, { waitUntil: "domcontentloaded", timeout: 90000 });
await page.waitForSelector("text=Quick Game", { timeout: 30000 });
await page.screenshot({ path: path.join(outDir, "01-menu.png") });

await page.getByText("Quick Game", { exact: true }).click();
await page.waitForSelector("text=Leave Game", { timeout: 30000 });
await page.waitForTimeout(2500);
await page.screenshot({ path: path.join(outDir, "02-quick-game-ring.png") });

console.log("url:", page.url());
console.log("errors:", errors.length ? errors.join("\n") : "(none)");
console.log("screenshots:", outDir);

await browser.close();
