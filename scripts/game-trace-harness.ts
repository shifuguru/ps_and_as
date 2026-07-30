/**
 * Deterministic gameplay trace harness — observability only.
 *
 * Run: npm run trace-games
 * Output: reports/game-traces/game-1001.txt … game-1005.txt, anomaly-summary.txt
 */
import * as path from "path";
import {
  TRACE_SEEDS,
  simulateFullGame,
  writeAnomalySummary,
} from "./game-trace/traceEngine";

const OUT_DIR = path.join(process.cwd(), "reports", "game-traces");

function main() {
  const originalLog = console.log;
  console.log = () => {};

  const tracers = [];
  for (const seed of TRACE_SEEDS) {
    originalLog(`Tracing game seed ${seed}…`);
    const tracer = simulateFullGame(seed);
    const outPath = path.join(OUT_DIR, `game-${seed}.txt`);
    tracer.writeToFile(outPath);
    tracers.push(tracer);
    originalLog(`  → ${outPath} (${tracer.turn} turns, ${tracer.warnings.length} warnings)`);
  }

  const summaryPath = path.join(OUT_DIR, "anomaly-summary.txt");
  writeAnomalySummary(tracers, summaryPath);
  console.log = originalLog;

  const totalWarnings = tracers.reduce((s, t) => s + t.warnings.length, 0);
  originalLog("");
  originalLog("Trace harness complete.");
  originalLog(`Summary: ${summaryPath}`);
  originalLog(`Total warnings across ${tracers.length} games: ${totalWarnings}`);

  for (const t of tracers) {
    if (t.warnings.length > 0) {
      originalLog(`  seed ${t.seed}: ${t.warnings.length} warning(s)`);
    }
  }
}

main();
