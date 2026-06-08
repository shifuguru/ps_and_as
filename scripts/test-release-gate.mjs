#!/usr/bin/env node
/**
 * Release gameplay gate — blocks deploy when progression is broken.
 *
 *   npm run test-release-gate
 *   npm run test-release-gate:offline
 *
 * Env:
 *   RELEASE_GATE_SPAWN_SERVER=1  spawn server if port closed
 *   SKIP_LIVE=1                  skip live BOTOPN stall (headless still runs)
 *   SKIP_OFFLINE=1               socket tests only
 *   SERVER_URL                   default http://localhost:4000
 */
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import { ensureServer, stopSpawnedServer } from "./release-gate/lib/server.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const OFFLINE_ONLY = process.argv.includes("--offline") || process.env.RELEASE_GATE_OFFLINE === "1";

const OFFLINE_GATES = [
  {
    id: "core",
    title: "Core rules (turn, trades, pass-lock)",
    cmd: "npx",
    args: ["tsx", "./scripts/test-core.ts"],
  },
  {
    id: "roster",
    title: "Table roster + sync guards",
    cmd: "node",
    args: ["scripts/test-table-roster.mjs"],
  },
  {
    id: "offline-sim",
    title: "Offline Quick Game engine simulation (CPU play logic)",
    cmd: "node",
    args: ["scripts/release-gate/offline-round-sim.mjs"],
    env: { OFFLINE_SIM_GAMES: "40", OFFLINE_SIM_PLAYERS: "4" },
  },
  {
    id: "turn-headless",
    title: "Turn ownership — pass-on-run (headless)",
    cmd: "node",
    args: ["scripts/test-cpu-stall-botopn.mjs", "--headless"],
  },
];

const SERVER_GATES = [
  {
    id: "quick-private-2h",
    title: "Private 2-player — 2 rounds + trades",
    cmd: "node",
    args: ["scripts/test-multiplayer-matrix.mjs"],
    env: { ONLY: "2h", ROUNDS: "2" },
  },
  {
    id: "spectator-promote",
    title: "Spectator join + ready promotion",
    cmd: "node",
    args: ["scripts/test-multiplayer-matrix.mjs"],
    env: { ONLY: "2hs", ROUNDS: "1" },
  },
  {
    id: "reconnect-rankings",
    title: "Reconnect during rankings / ready",
    cmd: "node",
    args: ["scripts/test-reconnect-round-complete.mjs"],
  },
  {
    id: "private-reconnect",
    title: "Private room — mid-turn reconnect + next round",
    cmd: "node",
    args: ["scripts/release-gate/private-room-reconnect-gate.mjs"],
  },
  {
    id: "botopn-lifecycle",
    title: "BOTOPN lifecycle (solo cycle, spectator, seated play)",
    cmd: "node",
    args: ["scripts/test-bot-table-lifecycle.mjs"],
  },
  {
    id: "botopn-stall-live",
    title: "BOTOPN live — human pass on run",
    cmd: "node",
    args: ["scripts/test-cpu-stall-botopn.mjs"],
    skip: () => process.env.SKIP_LIVE === "1",
  },
];

function runGate(gate) {
  if (gate.skip?.()) {
    return Promise.resolve({ id: gate.id, skipped: true });
  }

  return new Promise((resolve, reject) => {
    const started = Date.now();
    const child = spawn(gate.cmd, gate.args, {
      cwd: ROOT,
      stdio: "inherit",
      shell: process.platform === "win32",
      env: { ...process.env, ...gate.env },
    });

    child.on("error", reject);
    child.on("close", (code) => {
      const ms = Date.now() - started;
      if (code === 0) {
        resolve({ id: gate.id, ms, ok: true });
      } else {
        reject(
          Object.assign(new Error(`Gate failed: ${gate.id} (exit ${code})`), {
            id: gate.id,
            code,
            ms,
          }),
        );
      }
    });
  });
}

async function main() {
  console.log("═".repeat(60));
  console.log("RELEASE GAMEPLAY GATE");
  console.log(OFFLINE_ONLY ? "Mode: offline only" : "Mode: full (offline + server)");
  console.log("═".repeat(60));

  const failures = [];
  const passed = [];
  const skipped = [];

  let serverChild = null;

  if (!OFFLINE_ONLY && process.env.SKIP_OFFLINE !== "1") {
    // offline first — fast fail
  }

  const offlineGates =
    process.env.SKIP_OFFLINE === "1" ? [] : OFFLINE_GATES;

  for (const gate of offlineGates) {
    console.log(`\n▶ [${gate.id}] ${gate.title}`);
    try {
      const res = await runGate(gate);
      if (res.skipped) skipped.push(gate.id);
      else passed.push({ id: gate.id, ms: res.ms });
      console.log(`✓ ${gate.id}`);
    } catch (err) {
      failures.push({ id: gate.id, message: err.message });
      console.error(`✗ ${gate.id}: ${err.message}`);
    }
  }

  if (!OFFLINE_ONLY) {
    try {
      const serverInfo = await ensureServer();
      if (serverInfo.unreachable) {
        throw new Error(
          "Server not reachable. Start: npm run server — or set RELEASE_GATE_SPAWN_SERVER=1",
        );
      }
      serverChild = serverInfo.child;
      if (serverInfo.spawned) {
        console.log("\n● Spawned local server for gate run");
      }
    } catch (err) {
      failures.push({ id: "server", message: err.message });
      console.error(`✗ server: ${err.message}`);
    }

    if (!failures.some((f) => f.id === "server")) {
      for (const gate of SERVER_GATES) {
        console.log(`\n▶ [${gate.id}] ${gate.title}`);
        try {
          const res = await runGate(gate);
          if (res.skipped) {
            skipped.push(gate.id);
            console.log(`○ ${gate.id} (skipped)`);
          } else {
            passed.push({ id: gate.id, ms: res.ms });
            console.log(`✓ ${gate.id}`);
          }
        } catch (err) {
          failures.push({ id: gate.id, message: err.message });
          console.error(`✗ ${gate.id}: ${err.message}`);
        }
      }
    }
  }

  stopSpawnedServer(serverChild);

  console.log("\n" + "═".repeat(60));
  console.log(`Passed: ${passed.length}  Failed: ${failures.length}  Skipped: ${skipped.length}`);
  if (failures.length) {
    console.log("\nBLOCKED — gameplay gate failures:");
    for (const f of failures) {
      console.log(`  • ${f.id}: ${f.message}`);
    }
    console.log("\nSee RELEASE_GATE.md for scenario mapping and manual checklist.");
    process.exit(1);
  }

  console.log("RELEASE GATE OK — safe to deploy (gameplay)");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
