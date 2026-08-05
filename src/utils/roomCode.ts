/** Characters used for room join codes (no 0/O/1/I to reduce confusion). */
export const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export const ROOM_CODE_LENGTH = 6;

/** Public bot-hosted matchmaking room — hidden from Find Game per D-010. */
export const BOT_PUBLIC_ROOM_CODE = "BOTOPN";

export function isBotPublicRoomCode(code: string): boolean {
  return normalizeRoomCode(code) === BOT_PUBLIC_ROOM_CODE;
}

export function generateRoomCode(length = ROOM_CODE_LENGTH): string {
  let code = "";
  for (let i = 0; i < length; i++) {
    const idx = Math.floor(Math.random() * ROOM_CODE_ALPHABET.length);
    code += ROOM_CODE_ALPHABET[idx];
  }
  return code;
}

/** Normalize user-entered join codes to uppercase alphanumeric. */
export function normalizeRoomCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function isValidRoomCode(code: string): boolean {
  return /^[A-Z0-9]{4,8}$/.test(code);
}
