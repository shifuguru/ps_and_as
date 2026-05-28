/** Characters used for room join codes (no 0/O/1/I to reduce confusion). */
export const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const BLOCKED = [
  "asshole",
  "assholes",
  "bastard",
  "bitch",
  "bitches",
  "bullshit",
  "cock",
  "crap",
  "cunt",
  "damn",
  "dick",
  "dicks",
  "fag",
  "faggot",
  "fuck",
  "fucker",
  "fucking",
  "fucks",
  "hell",
  "jackass",
  "motherfucker",
  "nazi",
  "nigga",
  "nigger",
  "penis",
  "piss",
  "pussy",
  "shit",
  "shits",
  "slut",
  "twat",
  "vagina",
  "whore",
];

function leetNormalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[@4]/g, "a")
    .replace(/8/g, "b")
    .replace(/[({[]/g, "c")
    .replace(/3/g, "e")
    .replace(/6/g, "g")
    .replace(/#/g, "h")
    .replace(/1|!|\|/g, "i")
    .replace(/0/g, "o")
    .replace(/5|\$/g, "s")
    .replace(/7/g, "t")
    .replace(/\+/g, "t")
    .replace(/[^a-z0-9\s]/g, "");
}

function compactAlpha(text: string): string {
  return leetNormalize(text).replace(/\s+/g, "");
}

export function containsProfanity(text: string): boolean {
  if (!text.trim()) return false;
  const normalized = leetNormalize(text);
  const compact = compactAlpha(text);

  return BLOCKED.some((word) => {
    if (normalized.includes(word)) return true;
    if (compact.includes(word.replace(/\s+/g, ""))) return true;
    return false;
  });
}

export type DisplayTextValidation =
  | { ok: true; value: string }
  | { ok: false; reason: string };

export function validateDisplayText(
  text: string,
  fieldLabel = "This text",
): DisplayTextValidation {
  const trimmed = text.trim();
  if (!trimmed) {
    return { ok: false as const, reason: `${fieldLabel} cannot be empty.` };
  }
  if (containsProfanity(trimmed)) {
    return {
      ok: false as const,
      reason: `${fieldLabel} contains language that isn't allowed. Please choose something else.`,
    };
  }
  return { ok: true as const, value: trimmed };
}

export function displayTextError(result: DisplayTextValidation): string | null {
  return result.ok === false ? result.reason : null;
}

export function isValidDisplayText(
  result: DisplayTextValidation,
): result is { ok: true; value: string } {
  return result.ok === true;
}
