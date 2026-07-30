export type PresenceKind =
  | "idle"
  | "activeTurn"
  | "waitingReminder"
  | "voiceActive"
  | "disconnected"
  | "spectating";

export type PresenceAccent = "turnWhite" | "turnGold" | "voiceTeal" | "warningAmber" | "mutedSlate";

export type PresenceWaveSpec = {
  amplitudePx: number;
  lobeCount: number;
  /** Full rotation period in milliseconds. */
  rotationPeriodMs: number;
};

export type PresenceRingSpec = {
  kind: PresenceKind;
  /** Normalized waiting urgency — 0 calm idle, 1 maximum at 16s. */
  urgency: number;
  accent: PresenceAccent;
  /** 0–1 visual intensity multiplier. */
  intensity: number;
  /** Full sine-breathe cycle length in ms. */
  pulsePeriodMs: number;
  /** Ring scale amplitude from breathe (see pulseStrengthForUrgency). */
  pulseStrength: number;
  /** Halo scale amplitude from breathe. */
  haloStrength: number;
  wave: PresenceWaveSpec;
  /** Future hook — voice or external systems may drive wave amplitude directly. */
  externalWaveAmplitude?: number | null;
  /** Bell / turnNudge brighter pulse — preserves existing nudge UX. */
  nudge: boolean;
  a11yLabel: string;
};

/** Inputs for resolvePresenceRing — turn ownership fields are read-only context. */
export type PresenceContext = {
  /** Presentation ring owner — must match turnHighlightPlayerId from GameScreen. */
  turnHighlightPlayerId: string;
  /** Authoritative display-turn player id (who must act). */
  turnPlayerId: string;
  turnElapsedMs: number;
  turnPresencePaused: boolean;
  turnPlayerIsCpu: boolean;
  nudgeHighlightPlayerId: string | null;
  disconnectedPlayerIds: ReadonlySet<string>;
  readOnlySpectator: boolean;
};
