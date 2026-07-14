/** Card play flights — above table/hand, below round-end overlays. */
export const CARD_PLAY_FLIGHT_Z = 150;

/** Asshole last-hand reveal — above gameplay, below round complete. */
export const LAST_HAND_REVEAL_Z = 180;

/** Round complete rankings — highest gameplay presentation layer. */
export const ROUND_COMPLETE_Z = 190;

/** Full-screen modals (Settings, Achievements, update log, system alerts). */
export const MODAL_OVERLAY_Z = 200;

/**
 * Leave-game confirm when embedded inside Round Complete (must sit above
 * rankings inside that Modal — a second RN Modal would draw behind it).
 */
export const LEAVE_CONFIRM_Z = 210;
