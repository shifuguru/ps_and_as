/**
 * Consolidated report for Cursor / agents to iterate on the app.
 */
import fs from "fs";
import path from "path";

import { getQABot } from "./botRoster.mjs";

export const LATEST_DIR_NAME = "latest";

/** Server messages that Breaker/Chaos intentionally trigger — not app bugs. */
const EXPECTED_PROBE_ERRORS = new Set([
  "Not your turn",
  "Cannot pass now",
  "Spectators cannot play — claim a seat first",
  "Invalid play",
  "You are not seated in this round yet",
  "Reconnect to continue playing",
]);

/** @typedef {Awaited<ReturnType<import('./runBotSession.mjs').runBotSession>>} BotSessionResult */

const AREA_HINTS = {
  bot_cpu_stall: [
    "server/botHostedRooms.js",
    "server/turnAdvance.js",
    "src/game/core.ts",
  ],
  turn: [
    "server/botHostedRooms.js",
    "server/turnAdvance.js",
    "src/game/core.ts",
  ],
  round: ["server/botHostedRooms.js", "server/index.js"],
  stateVersion: ["server/gameSync.js", "server/index.js"],
  hand: ["src/game/core.ts", "server/index.js"],
  sync: ["server/gameSync.js", "server/index.js", "src/screens/GameScreen.tsx"],
};

/**
 * @param {BotSessionResult[]} sessions
 * @param {object} meta
 */
export function buildAgentReport(sessions, meta) {
  const actionItems = [];
  let status = "pass";

  for (const s of sessions) {
    if (s.crashed) {
      status = "fail";
      actionItems.push({
        priority: "P0",
        kind: "crash",
        title: `${s.displayName} session crashed`,
        detail: s.crashed,
        ownerBot: s.displayName,
        personality: s.personality,
        likelyAreas: ["scripts/qa/", "server/index.js"],
        evidence: { runId: s.runId, reportDir: s.reportDir },
      });
    }

    for (const inv of s.criticalInvariants) {
      status = "fail";
      actionItems.push(invariantToAction(inv, s));
    }

    for (const inv of s.invariants.filter(
      (f) => f.severity === "medium" && f.area === "turn",
    )) {
      if (status === "pass") status = "warn";
      actionItems.push(invariantToAction(inv, s));
    }

    for (const [msg, count] of Object.entries(s.serverErrorCounts)) {
      if (EXPECTED_PROBE_ERRORS.has(msg)) continue;
      if (count < 5) continue;
      if (status === "pass") status = "warn";
      actionItems.push({
        priority: "P2",
        kind: "server_error",
        title: `Repeated server error: ${msg}`,
        detail: `${count} rejections during ${s.minutes}m run`,
        ownerBot: s.displayName,
        personality: s.personality,
        likelyAreas: ["server/index.js", "src/game/core.ts"],
        evidence: { runId: s.runId, count, message: msg },
      });
    }

    for (const gap of s.coverage.gaps.filter((g) => g.failOvernight)) {
      status = "fail";
      const owner = getQABot(gap.owner);
      actionItems.push({
        priority: gap.gapSeverity === "critical" ? "P0" : "P1",
        kind: "coverage_gap",
        title: `Coverage gap: ${gap.label}`,
        detail: `${gap.count} / ${gap.minExpected} (owner ${owner.displayName})`,
        ownerBot: owner.displayName,
        personality: gap.owner,
        likelyAreas: AREA_HINTS[gap.metric] ?? ["scripts/qa/"],
        evidence: { runId: s.runId, metric: gap.metric },
      });
    }
  }

  const deduped = dedupeActions(actionItems);
  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    ...meta,
    status,
    sessionCount: sessions.length,
    sessions: sessions.map(sessionSummary),
    actionItems: deduped,
    promptForAgent: buildAgentPrompt(deduped, {
      ...meta,
      status,
      sessionCount: sessions.length,
    }),
  };

  return report;
}

/**
 * @param {object} inv
 * @param {BotSessionResult} session
 */
function invariantToAction(inv, session) {
  const priority =
    inv.severity === "critical"
      ? "P0"
      : inv.severity === "high"
        ? "P1"
        : "P2";
  return {
    priority,
    kind: "invariant",
    title: `${inv.area}: ${inv.expected}`,
    detail: inv.actual,
    ownerBot: session.displayName,
    personality: session.personality,
    likelyAreas: AREA_HINTS[inv.area] ?? ["server/", "src/game/"],
    evidence: {
      runId: session.runId,
      stateVersion: inv.stateVersion,
      phase: inv.phase,
      reportDir: session.reportDir,
    },
  };
}

/**
 * @param {BotSessionResult} s
 */
function sessionSummary(s) {
  return {
    runId: s.runId,
    personality: s.personality,
    displayName: s.displayName,
    botId: s.profileId,
    room: s.room,
    minutes: s.minutes,
    crashed: s.crashed,
    invariantCount: s.invariants.length,
    criticalInvariantCount: s.criticalInvariants.length,
    serverErrorCount: s.serverErrors.length,
    coverageCounts: s.coverage.counts,
    reportDir: s.reportDir,
  };
}

/**
 * @param {object[]} items
 */
function dedupeActions(items) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const key = `${item.kind}|${item.title}|${item.detail}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out.sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority));
}

/** @param {string} p */
function priorityRank(p) {
  if (p === "P0") return 0;
  if (p === "P1") return 1;
  if (p === "P2") return 2;
  return 3;
}

/**
 * @param {object[]} actionItems
 * @param {object} meta
 */
function buildAgentPrompt(actionItems, meta) {
  const lines = [
    "QA League autonomous run finished. Read this report and fix the app.",
    "",
    `Server: ${meta.serverUrl}  Room: ${meta.room}  Build: ${meta.build}`,
    `Status: ${meta.status}  Sessions: ${meta.sessionCount ?? "?"}`,
    "",
  ];

  if (actionItems.length === 0) {
    lines.push("No P0/P1 issues. Consider extending coverage or adding personalities.");
    return lines.join("\n");
  }

  lines.push("## Action items (fix in priority order)");
  for (const item of actionItems.slice(0, 12)) {
    lines.push(
      `- [${item.priority}] ${item.title}`,
      `  ${item.detail}`,
      `  Bot: ${item.ownerBot}  Files: ${(item.likelyAreas ?? []).join(", ")}`,
      `  Evidence: ${JSON.stringify(item.evidence)}`,
    );
  }

  lines.push(
    "",
    "After fixes: restart server, run `npm run qa-league`, re-read reports/qa/latest/AGENT_BRIEF.md",
  );
  return lines.join("\n");
}

/**
 * Write reports/qa/latest/* for agent consumption.
 * @param {string} root
 * @param {object} report
 */
export function publishLatestReport(root, report) {
  const latestDir = path.join(root, "reports", "qa", LATEST_DIR_NAME);
  fs.mkdirSync(latestDir, { recursive: true });

  fs.writeFileSync(
    path.join(latestDir, "agent-report.json"),
    JSON.stringify(report, null, 2),
    "utf8",
  );

  const brief = formatAgentBrief(report);
  fs.writeFileSync(path.join(latestDir, "AGENT_BRIEF.md"), brief, "utf8");

  fs.writeFileSync(
    path.join(latestDir, "PROMPT.txt"),
    report.promptForAgent,
    "utf8",
  );

  return latestDir;
}

/**
 * @param {object} report
 */
export function formatAgentBrief(report) {
  const lines = [
    "# QA League — Agent brief",
    "",
    `Generated: ${report.generatedAt}`,
    `Status: **${report.status}**`,
    `Room: \`${report.room}\`  |  Build: \`${report.build}\`  |  Duration: ${report.minutesPerBot}m/bot`,
    "",
    report.promptForAgent,
    "",
    "## Sessions",
    "",
  ];

  for (const s of report.sessions) {
    lines.push(
      `- **${s.displayName}** (\`${s.runId}\`) — invariants: ${s.invariantCount} (critical ${s.criticalInvariantCount}), server errors: ${s.serverErrorCount}${s.crashed ? ` — CRASH: ${s.crashed}` : ""}`,
      `  - Report folder: \`reports/qa/${s.runId}/\``,
    );
  }

  if (report.actionItems?.length) {
    lines.push("", "## Action items", "");
    for (const item of report.actionItems) {
      lines.push(
        `### [${item.priority}] ${item.title}`,
        "",
        item.detail,
        "",
        `- **Bot:** ${item.ownerBot}`,
        `- **Likely files:** ${(item.likelyAreas ?? []).join(", ")}`,
        `- **Evidence:** \`${JSON.stringify(item.evidence)}\``,
        "",
      );
    }
  }

  lines.push(
    "---",
    "",
    "Full JSON: `reports/qa/latest/agent-report.json`",
    "",
    "_Overnight fail: critical + high coverage gaps (see coverageMetrics.mjs)._",
  );

  return lines.join("\n");
}
