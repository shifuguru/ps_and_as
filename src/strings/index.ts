export { strings } from "./en";
export type { Strings } from "./en";

/**
 * Substitutes `{{token}}` placeholders in a string, e.g.
 * `format(strings.game.roundWinner, { name: "Bob" })`.
 */
export function format(
  template: string,
  params: Record<string, string | number> = {},
): string {
  return template.replace(/\{\{([^{}]+)\}\}/g, (match, key) => {
    const trimmedKey = key.trim();
    if (!Object.prototype.hasOwnProperty.call(params, trimmedKey)) {
      return match;
    }

    const value = params[trimmedKey];
    return value === undefined ? match : String(value);
  });
}
