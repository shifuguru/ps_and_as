import { Platform } from "react-native";
import { fetchStaticJson, fetchStaticText } from "../utils/fetchStaticAsset";
import type { StudioData } from "./types";
import { MEMORY_DOCS } from "./types";

const STUDIO_PREFIX = "studio";

const JSON_FILES = {
  dashboard: "dashboard.json",
  activeWork: "active_work.json",
  roadmap: "roadmap.json",
  releaseStatus: "release_status.json",
  metrics: "metrics.json",
} as const;

function studioPath(filename: string): string {
  return `${STUDIO_PREFIX}/${filename}`;
}

function parseActivityJsonl(text: string) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

const LOG_PREFIX = "[MissionControl/loadStudioData]";

function logLoad(event: string, detail?: Record<string, unknown>) {
  if (detail) {
    console.log(LOG_PREFIX, event, detail);
  } else {
    console.log(LOG_PREFIX, event);
  }
}

async function loadStudioFile<T>(
  label: string,
  loader: () => Promise<T>,
): Promise<T> {
  logLoad("load:start", { file: label });
  try {
    const result = await loader();
    logLoad("load:success", { file: label });
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const name = err instanceof Error ? err.name : "Error";
    logLoad("load:failure", { file: label, errorName: name, errorMessage: message });
    throw err;
  }
}

export async function loadStudioData(): Promise<StudioData> {
  logLoad("session:start", {
    files: [
      ...Object.values(JSON_FILES),
      "activity.jsonl",
      "director_brief.md",
      "inbox.md",
      ...MEMORY_DOCS.filter(
        (doc) => doc.filename !== "director_brief.md" && doc.filename !== "inbox.md",
      ).map((doc) => doc.filename),
    ],
  });

  const [dashboard, activeWork, roadmap, releaseStatus, metrics, activityText, directorBrief, inbox] =
    await Promise.all([
      loadStudioFile(JSON_FILES.dashboard, () =>
        fetchStaticJson<StudioData["dashboard"]>(studioPath(JSON_FILES.dashboard)),
      ),
      loadStudioFile(JSON_FILES.activeWork, () =>
        fetchStaticJson<StudioData["activeWork"]>(studioPath(JSON_FILES.activeWork)),
      ),
      loadStudioFile(JSON_FILES.roadmap, () =>
        fetchStaticJson<StudioData["roadmap"]>(studioPath(JSON_FILES.roadmap)),
      ),
      loadStudioFile(JSON_FILES.releaseStatus, () =>
        fetchStaticJson<StudioData["releaseStatus"]>(studioPath(JSON_FILES.releaseStatus)),
      ),
      loadStudioFile(JSON_FILES.metrics, () =>
        fetchStaticJson<StudioData["metrics"]>(studioPath(JSON_FILES.metrics)),
      ),
      loadStudioFile("activity.jsonl", () => fetchStaticText(studioPath("activity.jsonl"))),
      loadStudioFile("director_brief.md", () => fetchStaticText(studioPath("director_brief.md"))),
      loadStudioFile("inbox.md", () => fetchStaticText(studioPath("inbox.md"))),
    ]);

  const memoryEntries = await Promise.all(
    MEMORY_DOCS.filter((doc) => doc.filename !== "director_brief.md" && doc.filename !== "inbox.md").map(
      async (doc) => {
        const text = await loadStudioFile(doc.filename, () =>
          fetchStaticText(studioPath(doc.filename)),
        );
        return [doc.id, text] as const;
      },
    ),
  );

  const memory: Record<string, string> = {
    brief: directorBrief,
    inbox,
  };
  for (const [id, text] of memoryEntries) {
    memory[id] = text;
  }

  let activity: StudioData["activity"];
  try {
    activity = parseActivityJsonl(activityText);
    logLoad("parse:success", { file: "activity.jsonl", lines: activity.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logLoad("parse:failure", { file: "activity.jsonl", errorMessage: message });
    throw err;
  }

  logLoad("validation:runtime", {
    note: "Client does not run studio:validate — schema checks are load-time parse + render only",
    dashboardSchemaVersion: dashboard.schemaVersion,
    releaseStatusSchemaVersion: releaseStatus.schemaVersion,
    projectStateUpdatedAt: dashboard.projectStateUpdatedAt ?? null,
    releaseGateLastRunAt: releaseStatus.gate.lastRun?.at ?? null,
    releaseGateLastRunHasSlices: Boolean(
      releaseStatus.gate.lastRun?.offlineSlice || releaseStatus.gate.lastRun?.serverSlice,
    ),
  });

  logLoad("session:success", {
    dashboardVersion: dashboard.project.version,
    activityLines: activity.length,
  });

  return {
    dashboard,
    activeWork,
    roadmap,
    releaseStatus,
    metrics,
    activity,
    directorBrief,
    inbox,
    memory,
  };
}

export function isMissionControlRoute(): boolean {
  if (Platform.OS !== "web") return false;
  const path = (globalThis as { location?: { pathname?: string } }).location?.pathname ?? "";
  return path.includes("/mission-control") || path.includes("/mission_control");
}

export function installMissionControlNoIndex(): () => void {
  if (Platform.OS !== "web") return () => {};

  const doc = (globalThis as { document?: Document }).document;
  if (!doc) return () => {};

  const prevTitle = doc.title;
  doc.title = "Mission Control — P's & A's Studio";

  let meta = doc.querySelector('meta[name="robots"]') as HTMLMetaElement | null;
  const prevContent = meta?.getAttribute("content") ?? null;
  if (!meta) {
    meta = doc.createElement("meta");
    meta.setAttribute("name", "robots");
    doc.head.appendChild(meta);
  }
  meta.setAttribute("content", "noindex,nofollow");

  return () => {
    doc.title = prevTitle;
    if (prevContent != null) {
      meta!.setAttribute("content", prevContent);
    } else {
      meta?.remove();
    }
  };
}
