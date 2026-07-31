/**
 * Primary ActionBar track modes.
 * Leave must never appear in this track — it lives in GameplayHud.
 */
export type ActionBarTrackMode = "pass-play" | "skip" | "empty";

export function resolveActionBarTrackMode(options: {
  leaveOnly?: boolean;
  skipGameOnly?: boolean;
  hasSkipHandler?: boolean;
}): ActionBarTrackMode {
  if (options.skipGameOnly && options.hasSkipHandler) return "skip";
  if (options.leaveOnly) return "empty";
  return "pass-play";
}

/** Regression guard: primary track never includes Leave. */
export function actionBarTrackIncludesLeave(_mode: ActionBarTrackMode): false {
  return false;
}
