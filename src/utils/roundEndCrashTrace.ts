/**
 * Ordered round-end transition trace — identifies the last successful phase
 * before a crash. Persists on globalThis for Playwright / console dump.
 */
export type RoundEndPhase =
  | "1.round_completes"
  | "2.table_clears"
  | "3.last_hand_mounts"
  | "4.last_hand_unmounts"
  | "5.rankingsModalVisible_true"
  | "6.RoundCompleteModal_mounts"
  | "7.ModalBackdrop_mounts"
  | "8.RankingRow_renders"
  | "9.role_banners_render"
  | "10.ready_ui_renders"
  | "phase.ok"
  | string;

export type RoundEndTraceEntry = {
  phase: string;
  ok: boolean;
  detail: Record<string, unknown> | null;
  t: number;
};

const LOG_PREFIX = "[ROUND-END-PHASE]";

function store(entry: RoundEndTraceEntry): void {
  try {
    const g = globalThis as {
      __ROUND_END_PHASE_TRACE?: RoundEndTraceEntry[];
      __RC_CRASH_TRACE?: Array<{
        step: string;
        detail: Record<string, unknown> | null;
        t: number;
      }>;
    };
    if (!g.__ROUND_END_PHASE_TRACE) g.__ROUND_END_PHASE_TRACE = [];
    g.__ROUND_END_PHASE_TRACE.push(entry);
    if (g.__ROUND_END_PHASE_TRACE.length > 300) {
      g.__ROUND_END_PHASE_TRACE.shift();
    }
    // Keep legacy probe key in sync for existing Playwright scripts.
    if (!g.__RC_CRASH_TRACE) g.__RC_CRASH_TRACE = [];
    g.__RC_CRASH_TRACE.push({
      step: entry.phase,
      detail: entry.detail,
      t: entry.t,
    });
    if (g.__RC_CRASH_TRACE.length > 300) g.__RC_CRASH_TRACE.shift();
  } catch {
    /* ignore */
  }
}

/** Log a transition phase; always prints so release/dev Playwright can capture. */
export function roundEndPhase(
  phase: RoundEndPhase,
  detail?: Record<string, unknown>,
  ok = true,
): void {
  const entry: RoundEndTraceEntry = {
    phase,
    ok,
    detail: detail ?? null,
    t: Date.now(),
  };
  store(entry);
  try {
    if (detail && Object.keys(detail).length > 0) {
      console.log(`${LOG_PREFIX} ${ok ? "OK" : "FAIL"} ${phase}`, detail);
    } else {
      console.log(`${LOG_PREFIX} ${ok ? "OK" : "FAIL"} ${phase}`);
    }
  } catch {
    /* ignore */
  }
}

export function getRoundEndPhaseTrace(): RoundEndTraceEntry[] {
  const g = globalThis as { __ROUND_END_PHASE_TRACE?: RoundEndTraceEntry[] };
  return g.__ROUND_END_PHASE_TRACE ? [...g.__ROUND_END_PHASE_TRACE] : [];
}
