#!/usr/bin/env node
/**
 * Generate active_work.json from work_items.json (dual-write for Phase 1 UI).
 *
 *   npm run studio:sync-active-work
 *
 * work_items.json is the source of truth. Run after every work_items edit.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");
const STUDIO = path.join(ROOT, "studio");

const STATUS_TO_COLUMN = {
  investigating: "investigating",
  assigned: "investigating",
  implementing: "fixing",
  testing: "testing",
  blocked: "blocked",
  completed: "completed",
  queued: null,
  cancelled: null,
  deferred: null,
};

const COMPLETED_LIMIT = 10;

function ownerLabel(item) {
  return item.assignee || item.owner || "orchestrator";
}

function toActiveWorkItem(item) {
  const investigation =
    item.artifacts?.find((a) => a.endsWith(".md") || a.includes("/")) ??
    item.artifacts?.[0];
  return {
    id: item.id,
    title: item.title,
    priority: item.priority,
    owner: ownerLabel(item),
    startedAt: item.createdAt,
    updatedAt: item.updatedAt,
    ...(item.gapId ? { gapId: item.gapId } : {}),
    ...(investigation ? { investigation } : {}),
    ...(item.blockedReason ? { blockedReason: item.blockedReason } : {}),
    ...(item.description ? { notes: item.description } : {}),
  };
}

function main() {
  const srcPath = path.join(STUDIO, "work_items.json");
  if (!fs.existsSync(srcPath)) {
    console.error("work_items.json not found");
    process.exit(1);
  }

  const workItems = JSON.parse(fs.readFileSync(srcPath, "utf8"));
  const columns = {
    investigating: [],
    fixing: [],
    testing: [],
    blocked: [],
    completed: [],
  };

  for (const item of workItems.items ?? []) {
    const col = STATUS_TO_COLUMN[item.status];
    if (!col) continue;
    columns[col].push(toActiveWorkItem(item));
  }

  columns.completed.sort(
    (a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt),
  );
  columns.completed = columns.completed.slice(0, COMPLETED_LIMIT);

  const payload = {
    schemaVersion: 1,
    updatedAt: new Date().toISOString(),
    generatedFrom: "work_items.json",
    columns,
  };

  const outPath = path.join(STUDIO, "active_work.json");
  fs.writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(
    `Wrote active_work.json from work_items.json (${workItems.items?.length ?? 0} items).`,
  );
}

main();
