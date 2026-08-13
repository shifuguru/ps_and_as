/** Curated in-game table chat — keep in sync with `server/tableChatMessages.js`. */
export type TableChatMessage = {
  id: string;
  text: string;
};

export const TABLE_CHAT_MESSAGES: TableChatMessage[] = [
  { id: "nice-one", text: "Nice one" },
  { id: "good-play", text: "Good play" },
  { id: "well-played", text: "Well played" },
  { id: "nice-try", text: "Nice try" },
  { id: "oops", text: "Oops" },
  { id: "sorry", text: "Sorry" },
  { id: "my-bad", text: "My bad" },
  { id: "gg", text: "GG" },
  { id: "one-sec", text: "One sec" },
  { id: "brb", text: "BRB" },
  { id: "hurry-up", text: "Hurry up" },
  { id: "good-luck", text: "Good luck" },
];

export const TABLE_CHAT_BY_ID: Record<string, string> = Object.fromEntries(
  TABLE_CHAT_MESSAGES.map((entry) => [entry.id, entry.text]),
);

export function resolveTableChatText(
  emoteId: string,
  text?: string | null,
): string | null {
  const trimmed = typeof text === "string" ? text.trim() : "";
  if (trimmed) return trimmed;
  return TABLE_CHAT_BY_ID[emoteId] ?? null;
}
