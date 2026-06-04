/**
 * Run one QA League bot session — join, act, record coverage + invariants.
 */
import fs from "fs";
import path from "path";

import { qaDisplayName, qaProfileId, qaLog } from "./botRoster.mjs";
import {
  createQABotClient,
  joinRoom,
  requestGameState,
  disconnectClient,
} from "./QABotClient.mjs";
import { InvariantEngine } from "./InvariantEngine.mjs";
import { CoverageTracker } from "./CoverageTracker.mjs";
import { getPersonalityDriver } from "./personalities/index.mjs";

/**
 * @param {object} opts
 * @param {string} opts.root Project root (for reports path).
 * @param {string} opts.serverUrl
 * @param {string} opts.room
 * @param {import('./botRoster.mjs').QAPersonalityId} opts.personality
 * @param {number} opts.minutes
 * @param {number} [opts.instance]
 * @param {boolean} [opts.relaxGaps]
 * @param {string} [opts.build]
 * @param {string} [opts.runIdPrefix]
 * @param {boolean} [opts.quiet]
 * @returns {Promise<import('./agentReport.mjs').BotSessionResult>}
 */
export async function runBotSession(opts) {
  const {
    root,
    serverUrl,
    room,
    personality,
    minutes,
    instance = 1,
    relaxGaps = true,
    build = "dev",
    runIdPrefix = "league",
    quiet = false,
  } = opts;

  const profileId = qaProfileId(personality, instance);
  const displayName = qaDisplayName(personality, instance);
  const runId = `${runIdPrefix}-${personality}-${instance}-${Date.now()}`;
  const reportDir = path.join(root, "reports", "qa", runId);
  const invariantsPath = path.join(reportDir, "invariants.jsonl");
  const eventsPath = path.join(reportDir, "events.jsonl");

  if (!quiet) {
    console.log(`  ▶ ${displayName} (${profileId}) → ${room} for ${minutes}m`);
  }

  const tracker = new CoverageTracker();
  const invariants = new InvariantEngine({
    build,
    room,
    botId: profileId,
    displayName,
    personality,
  });

  let prevGameState = null;
  /** @type {object[]} */
  const recentStates = [];
  const serverErrors = /** @type {{ message: string, ts: string }[]} */ ([]);

  const client = createQABotClient({
    serverUrl,
    roomId: room,
    displayName,
    profileId,
    onEvent: (event, data) => {
      appendJsonl(eventsPath, {
        ts: new Date().toISOString(),
        event,
        botId: profileId,
        data:
          event === "gameStateSync"
            ? { stateVersion: data?.gameState?.stateVersion, phase: data?.gameState?.phase }
            : data,
      });

      if (event === "connected") {
        tracker.onConnected({ isSpectator: !!data?.isSpectator });
      }
      if (event === "error") {
        const message = data?.message ?? String(data);
        tracker.onServerError();
        serverErrors.push({ message, ts: new Date().toISOString() });
      }
      if (event === "gameStateSync") {
        const gs = data?.gameState ?? null;
        tracker.onGameState(prevGameState, gs);
        invariants.observe(gs);
        if (gs) {
          recentStates.push({
            ts: new Date().toISOString(),
            stateVersion: gs.stateVersion,
            phase: gs.phase,
            currentPlayerIndex: gs.currentPlayerIndex,
            currentPlayerId: gs.players?.[gs.currentPlayerIndex]?.id,
          });
          if (recentStates.length > 12) recentStates.shift();
        }
        prevGameState = gs;
      }
      if (event === "roundEnded") {
        tracker.onRoundEnded(data ?? {});
      }
      if (event === "nextRoundStarting") {
        tracker.onNextRoundStarting();
      }
    },
  });

  const tick = getPersonalityDriver(personality, { client, tracker });
  let crashed = null;

  try {
    await joinRoom(client);
    if (!quiet) {
      qaLog(personality, `Joined ${room} (spectator=${client.isSpectator})`);
    }

    const endAt = Date.now() + minutes * 60_000;
    let polls = 0;
    while (Date.now() < endAt) {
      if (polls % 8 === 0) requestGameState(client);
      polls++;
      await tick();
      await wait(200);
    }
  } catch (err) {
    crashed = err?.message ?? String(err);
  } finally {
    disconnectClient(client);
  }

  const minScale = relaxGaps ? Math.min(1, minutes / 30) : 1;
  const coverage = tracker.buildSummary(minScale);

  for (const failure of invariants.failures) {
    appendJsonl(invariantsPath, failure);
  }

  const critical = invariants.failures.filter(
    (f) => f.severity === "critical" || f.severity === "high",
  );

  const summary = {
    runId,
    personality,
    botId: profileId,
    displayName,
    room,
    minutes,
    build,
    endedAt: new Date().toISOString(),
    crashed,
    invariantCount: invariants.failures.length,
    criticalInvariantCount: critical.length,
    serverErrorCount: serverErrors.length,
    coverage,
  };

  fs.mkdirSync(reportDir, { recursive: true });
  fs.writeFileSync(
    path.join(reportDir, "coverage-summary.json"),
    JSON.stringify(summary, null, 2),
    "utf8",
  );

  if (recentStates.length) {
    fs.writeFileSync(
      path.join(reportDir, "state-tail.json"),
      JSON.stringify(recentStates, null, 2),
      "utf8",
    );
  }

  const errorCounts = countBy(serverErrors.map((e) => e.message));

  return {
    runId,
    reportDir,
    personality,
    profileId,
    displayName,
    room,
    minutes,
    build,
    crashed,
    summary,
    invariants: invariants.failures,
    criticalInvariants: critical,
    coverage,
    serverErrors,
    serverErrorCounts: errorCounts,
    eventsPath,
    invariantsPath,
  };
}

/**
 * @param {string} filePath
 * @param {object} row
 */
function appendJsonl(filePath, row) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.appendFileSync(filePath, `${JSON.stringify(row)}\n`, "utf8");
}

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * @param {string[]} items
 */
function countBy(items) {
  /** @type {Record<string, number>} */
  const out = {};
  for (const x of items) {
    out[x] = (out[x] ?? 0) + 1;
  }
  return out;
}
