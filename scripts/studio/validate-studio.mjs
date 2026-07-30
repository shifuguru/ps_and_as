#!/usr/bin/env node
/**
 * Validate studio/ JSON structure, required files, and doc references.
 *
 *   npm run studio:validate
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");
const STUDIO = path.join(ROOT, "studio");

const REQUIRED_JSON = [
  "dashboard.json",
  "objectives.json",
  "work_items.json",
  "agent_queue.json",
  "agent_status.json",
  "active_work.json",
  "backlog.json",
  "roadmap.json",
  "release_status.json",
  "metrics.json",
];

const REQUIRED_MD = [
  "directives.md",
  "director_brief.md",
  "inbox.md",
  "bugs.md",
  "product_notes.md",
  "style_notes.md",
  "decisions.md",
  "README.md",
];

const REQUIRED_OTHER = ["activity.jsonl"];

const WORK_STATUSES = new Set([
  "queued",
  "assigned",
  "investigating",
  "implementing",
  "testing",
  "blocked",
  "completed",
  "cancelled",
  "deferred",
]);

const AGENT_IDS = new Set([
  "orchestrator",
  "investigation",
  "implementation",
  "regression",
  "release",
  "architecture",
  "product",
]);

const WORK_CATEGORIES = new Set([
  "gameplay",
  "multiplayer",
  "spectator",
  "botopn",
  "release",
  "architecture",
  "product",
  "studio-ops",
  "polish",
]);

let errors = 0;
let warnings = 0;

function fail(msg) {
  console.error(`ERROR: ${msg}`);
  errors += 1;
}

function warn(msg) {
  console.warn(`WARN: ${msg}`);
  warnings += 1;
}

function readJson(rel) {
  const full = path.join(STUDIO, rel);
  if (!fs.existsSync(full)) {
    fail(`Missing ${rel}`);
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(full, "utf8"));
  } catch (e) {
    fail(`${rel}: invalid JSON — ${e.message}`);
    return null;
  }
}

function assertSchemaVersion(obj, file) {
  if (!obj || typeof obj.schemaVersion !== "number") {
    fail(`${file}: missing schemaVersion`);
  }
}

function assertString(obj, key, file) {
  if (!obj || typeof obj[key] !== "string" || !obj[key].trim()) {
    fail(`${file}: missing or empty ${key}`);
  }
}

function assertNestedString(obj, key, file, label) {
  if (!obj || typeof obj[key] !== "string" || !obj[key].trim()) {
    fail(`${file}: missing or empty ${label}`);
  }
}

function assertOptionalIso(obj, key, file) {
  if (obj?.[key] === undefined || obj[key] === "") return;
  if (typeof obj[key] !== "string" || !Number.isFinite(Date.parse(obj[key]))) {
    fail(`${file}: ${key} must be empty or a valid ISO timestamp`);
  }
}

function validateDashboardFreshness(dashboard) {
  assertString(dashboard, "projectStateUpdatedAt", "dashboard.json");
  assertString(dashboard, "lastDeploymentAt", "dashboard.json");
  assertString(dashboard, "lastReleaseGateAt", "dashboard.json");
  if (typeof dashboard.lastHumanPlaytestAt !== "string") {
    fail("dashboard.json: lastHumanPlaytestAt must be a string (empty if unknown)");
  }
  for (const key of [
    "projectStateUpdatedAt",
    "lastDeploymentAt",
    "lastReleaseGateAt",
    "updatedAt",
  ]) {
    if (!Number.isFinite(Date.parse(dashboard[key]))) {
      fail(`dashboard.json: ${key} is not a valid ISO timestamp`);
    }
  }
  assertOptionalIso(dashboard, "lastHumanPlaytestAt", "dashboard.json");
  if (!dashboard.lastHumanPlaytestAt?.trim()) {
    warn("dashboard.json: lastHumanPlaytestAt not recorded");
  }
  if (dashboard.schemaVersion < 2) {
    warn("dashboard.json: schemaVersion < 2 — missing operational freshness timestamps");
  }
}

function fileMtimeIso(rel) {
  const full = path.join(STUDIO, rel);
  if (!fs.existsSync(full)) return null;
  return new Date(fs.statSync(full).mtimeMs).toISOString();
}

function latestActivityAt() {
  const activityPath = path.join(STUDIO, "activity.jsonl");
  if (!fs.existsSync(activityPath)) return null;
  const lines = fs.readFileSync(activityPath, "utf8").split("\n").filter((l) => l.trim());
  let latest = null;
  for (const line of lines) {
    try {
      const ev = JSON.parse(line);
      if (ev.at && Number.isFinite(Date.parse(ev.at))) {
        if (!latest || Date.parse(ev.at) > Date.parse(latest)) latest = ev.at;
      }
    } catch {
      /* skip bad lines */
    }
  }
  return latest;
}

/** Validate release_status.json gate.lastRun slice/legacy schema for Mission Control. */
function validateReleaseStatus(releaseStatus) {
  assertSchemaVersion(releaseStatus, "release_status.json");
  assertString(releaseStatus, "updatedAt", "release_status.json");
  if (!releaseStatus.gate?.command) {
    fail("release_status.json: gate.command missing");
  }
  if (!Array.isArray(releaseStatus.gate?.gates)) {
    fail("release_status.json: gate.gates must be an array");
  }
  if (!Array.isArray(releaseStatus.blockers)) {
    fail("release_status.json: blockers must be an array");
  }

  const run = releaseStatus.gate?.lastRun;
  if (!run) return;

  if (!run.at || !Number.isFinite(Date.parse(run.at))) {
    fail("release_status.json: gate.lastRun.at must be a valid ISO timestamp");
  }

  const hasSlices = Boolean(run.offlineSlice || run.serverSlice);
  const hasLegacy = Array.isArray(run.passed) || Array.isArray(run.failed);

  if (!hasSlices && !hasLegacy && !run.result) {
    warn(
      "release_status.json: gate.lastRun has no offlineSlice/serverSlice, legacy passed/failed, or result — Mission Control will show Unknown",
    );
  }

  for (const [name, slice] of [
    ["offlineSlice", run.offlineSlice],
    ["serverSlice", run.serverSlice],
  ]) {
    if (!slice) continue;
    if (slice.failed != null && !Array.isArray(slice.failed)) {
      fail(`release_status.json: gate.lastRun.${name}.failed must be an array`);
    }
    if (slice.passed != null && !Array.isArray(slice.passed)) {
      fail(`release_status.json: gate.lastRun.${name}.passed must be an array`);
    }
  }

  if (Array.isArray(run.failed)) {
    for (const item of run.failed) {
      if (!item?.id) {
        warn("release_status.json: gate.lastRun.failed entry missing id");
      }
    }
  }

  if (hasSlices && !hasLegacy) {
    /* expected current schema */
  } else if (hasLegacy && !hasSlices) {
    warn(
      "release_status.json: using legacy flat passed/failed — prefer offlineSlice/serverSlice for Mission Control",
    );
  }
}

/** Warn when canonical state files are newer than projectStateUpdatedAt (freshness-ownership.md). */
function validateProjectStateFreshnessDrift(dashboard) {
  const projectStateAt = Date.parse(dashboard?.projectStateUpdatedAt ?? "");
  if (!Number.isFinite(projectStateAt)) return;

  const sources = [];

  for (const rel of [
    "work_items.json",
    "release_status.json",
    "roadmap.json",
    "objectives.json",
    "agent_status.json",
    "agent_queue.json",
  ]) {
    const data = readJson(rel);
    if (data?.updatedAt && Number.isFinite(Date.parse(data.updatedAt))) {
      sources.push({ label: rel, at: data.updatedAt });
    }
  }

  for (const rel of ["director_brief.md", "decisions.md"]) {
    const mtime = fileMtimeIso(rel);
    if (mtime) sources.push({ label: `${rel} (mtime)`, at: mtime });
  }

  const activityAt = latestActivityAt();
  if (activityAt) sources.push({ label: "activity.jsonl (latest)", at: activityAt });

  const drifted = sources.filter((s) => Date.parse(s.at) > projectStateAt + 1000);
  if (drifted.length === 0) return;

  const detail = drifted
    .map((s) => `${s.label} @ ${s.at}`)
    .join("; ");
  warn(
    `projectStateUpdatedAt (${dashboard.projectStateUpdatedAt}) is older than canonical state — bump per studio/freshness-ownership.md. Newer: ${detail}`,
  );
}

function collectDocRefs(dashboard, workItems) {
  const refs = new Set();
  for (const tier of ["p0", "p1", "p2"]) {
    const block = dashboard?.priorities?.[tier];
    if (!block?.items) continue;
    for (const item of block.items) {
      if (item.doc) refs.add(item.doc);
    }
  }
  if (dashboard?.release?.lastGateRun?.reportPath) {
    refs.add(dashboard.release.lastGateRun.reportPath);
  }
  for (const key of Object.keys(dashboard?.links ?? {})) {
    const val = dashboard.links[key];
    if (typeof val === "string" && val.endsWith(".md")) refs.add(val);
  }
  for (const item of workItems?.items ?? []) {
    for (const a of item.artifacts ?? []) {
      if (typeof a === "string" && (a.endsWith(".md") || a.includes("."))) refs.add(a);
    }
  }
  return refs;
}

function resolveRef(ref) {
  if (ref.startsWith("http://") || ref.startsWith("https://")) return { ok: true };
  if (ref.includes("src/") || ref.includes("scripts/")) {
    return fs.existsSync(path.join(ROOT, ref)) ? { ok: true } : { ok: false };
  }
  const candidates = [path.join(ROOT, ref), path.join(STUDIO, ref)];
  for (const c of candidates) {
    if (fs.existsSync(c)) return { ok: true, path: c };
  }
  return { ok: false };
}

function validateWorkItems(workItems) {
  assertSchemaVersion(workItems, "work_items.json");
  assertString(workItems, "updatedAt", "work_items.json");
  if (!Array.isArray(workItems.items)) {
    fail("work_items.json: items must be an array");
    return new Map();
  }

  const byId = new Map();
  for (const item of workItems.items) {
    if (!item.id) {
      fail("work_items.json: item missing id");
      continue;
    }
    if (byId.has(item.id)) fail(`work_items.json: duplicate id ${item.id}`);
    byId.set(item.id, item);

    if (!WORK_STATUSES.has(item.status)) {
      fail(`work_items.json: ${item.id} invalid status ${item.status}`);
    }
    if (!WORK_CATEGORIES.has(item.category)) {
      warn(`work_items.json: ${item.id} unknown category ${item.category}`);
    }
    if (typeof item.approvedForImplementation !== "boolean") {
      fail(`work_items.json: ${item.id} missing approvedForImplementation boolean`);
    }
    if (
      item.status === "implementing" &&
      item.approvedForImplementation !== true
    ) {
      warn(
        `work_items.json: ${item.id} is implementing but approvedForImplementation is false`,
      );
    }
    if (item.assignee && !AGENT_IDS.has(item.assignee)) {
      warn(`work_items.json: ${item.id} unknown assignee ${item.assignee}`);
    }
    for (const dep of item.dependsOn ?? []) {
      if (!byId.has(dep) && !workItems.items.some((i) => i.id === dep)) {
        warn(`work_items.json: ${item.id} dependsOn missing item ${dep}`);
      }
    }
  }
  return byId;
}

function validateAgentQueue(queue, workById) {
  assertSchemaVersion(queue, "agent_queue.json");
  if (!Array.isArray(queue.queue)) {
    fail("agent_queue.json: queue must be an array");
    return;
  }
  for (const entry of queue.queue) {
    if (!entry.workItemId) {
      fail("agent_queue.json: entry missing workItemId");
      continue;
    }
    const item = workById.get(entry.workItemId);
    if (!item) {
      fail(`agent_queue.json: unknown workItemId ${entry.workItemId}`);
    } else if (item.status !== "queued" && item.status !== "blocked") {
      warn(
        `agent_queue.json: ${entry.workItemId} status is ${item.status}, not queued`,
      );
    }
    if (entry.suggestedAssignee && !AGENT_IDS.has(entry.suggestedAssignee)) {
      warn(`agent_queue.json: unknown suggestedAssignee ${entry.suggestedAssignee}`);
    }
  }
}

function validateAgentStatus(status, workById) {
  assertSchemaVersion(status, "agent_status.json");
  if (!Array.isArray(status.fleet)) {
    fail("agent_status.json: fleet must be an array");
    return;
  }
  for (const agent of status.fleet) {
    if (!AGENT_IDS.has(agent.id)) {
      warn(`agent_status.json: unknown agent id ${agent.id}`);
    }
    if (agent.currentWorkItemId) {
      const item = workById.get(agent.currentWorkItemId);
      if (!item) {
        fail(
          `agent_status.json: ${agent.id} references missing work item ${agent.currentWorkItemId}`,
        );
      }
    }
  }
}

function validateObjectives(objectives) {
  assertSchemaVersion(objectives, "objectives.json");
  if (!Array.isArray(objectives.current)) {
    fail("objectives.json: current must be an array");
    return;
  }
  for (const obj of objectives.current) {
    if (!obj.id || !obj.title) {
      fail("objectives.json: objective missing id or title");
    }
    if (!Array.isArray(obj.successCriteria) || obj.successCriteria.length === 0) {
      warn(`objectives.json: ${obj.id} has no successCriteria`);
    }
  }
}

function validateActiveWork(activeWork) {
  assertSchemaVersion(activeWork, "active_work.json");
  for (const col of ["investigating", "fixing", "testing", "blocked", "completed"]) {
    if (!Array.isArray(activeWork.columns?.[col])) {
      fail(`active_work.json: columns.${col} must be an array`);
    }
  }
  if (activeWork.generatedFrom !== "work_items.json") {
    warn('active_work.json: missing generatedFrom — run npm run studio:sync-active-work');
  }
}

function validateActiveWorkSync(workItems) {
  const syncScript = path.join(__dirname, "sync-active-work.mjs");
  const result = spawnSync(process.execPath, [syncScript], {
    cwd: ROOT,
    encoding: "utf8",
  });
  if (result.status !== 0) {
    fail(`sync-active-work failed: ${result.stderr || result.stdout}`);
    return;
  }
  const expected = JSON.parse(fs.readFileSync(path.join(STUDIO, "active_work.json"), "utf8"));
  const actual = readJson("active_work.json");
  if (!actual) return;

  for (const col of ["investigating", "fixing", "testing", "blocked", "completed"]) {
    const expIds = (expected.columns[col] ?? []).map((i) => i.id).sort();
    const actIds = (actual.columns[col] ?? []).map((i) => i.id).sort();
    if (JSON.stringify(expIds) !== JSON.stringify(actIds)) {
      fail(
        `active_work.json out of sync with work_items.json (column ${col}) — run npm run studio:sync-active-work`,
      );
    }
  }
}

if (!fs.existsSync(STUDIO)) {
  fail("studio/ directory missing");
  console.error("\nValidation failed.");
  process.exit(1);
}

for (const file of [...REQUIRED_JSON, ...REQUIRED_MD, ...REQUIRED_OTHER]) {
  const full = path.join(STUDIO, file);
  if (!fs.existsSync(full)) fail(`Missing required file: ${file}`);
}

const directivesPath = path.join(STUDIO, "directives.md");
if (fs.existsSync(directivesPath)) {
  const text = fs.readFileSync(directivesPath, "utf8").trim();
  if (text.length < 100) warn("directives.md looks too short");
} else {
  fail("Missing directives.md");
}

const dashboard = readJson("dashboard.json");
const workItems = readJson("work_items.json");
const agentQueue = readJson("agent_queue.json");
const agentStatus = readJson("agent_status.json");
const objectives = readJson("objectives.json");
const activeWork = readJson("active_work.json");
readJson("backlog.json");
readJson("roadmap.json");
const releaseStatus = readJson("release_status.json");
readJson("metrics.json");

const workById = workItems ? validateWorkItems(workItems) : new Map();
if (agentQueue) validateAgentQueue(agentQueue, workById);
if (agentStatus) validateAgentStatus(agentStatus, workById);
if (objectives) validateObjectives(objectives);
if (activeWork) validateActiveWork(activeWork);
if (workItems) validateActiveWorkSync(workItems);
if (releaseStatus) validateReleaseStatus(releaseStatus);

if (dashboard) {
  assertSchemaVersion(dashboard, "dashboard.json");
  assertString(dashboard, "updatedAt", "dashboard.json");
  assertNestedString(dashboard.project, "version", "dashboard.json", "project.version");
  assertNestedString(dashboard.objective, "title", "dashboard.json", "objective.title");
  if (!dashboard.productHealth) {
    warn("dashboard.json: productHealth section missing");
  }
  validateDashboardFreshness(dashboard);
  validateProjectStateFreshnessDrift(dashboard);
}

const activityPath = path.join(STUDIO, "activity.jsonl");
if (fs.existsSync(activityPath)) {
  const lines = fs.readFileSync(activityPath, "utf8").split("\n").filter((l) => l.trim());
  for (let i = 0; i < lines.length; i++) {
    try {
      const ev = JSON.parse(lines[i]);
      if (!ev.type || !ev.at) fail(`activity.jsonl line ${i + 1}: missing type or at`);
    } catch (e) {
      fail(`activity.jsonl line ${i + 1}: ${e.message}`);
    }
  }
}

const allRefs = collectDocRefs(dashboard, workItems);
for (const ref of allRefs) {
  if (!resolveRef(ref).ok) warn(`Broken reference: ${ref}`);
}

if (errors === 0) {
  console.log(`studio/ validation passed (${warnings} warning${warnings === 1 ? "" : "s"}).`);
  process.exit(0);
}

console.error(`\nValidation failed: ${errors} error(s), ${warnings} warning(s).`);
process.exit(1);
