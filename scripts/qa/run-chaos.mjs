#!/usr/bin/env node
/**
 * Single-bot Chaos run (wraps shared session runner).
 * For full league + agent report use: npm run qa-league
 */
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

import { runBotSession } from "./lib/runBotSession.mjs";
import { buildAgentReport, publishLatestReport } from "./lib/agentReport.mjs";
import { waitForServer } from "./lib/serverHealth.mjs";
import { isQALeagueDevEnabled, isSecretQALeagueRoom } from "./lib/spawnRules.mjs";

const require = createRequire(import.meta.url);
const { BOT_ROOM_CODE } = require("../../server/botHostedRooms.js");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const SERVER = process.env.SERVER_URL ?? "http://localhost:4000";
const BUILD = process.env.QA_BUILD ?? "dev";

function parseArgs(argv) {
  let room = process.env.QA_ROOM ?? BOT_ROOM_CODE;
  let minutes = Number(process.env.QA_MINUTES ?? "5");
  let instance = 1;
  let relaxGaps = true;
  let skipServerWait = false;

  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--room" && argv[i + 1]) room = String(argv[++i]).trim().toUpperCase();
    else if (a === "--minutes" && argv[i + 1]) minutes = Number(argv[++i]);
    else if (a === "--instance" && argv[i + 1]) instance = Number(argv[++i]);
    else if (a === "--strict-gaps") relaxGaps = false;
    else if (a === "--skip-server-wait") skipServerWait = true;
    else if (a === "--help" || a === "-h") {
      console.log("Usage: node scripts/qa/run-chaos.mjs [--minutes N] [--room CODE]");
      console.log("Full league: npm run qa-league");
      process.exit(0);
    }
  }
  return { room, minutes, instance, relaxGaps, skipServerWait };
}

async function main() {
  const { room, minutes, instance, relaxGaps, skipServerWait } = parseArgs(
    process.argv,
  );

  if (!skipServerWait) await waitForServer(SERVER);

  if (room === "QALEG" && !isSecretQALeagueRoom(room)) {
    console.warn("Note: QALEG is not in secret room list — continuing anyway.");
  }
  if (!isQALeagueDevEnabled() && room !== BOT_ROOM_CODE) {
    console.warn(`[QA] Use BOTOPN or enable PS_QA_LEAGUE for ${room}.`);
  }

  console.log(`QA League — 🎲 Chaos (${minutes}m)`);

  const session = await runBotSession({
    root: ROOT,
    serverUrl: SERVER,
    room,
    personality: "chaos",
    minutes,
    instance,
    relaxGaps,
    build: BUILD,
    runIdPrefix: "chaos",
  });

  const report = buildAgentReport([session], {
    leagueRunId: session.runId,
    serverUrl: SERVER,
    room,
    build: BUILD,
    minutesPerBot: minutes,
    bots: ["chaos"],
  });

  const latestDir = publishLatestReport(ROOT, report);
  console.log(`\nAgent brief → ${latestDir}/AGENT_BRIEF.md`);

  if (report.status === "fail") process.exitCode = 1;
}

main().catch((err) => {
  console.error("FAIL", err?.message ?? err);
  process.exit(1);
});
