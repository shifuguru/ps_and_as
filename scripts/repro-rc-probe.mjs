/**
 * Instant Round Complete crash probe via ?rcProbe=1
 *   node scripts/repro-rc-probe.mjs [baseUrl]
 */
import { chromium } from "playwright";

const base = (process.argv[2] ?? "http://localhost:8081/").replace(/\/?$/, "/");
const url = `${base}?rcProbe=1`;

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const pageErrors = [];
const consoleLines = [];

page.on("pageerror", (e) => pageErrors.push(`${e.message}\n${e.stack || ""}`));
page.on("console", (msg) => {
  const t = msg.text();
  if (
    t.includes("[RC-CRASH-TRACE]") ||
    t.includes("[ROUND-END-PHASE]") ||
    t.includes("[ROUND-END-CRASH]") ||
    t.includes("[AppErrorBoundary]") ||
    msg.type() === "error"
  ) {
    consoleLines.push(`[${msg.type()}] ${t}`);
  }
});

await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90_000 });
await page.waitForTimeout(4000);

const finalUrl = page.url();
const body = await page.locator("body").innerText().catch(() => "");
const dump = await page
  .evaluate(() => ({
    crash: globalThis.__LAST_APP_CRASH ?? null,
    trace: globalThis.__RC_CRASH_TRACE ?? null,
    phaseTrace: globalThis.__ROUND_END_PHASE_TRACE ?? null,
  }))
  .catch((e) => ({ evaluateError: String(e) }));

console.log("--- RC probe ---");
console.log("url:", finalUrl);
console.log("bodySnippet:", body.slice(0, 400).replace(/\s+/g, " "));
console.log("pageErrors:", pageErrors.length ? pageErrors.join("\n---\n") : "(none)");
console.log("console:", consoleLines.slice(-40).join("\n") || "(none)");
console.log("dump:", JSON.stringify(dump, null, 2));

await browser.close();
const crashed =
  pageErrors.length > 0 ||
  finalUrl.includes("readme-fallback") ||
  !!dump?.crash;
process.exit(crashed ? 1 : 0);
