/** Match GitHub README heading anchors (each space → hyphen; & removal keeps `--`). */
export function githubHeadingId(plain: string): string {
  return plain
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/ /g, "-");
}
