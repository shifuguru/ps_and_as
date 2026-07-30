export type HealthStatus = "green" | "amber" | "red" | "unknown";

export type PriorityItem = {
  id: string;
  title: string;
  status: string;
  owner?: string;
  doc?: string;
};

export type ProductHealthMetric = {
  status: HealthStatus;
  score?: number;
  note: string;
};

export type FreshnessTimestampField =
  | "projectStateUpdatedAt"
  | "lastDeploymentAt"
  | "lastReleaseGateAt"
  | "lastHumanPlaytestAt";

export type StudioDashboard = {
  schemaVersion: number;
  updatedAt: string;
  updatedBy?: string;
  /** When Mission Control project understanding last changed (work, roadmap, brief, activity). */
  projectStateUpdatedAt?: string;
  /** When the currently running production build was deployed. */
  lastDeploymentAt?: string;
  /** Most recent release gate execution. */
  lastReleaseGateAt?: string;
  /** Most recent human multiplayer playtest session. */
  lastHumanPlaytestAt?: string;
  project: {
    name: string;
    codename?: string;
    version: string;
    buildId?: string;
    channel: string;
  };
  release: {
    status: string;
    headline: string;
    lastGateRun?: {
      at: string;
      result: string;
      failedGates?: string[];
      reportPath?: string;
    };
  };
  objective: {
    title: string;
    summary: string;
    successMetric?: string;
  };
  priorities: {
    p0: { open: number; items: PriorityItem[] };
    p1: { open: number; items: PriorityItem[] };
    p2?: { open: number; items: PriorityItem[] };
  };
  health: {
    game: HealthStatus;
    gameNote: string;
    studio: HealthStatus;
    studioNote: string;
  };
  productHealth?: {
    gameplayStability?: ProductHealthMetric;
    multiplayerReadiness?: ProductHealthMetric;
    retentionReadiness?: ProductHealthMetric;
    monetizationReadiness?: ProductHealthMetric;
  };
  nextActions: string[];
  links: Record<string, string | undefined>;
};

export type WorkItem = {
  id: string;
  title: string;
  priority: string;
  owner?: string;
  startedAt: string;
  updatedAt: string;
  gapId?: string;
  investigation?: string;
  blockedReason?: string;
  notes?: string;
};

export type ActiveWork = {
  schemaVersion: number;
  updatedAt: string;
  columns: {
    investigating: WorkItem[];
    fixing: WorkItem[];
    testing: WorkItem[];
    blocked: WorkItem[];
    completed: WorkItem[];
  };
};

export type Phase = {
  id: string;
  name: string;
  goal: string;
  exitCriteria: string[];
  targetWindow?: string;
  status: string;
};

export type Roadmap = {
  schemaVersion: number;
  updatedAt: string;
  currentPhase: Phase;
  nextPhase: Phase;
  futurePhases: Phase[];
};

export type ReleaseGateFailure = {
  id: string;
  message: string;
};

export type ReleaseGateSlice = {
  passed?: string[];
  failed?: ReleaseGateFailure[];
  status?: string;
  rerunRequired?: boolean;
  rerunNote?: string;
};

/** Last gate run — supports slice schema (v1+) and legacy flat passed/failed arrays. */
export type ReleaseGateLastRun = {
  at: string;
  mode: string;
  result?: string;
  /** Legacy flat schema */
  passed?: string[];
  failed?: ReleaseGateFailure[];
  skipped?: string[];
  durationMs?: number;
  /** Current slice schema (alignment 2026-06) */
  offlineSlice?: ReleaseGateSlice;
  serverSlice?: ReleaseGateSlice;
};

export type ReleaseStatus = {
  schemaVersion: number;
  updatedAt: string;
  deploy: {
    productionUrl: string;
    devUrl: string;
    lastDeploy?: {
      at: string;
      version: string;
      buildId: string;
      channel: string;
    };
    ciRunsReleaseGate: boolean;
  };
  gate: {
    command: string;
    lastRun?: ReleaseGateLastRun;
    gates: { id: string; layer?: string; requiresServer?: boolean }[];
  };
  blockers: {
    id: string;
    severity: string;
    title: string;
    detail: string;
  }[];
};

export type StudioMetrics = {
  schemaVersion: number;
  updatedAt: string;
  live: Record<
    string,
    {
      value: number | null;
      unit?: string;
      source: string;
      fetchedAt?: string;
      note?: string;
    }
  >;
};

export type ActivityEvent = {
  type: string;
  at: string;
  [key: string]: unknown;
};

export type StudioMemoryDoc = {
  id: string;
  title: string;
  filename: string;
};

export type StudioData = {
  dashboard: StudioDashboard;
  activeWork: ActiveWork;
  roadmap: Roadmap;
  releaseStatus: ReleaseStatus;
  metrics: StudioMetrics;
  activity: ActivityEvent[];
  directorBrief: string;
  inbox: string;
  memory: Record<string, string>;
};

export const MEMORY_DOCS: StudioMemoryDoc[] = [
  { id: "brief", title: "Director Brief", filename: "director_brief.md" },
  { id: "inbox", title: "Inbox", filename: "inbox.md" },
  { id: "product", title: "Product", filename: "product_notes.md" },
  { id: "style", title: "Style", filename: "style_notes.md" },
  { id: "decisions", title: "Decisions", filename: "decisions.md" },
  { id: "bugs", title: "Bugs", filename: "bugs.md" },
];

export type MissionControlTab =
  | "dashboard"
  | "work"
  | "roadmap"
  | "metrics"
  | "feed"
  | "memory";
