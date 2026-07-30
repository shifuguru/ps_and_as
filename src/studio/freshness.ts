import type { ReleaseStatus, StudioDashboard } from "./types";

export type FreshnessLevel = "fresh" | "warning" | "stale" | "unknown";

export type FreshnessAssessment = {
  level: FreshnessLevel;
  label: "Fresh" | "Warning" | "Stale" | "Unknown";
  relativeAge: string;
  ageMs: number | null;
};

export type DashboardFreshnessTimestamps = {
  projectStateUpdatedAt: string;
  lastDeploymentAt: string;
  lastReleaseGateAt: string;
  lastHumanPlaytestAt: string;
};

export type FreshnessSnapshot = {
  timestamps: DashboardFreshnessTimestamps;
  projectState: FreshnessAssessment;
  deployment: { relativeAge: string; iso: string | null };
  releaseGate: FreshnessAssessment;
  humanQa: FreshnessAssessment;
  isProjectStateStale: boolean;
};

const MS_HOUR = 3_600_000;
const MS_DAY = 86_400_000;

/** Thresholds for operational freshness badges (Mission Control). */
export const FRESHNESS_THRESHOLDS = {
  projectState: { freshMaxMs: 1 * MS_DAY, warningMaxMs: 3 * MS_DAY },
  releaseGate: { freshMaxMs: 7 * MS_DAY, warningMaxMs: 14 * MS_DAY },
  humanQa: { freshMaxMs: 7 * MS_DAY, warningMaxMs: 14 * MS_DAY },
} as const;

export function parseIsoMs(iso: string | null | undefined): number | null {
  if (!iso?.trim()) return null;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : null;
}

export function formatRelativeAge(iso: string | null | undefined): string {
  const parsed = parseIsoMs(iso);
  if (parsed === null) return "not recorded";
  const delta = Date.now() - parsed;
  if (delta < 0) return "just now";
  const days = Math.floor(delta / MS_DAY);
  if (days > 0) return `${days}d ago`;
  const hours = Math.floor(delta / MS_HOUR);
  if (hours > 0) return `${hours}h ago`;
  const mins = Math.floor(delta / 60_000);
  return mins > 0 ? `${mins}m ago` : "just now";
}

export function assessFreshness(
  iso: string | null | undefined,
  thresholds: { freshMaxMs: number; warningMaxMs: number },
): FreshnessAssessment {
  const parsed = parseIsoMs(iso);
  if (parsed === null) {
    return {
      level: "unknown",
      label: "Unknown",
      relativeAge: "not recorded",
      ageMs: null,
    };
  }

  const ageMs = Date.now() - parsed;
  const relativeAge = formatRelativeAge(iso);

  if (ageMs <= thresholds.freshMaxMs) {
    return { level: "fresh", label: "Fresh", relativeAge, ageMs };
  }
  if (ageMs <= thresholds.warningMaxMs) {
    return { level: "warning", label: "Warning", relativeAge, ageMs };
  }
  return { level: "stale", label: "Stale", relativeAge, ageMs };
}

export function resolveFreshnessTimestamps(
  dashboard: StudioDashboard,
  releaseStatus?: ReleaseStatus,
): DashboardFreshnessTimestamps {
  return {
    projectStateUpdatedAt:
      dashboard.projectStateUpdatedAt?.trim() || dashboard.updatedAt,
    lastDeploymentAt:
      dashboard.lastDeploymentAt?.trim() ||
      releaseStatus?.deploy?.lastDeploy?.at ||
      "",
    lastReleaseGateAt:
      dashboard.lastReleaseGateAt?.trim() ||
      releaseStatus?.gate?.lastRun?.at ||
      dashboard.release.lastGateRun?.at ||
      "",
    lastHumanPlaytestAt: dashboard.lastHumanPlaytestAt?.trim() ?? "",
  };
}

export function buildFreshnessSnapshot(
  dashboard: StudioDashboard,
  releaseStatus?: ReleaseStatus,
): FreshnessSnapshot {
  const timestamps = resolveFreshnessTimestamps(dashboard, releaseStatus);
  const projectState = assessFreshness(
    timestamps.projectStateUpdatedAt,
    FRESHNESS_THRESHOLDS.projectState,
  );

  return {
    timestamps,
    projectState,
    deployment: {
      relativeAge: formatRelativeAge(timestamps.lastDeploymentAt),
      iso: timestamps.lastDeploymentAt || null,
    },
    releaseGate: assessFreshness(
      timestamps.lastReleaseGateAt,
      FRESHNESS_THRESHOLDS.releaseGate,
    ),
    humanQa: assessFreshness(
      timestamps.lastHumanPlaytestAt || null,
      FRESHNESS_THRESHOLDS.humanQa,
    ),
    isProjectStateStale: projectState.level === "stale",
  };
}
