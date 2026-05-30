/** Short display names for offline bot seats (3–5 characters). */
export const CPU_DISPLAY_NAMES = [
  "Amy",
  "Ben",
  "Cal",
  "Dan",
  "Eli",
  "Fay",
  "Gus",
  "Hal",
  "Ian",
  "Jay",
  "Kay",
  "Leo",
  "Max",
  "Noa",
  "Oll",
  "Pat",
  "Quin",
  "Ray",
  "Sam",
  "Tom",
  "Una",
  "Val",
  "Wes",
  "Xia",
  "Yen",
  "Zoe",
  "Ace",
  "Bo",
  "Cy",
  "Deb",
  "Eve",
  "Fox",
  "Gia",
  "Hugh",
  "Ivy",
  "Jax",
  "Kim",
  "Lou",
  "Meg",
  "Nat",
  "Owen",
  "Pia",
  "Rex",
  "Sky",
  "Tia",
  "Uri",
  "Vic",
  "Wren",
  "Yuri",
  "Zed",
] as const;

const CPU_ID_RE = /^cpu-(\d+)$/i;
const LEGACY_CPU_NAME_RE = /^CPU\s+(\d+)$/i;

export function isCpuPlayerId(id: string | null | undefined): boolean {
  return !!(id && CPU_ID_RE.test(id.trim()));
}

export function parseCpuTierFromId(id: string | null | undefined): number | null {
  if (!id) return null;
  const match = CPU_ID_RE.exec(id.trim());
  if (!match) return null;
  const tier = parseInt(match[1], 10);
  return Number.isFinite(tier) && tier >= 1 ? tier : null;
}

/** Legacy "CPU 3" names — kept for older saves / tests. */
export function parseCpuTierFromName(name: string): number | null {
  const match = LEGACY_CPU_NAME_RE.exec((name || "").trim());
  if (!match) return null;
  const tier = parseInt(match[1], 10);
  return Number.isFinite(tier) && tier >= 1 ? tier : null;
}

export function makeCpuPlayerId(tier: number): string {
  return `cpu-${tier}`;
}

/** Pick one unused short name (deterministic order, shuffled by seed optional — random here). */
export function pickCpuDisplayName(usedNames: Iterable<string>): string {
  const used = new Set(
    [...usedNames].map((n) => n.trim().toLowerCase()).filter(Boolean),
  );
  const pool = [...CPU_DISPLAY_NAMES].sort(() => Math.random() - 0.5);
  for (const candidate of pool) {
    if (!used.has(candidate.toLowerCase())) return candidate;
  }
  let i = 1;
  while (used.has(`bot${i}`)) i++;
  return `Bot${i}`.slice(0, 5);
}

/** Pick `count` unique short bot names. */
export function pickCpuDisplayNames(
  count: number,
  usedNames: Iterable<string> = [],
): string[] {
  const used = new Set(
    [...usedNames].map((n) => n.trim().toLowerCase()).filter(Boolean),
  );
  const picked: string[] = [];
  const pool = [...CPU_DISPLAY_NAMES].sort(() => Math.random() - 0.5);
  for (const candidate of pool) {
    if (picked.length >= count) break;
    if (used.has(candidate.toLowerCase())) continue;
    picked.push(candidate);
    used.add(candidate.toLowerCase());
  }
  while (picked.length < count) {
    const fallback = pickCpuDisplayName([...used]);
    picked.push(fallback);
    used.add(fallback.toLowerCase());
  }
  return picked;
}

/** Tier by bot order in the lobby name list (first bot = tier 1). */
export function resolveCpuTierInNameOrder(
  name: string,
  orderedNames: string[],
  botNames: ReadonlySet<string>,
): number | null {
  if (!botNames.has(name)) return null;
  let tier = 0;
  for (const entry of orderedNames) {
    if (!botNames.has(entry)) continue;
    tier++;
    if (entry === name) return tier;
  }
  return null;
}

export function isBotDisplayName(
  name: string,
  botNames: ReadonlySet<string>,
): boolean {
  return botNames.has(name);
}
