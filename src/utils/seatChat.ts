export const SEAT_CHAT_MAX_LENGTH = 80;
export const SEAT_CHAT_DISPLAY_MS = 6000;

export function normalizeSeatChatText(raw: string): string {
  return String(raw ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, SEAT_CHAT_MAX_LENGTH);
}
