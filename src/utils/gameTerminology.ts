/** Translate game-owned display text without changing stored roles or player names. */
export function gameTerminology(text: string, kingsName: boolean): string {
  if (!kingsName) return text;
  return text
    .replace(/\bP(['’])s\s*&\s*A(['’])s/gi, (match, pQuote, aQuote) =>
      `${match[0] === "p" ? "k" : "K"}${pQuote}s & A${aQuote}s`,
    )
    .replace(/\bpresident(s)?\b/gi, (match, plural: string | undefined) => {
      const king = match === match.toUpperCase() ? "KING" :
        match[0] === "P" ? "King" : "king";
      return king + (plural ? (plural === "S" ? "S" : "s") : "");
    })
    .replace(/\bVice Pres\./g, "Vice King");
}
