#!/usr/bin/env node
/**
 * Autonomous QA League — runs all implemented bots, publishes agent report.
 *
 *   npm run server
 *   npm run qa-league
 *   npm run qa-league -- --minutes 15 --bots chaos,speed,ready_spam,exploit
 *   npm run qa-league:watch
 *
 * Agent reads: reports/qa/latest/AGENT_BRIEF.md
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

import { runBotSession } from "./lib/runBotSession.mjs";
import { buildAgentReport, publishLatestReport } from "./lib/agentReport.mjs";
import { waitForServer } from "./lib/serverHealth.mjs";
import { parseBotList, leagueBots } from "./lib/personalities/index.mjs";
import { isQALeagueDevEnabled } from "./lib/spawnRules.mjs";

const require = createRequire(import.meta.url);
const { BOT_ROOM_CODE } = require("../../server/botHostedRooms.js");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");

const SERVER = process.env.SERVER_URL ?? "http://localhost:4000";
const BUILD =
  process.env.QA_BUILD ?? process.env.npm_package_version ?? "dev";

function parseArgs(argv) {
  let room = process.env.QA_ROOM ?? BOT_ROOM_CODE;
  let minutes = Number(process.env.QA_MINUTES ?? "10");
  let botsCsv = process.env.QA_BOTS ?? "";
  let relaxGaps = true;
  let skipServerWait = false;
  let watchMinutes = 0;

  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--room" && argv[i + 1]) room = String(argv[++i]).trim().toUpperCase();
    else if (a === "--minutes" && argv[i + 1]) minutes = Number(argv[++i]);
    else if (a === "--bots" && argv[i + 1]) botsCsv = argv[++i];
    else if (a === "--strict-gaps") relaxGaps = false;
    else if (a === "--skip-server-wait") skipServerWait = true;
    else if (a === "--watch" && argv[i + 1]) watchMinutes = Number(argv[++i]);
    else if (a === "--help" || a === "-h") {
      console.log(`Usage: node scripts/qa/run-league.mjs [options]

  --minutes N         Per-bot run length (default 10)
  --room CODE         BOTOPN or QALEG
  --bots a,b,c        chaos,speed,ready_spam,exploit (default: all implemented)
  --strict-gaps       Full coverage thresholds
  --watch N           Repeat full league every N minutes until Ctrl+C
  --skip-server-wait  Do not poll /api/online-players

Publishes: reports/qa/latest/AGENT_BRIEF.md  (for Cursor agent iteration)
`);
      process.exit(0);
    }
  }

  return { room, minutes, botsCsv, relaxGaps, skipServerWait, watchMinutes };
}

async function runOnce(opts) {
  const { room, minutes, botsCsv, relaxGaps, skipServerWait } = opts;
  const leagueRunId = `league-${Date.now()}`;
  const botIds = parseBotList(botsCsv);

  console.log("QA League — autonomous run");
  console.log(`  server=${SERVER} room=${room} ${minutes}m × ${botIds.length} bots`);
  console.log(`  bots: ${botIds.join(", ")}`);

  if (!skipServerWait) {
    console.log("  waiting for server…");
    await waitForServer(SERVER);
  }

  if (room !== BOT_ROOM_CODE && !isQALeagueDevEnabled()) {
    console.warn(
      `[QA] For ${room}, set PS_QA_LEAGUE=1 on server (and runner) for QALEG.`,
    );
  }

  const sessions = await Promise.all(
    botIds.map((personality) =>
      runBotSession({
        root: ROOT,
        serverUrl: SERVER,
        room,
        personality,
        minutes,
        instance: 1,
        relaxGaps,
        build: BUILD,
        runIdPrefix: leagueRunId,
        quiet: false,
      }),
    ),
  );

  const report = buildAgentReport(sessions, {
    leagueRunId,
    serverUrl: SERVER,
    room,
    build: BUILD,
    minutesPerBot: minutes,
    bots: botIds,
    status: undefined,
  });

  const latestDir = publishLatestReport(ROOT, report);

  console.log("\n── League finished ──");
  console.log(`Status: ${report.status}`);
  console.log(`Agent brief → ${latestDir}/AGENT_BRIEF.md`);
  console.log(`JSON        → ${latestDir}/agent-report.json`);

  if (report.actionItems.length) {
    console.log("\nTop action items:");
    for (const item of report.actionItems.slice(0, 6)) {
      console.log(`  [${item.priority}] ${item.title}`);
    }
  }

  const indexPath = path.join(ROOT, "reports", "qa", "index.jsonl");
  fs.mkdirSync(path.dirname(indexPath), { recursive: true });
  fs.appendFileSync(
    indexPath,
    `${JSON.stringify({
      leagueRunId,
      at: report.generatedAt,
      status: report.status,
      latestDir,
      actionCount: report.actionItems.length,
    })}\n`,
    "utf8",
  );

  if (report.status === "fail") process.exitCode = 1;
  return report;
}

async function main() {
  const opts = parseArgs(process.argv);

  if (opts.watchMinutes > 0) {
    console.log(`Watch mode: re-run every ${opts.watchMinutes} minutes`);
    for (;;) {
      await runOnce(opts);
      console.log(`\nSleeping ${opts.watchMinutes}m…\n`);
      await new Promise((r) => setTimeout(r, opts.watchMinutes * 60_000));
    }
  }

  await runOnce(opts);
}

main().catch((err) => {
  console.error("FAIL", err?.message ?? err);
  process.exit(1);
});
