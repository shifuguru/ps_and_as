import type { HealthStatus, ReleaseGateLastRun } from "./types";

export type ReleaseGateSummary = {
  label: string;
  tone: HealthStatus;
};

function failedCount(items: unknown): number {
  return Array.isArray(items) ? items.length : 0;
}

function sliceFailedCount(slice: unknown): number {
  if (!slice || typeof slice !== "object") return 0;
  return failedCount((slice as { failed?: unknown }).failed);
}

function hasSliceSchema(run: ReleaseGateLastRun): boolean {
  return Boolean(run.offlineSlice || run.serverSlice);
}

function hasLegacySchema(run: ReleaseGateLastRun): boolean {
  return Array.isArray(run.passed) || Array.isArray(run.failed);
}

/** Defensive summary for Mission Control Gate stat — never throws. */
export function summarizeReleaseGateRun(
  run: ReleaseGateLastRun | null | undefined,
): ReleaseGateSummary {
  if (!run) {
    return { label: "Not run", tone: "unknown" };
  }

  if (hasSliceSchema(run)) {
    const offlineFailed = sliceFailedCount(run.offlineSlice);
    const serverFailed = sliceFailedCount(run.serverSlice);
    const totalFailed = offlineFailed + serverFailed;
    const serverStatus = run.serverSlice?.status;
    const offlineStatus = run.offlineSlice?.status;
    const result = run.result?.toLowerCase();

    if (offlineFailed > 0) {
      return {
        label: `${offlineFailed} offline failed`,
        tone: "red",
      };
    }

    if (serverStatus === "not_confirmed" || result === "partial") {
      if (serverFailed > 0) {
        return { label: `Partial · ${serverFailed} server`, tone: "amber" };
      }
      return { label: "Partial", tone: "amber" };
    }

    if (totalFailed === 0 && (offlineStatus === "pass" || result === "pass")) {
      return { label: "Pass", tone: "green" };
    }

    if (totalFailed > 0) {
      return { label: `${totalFailed} failed`, tone: "red" };
    }

    if (result === "fail" || result === "failed") {
      return { label: "Fail", tone: "red" };
    }

    return { label: "Unknown", tone: "unknown" };
  }

  if (hasLegacySchema(run)) {
    const failed = failedCount(run.failed);
    if (failed === 0) {
      return { label: "Pass", tone: "green" };
    }
    return { label: `${failed} failed`, tone: "red" };
  }

  if (run.result) {
    const result = run.result.toLowerCase();
    if (result === "pass" || result === "passed") {
      return { label: "Pass", tone: "green" };
    }
    if (result === "partial") {
      return { label: "Partial", tone: "amber" };
    }
    if (result === "fail" || result === "failed") {
      return { label: "Fail", tone: "red" };
    }
  }

  return { label: "Unknown", tone: "unknown" };
}
