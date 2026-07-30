/**
 * Force round-end while in an active Quick Game (uses __PS_FORCE_ROUND_END).
 *   node scripts/repro-force-round-end.mjs [baseUrl]
 */
import { chromium } from "playwright";

const base = process.argv[2] ?? "http://localhost:8081/";

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

console.log("goto", base);
await page.goto(base, { waitUntil: "domcontentloaded", timeout: 90_000 });
await page.waitForSelector("text=Quick Game", { timeout: 60_000 });
console.log("click Quick Game");
await page.getByText("Quick Game", { exact: true }).click();
await page.waitForSelector("text=Leave Game", { timeout: 60_000 });

// Wait until deal ceremony finishes so rankingsEligible is true.
console.log("waiting for play (Pass/Play)...");
await page
  .getByRole("button", { name: /^(play|pass)$/i })
  .first()
  .waitFor({ state: "visible", timeout: 120_000 })
  .catch(() => {});
await page.waitForTimeout(800);

console.log("in game — forcing round end");

const forced = await page.evaluate(() => {
  const fn = globalThis.__PS_FORCE_ROUND_END;
  if (typeof fn !== "function") return { ok: false, reason: "no force hook" };
  fn();
  return { ok: true };
});
console.log("force:", forced);

await page.waitForTimeout(2500);

const finalUrl = page.url();
const body = await page.locator("body").innerText().catch(() => "");
const dump = await page
  .evaluate(() => {
    const dbg = globalThis.__PS_DEBUG_ROUND;
    return {
      crash: globalThis.__LAST_APP_CRASH ?? null,
      trace: (globalThis.__RC_CRASH_TRACE ?? []).slice(-40),
      debug: typeof dbg === "function" ? dbg() : null,
    };
  })
  .catch((e) => ({ evaluateError: String(e) }));

console.log("--- force round-end ---");
console.log("finalUrl:", finalUrl);
console.log("bodySnippet:", body.slice(0, 500).replace(/\s+/g, " "));
console.log("pageErrors:", pageErrors.length ? pageErrors.join("\n---\n") : "(none)");
console.log("console:", consoleLines.slice(-50).join("\n") || "(none)");
console.log("dump:", JSON.stringify(dump, null, 2));

await browser.close();
const crashed =
  pageErrors.length > 0 ||
  finalUrl.includes("readme-fallback") ||
  !!dump?.crash;
process.exit(crashed ? 1 : 0);
