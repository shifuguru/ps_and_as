/**
 * Repro round-end UI crash — Playwright smoke.
 *   node scripts/repro-round-end-crash.mjs [baseUrl]
 */
import { chromium } from "playwright";

const base = process.argv[2] ?? "http://localhost:8081/";
const MAX_MS = 600_000;

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const pageErrors = [];
const consoleErrors = [];

const rcTrace = [];
page.on("pageerror", (e) => {
  pageErrors.push(`${e.message}\n${e.stack || ""}`);
});
page.on("console", (msg) => {
  const t = msg.text();
  if (t.includes("[RC-CRASH-TRACE]")) rcTrace.push(t);
  if (
    msg.type() === "error" ||
    t.includes("AppErrorBoundary") ||
    t.includes("[RC-CRASH-TRACE]")
  ) {
    consoleErrors.push(t);
  }
});

await page.goto(base, { waitUntil: "domcontentloaded", timeout: 90_000 });
await page.waitForSelector("text=Quick Game", { timeout: 30_000 });
await page.getByText("Quick Game", { exact: true }).click();
await page.waitForSelector("text=Leave Game", { timeout: 30_000 });

const start = Date.now();
let sawLastHand = false;
let sawRoundComplete = false;

while (Date.now() - start < MAX_MS) {
  const url = page.url();
  if (url.includes("readme-fallback")) {
    console.log("CRASH: redirected to readme-fallback");
    break;
  }

  const body = await page.locator("body").innerText();
  if (/last hand/i.test(body)) sawLastHand = true;
  if (/round complete/i.test(body) || /final rankings/i.test(body)) {
    sawRoundComplete = true;
    await page.waitForTimeout(2000);
    break;
  }

  const playBtn = page.getByRole("button", { name: /^play$/i });
  const passBtn = page.getByRole("button", { name: /^pass$/i });

  if (await playBtn.isVisible().catch(() => false)) {
    const disabled = await playBtn.isDisabled().catch(() => true);
    if (!disabled) {
      await playBtn.click().catch(() => {});
      await page.waitForTimeout(300);
      continue;
    }
  }

  if (await passBtn.isVisible().catch(() => false)) {
    const disabled = await passBtn.isDisabled().catch(() => true);
    if (!disabled) {
      await passBtn.click().catch(() => {});
      await page.waitForTimeout(300);
      continue;
    }
  }

  await page.waitForTimeout(250);
}

const finalUrl = page.url();
const finalBody = await page.locator("body").innerText().catch(() => "");
const lastCrash = await page
  .evaluate(() => globalThis.__LAST_APP_CRASH ?? null)
  .catch(() => null);

console.log("--- round-end repro ---");
console.log("finalUrl:", finalUrl);
console.log("sawLastHand:", sawLastHand);
console.log("sawRoundComplete:", sawRoundComplete);
console.log("elapsedMs:", Date.now() - start);
console.log("bodySnippet:", finalBody.slice(0, 500).replace(/\s+/g, " "));
console.log("pageErrors:", pageErrors.length ? pageErrors.join("\n---\n") : "(none)");
console.log(
  "consoleErrors:",
  consoleErrors.length ? consoleErrors.slice(0, 40).join("\n") : "(none)",
);
console.log(
  "rcTrace (last 30):",
  rcTrace.length ? rcTrace.slice(-30).join("\n") : "(none)",
);
console.log(
  "__LAST_APP_CRASH:",
  lastCrash ? JSON.stringify(lastCrash, null, 2) : "(none)",
);

await browser.close();
process.exit(pageErrors.length || finalUrl.includes("readme-fallback") ? 1 : 0);
