import {
  resolveBottomChromeMetrics,
  resolveCompactHeightTier,
  resolveOpponentTopPad,
} from "./compactGameLayout";
import { computePlayAreaLayout } from "./tableLayout";

/** Mirrors `BottomBar.bottomOuterPad` for iOS-style budget presets (Node-safe). */
function budgetBottomOuterPad(safeBottom = 0): number {
  const CONTENT_MARGIN = 18;
  return Math.max(safeBottom, 12) + CONTENT_MARGIN;
}

export type GameScreenBudgetLine = {
  id: string;
  label: string;
  px: number;
};

export type GameScreenBudget = {
  device: string;
  shellWidth: number;
  shellHeight: number;
  tier: ReturnType<typeof resolveCompactHeightTier>;
  lines: GameScreenBudgetLine[];
  playAreaHeight: number;
  playAreaLayout: ReturnType<typeof computePlayAreaLayout>;
  surplus: number;
};

export type BudgetDevicePreset = {
  name: string;
  width: number;
  height: number;
  safeTop?: number;
  safeBottom?: number;
};

/** Common portrait presets for budget checks (CSS / layout px). */
export const BUDGET_DEVICE_PRESETS: BudgetDevicePreset[] = [
  { name: "iPhone SE 3", width: 375, height: 667, safeTop: 20, safeBottom: 0 },
  { name: "iPhone 13 mini", width: 375, height: 812, safeTop: 47, safeBottom: 34 },
  { name: "iPhone 14", width: 390, height: 844, safeTop: 47, safeBottom: 34 },
  { name: "iPhone 15 Pro Max", width: 430, height: 932, safeTop: 59, safeBottom: 34 },
];

export function computeGameScreenBudget(
  preset: BudgetDevicePreset,
  options: { handVisible?: boolean; totalPlayers?: number } = {},
): GameScreenBudget {
  const handVisible = options.handVisible ?? true;
  const safeTop = preset.safeTop ?? 0;
  const safeBottom = preset.safeBottom ?? 0;
  const outerPad = budgetBottomOuterPad(safeBottom);
  const chrome = resolveBottomChromeMetrics(
    preset.height,
    safeBottom,
    handVisible,
    outerPad,
  );
  const contentTopPadding = safeTop + 8;
  const bottomBarHeight = chrome.reservedHeight;
  const playAreaHeight = Math.max(
    0,
    preset.height - contentTopPadding - bottomBarHeight,
  );
  const playAreaLayout = computePlayAreaLayout(
    preset.width - 24,
    playAreaHeight,
    options.totalPlayers ?? 4,
    preset.height,
  );

  const lines: GameScreenBudgetLine[] = [
    { id: "safeTop", label: "Safe area top", px: safeTop },
    { id: "headerPad", label: "Header pad (+8)", px: 8 },
    { id: "playArea", label: "Play area (flex)", px: playAreaHeight },
    { id: "bottomReserve", label: "Bottom reserve pad", px: 8 },
    { id: "handFan", label: "Hand fan", px: handVisible ? chrome.fanHeight : 0 },
    {
      id: "handClearance",
      label: "Hand zone clearance",
      px: handVisible ? chrome.handZoneTopClearance : 0,
    },
    {
      id: "handBottomPad",
      label: "Hand bottom pad",
      px: handVisible ? chrome.handZoneBottomPad : 0,
    },
    {
      id: "handGap",
      label: "Hand → action gap",
      px: handVisible ? chrome.handControlsGap + 2 : 0,
    },
    {
      id: "actionBar",
      label: "Action bar",
      px: chrome.actionBarHeight + chrome.actionBarPadding,
    },
    { id: "bottomPad", label: "Bottom pad (+4)", px: 4 },
    { id: "safeBottom", label: "Safe area / home indicator", px: outerPad },
  ];

  const accounted =
    contentTopPadding +
    playAreaHeight +
    bottomBarHeight;
  const surplus = preset.height - accounted;

  return {
    device: preset.name,
    shellWidth: preset.width,
    shellHeight: preset.height,
    tier: chrome.tier,
    lines,
    playAreaHeight,
    playAreaLayout,
    surplus,
  };
}

export function formatGameScreenBudget(budget: GameScreenBudget): string {
  const ringTop = resolveOpponentTopPad(budget.shellHeight);
  const layout = budget.playAreaLayout;
  const rows = [
    `# ${budget.device} (${budget.shellWidth}×${budget.shellHeight}) — tier: ${budget.tier}`,
    "",
    "Vertical budget:",
    ...budget.lines.map((l) => `  ${l.label.padEnd(28)} ${String(l.px).padStart(4)} px`),
    `  ${"─".repeat(36)}`,
    `  ${"Shell total".padEnd(28)} ${String(budget.shellHeight).padStart(4)} px`,
    `  ${"Surplus (should be 0)".padEnd(28)} ${String(budget.surplus).padStart(4)} px`,
    "",
    "Play area:",
    `  Height                     ${budget.playAreaHeight} px`,
    `  Ring top pad               ${ringTop} px`,
    `  Card zone                  ${layout.cardZoneWidth}×${layout.cardZoneHeight} px`,
    `  Seat footprint             ${layout.seatFootprintW}×${layout.seatFootprintH} px`,
    `  Compact / very compact     ${layout.isCompact} / ${layout.isVeryCompact}`,
  ];
  return rows.join("\n");
}

export function formatAllGameScreenBudgets(): string {
  return BUDGET_DEVICE_PRESETS.map((preset) =>
    formatGameScreenBudget(computeGameScreenBudget(preset)),
  ).join("\n\n");
}
