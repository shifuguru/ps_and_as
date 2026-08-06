import { githubHeadingId } from "./githubHeadingId";

export type RulesSection = {
  id: string;
  title: string;
};

/** Strip emoji / decorative symbols for compact nav labels. */
export function plainSectionTitle(raw: string): string {
  return raw
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Top-level `#` headings become sticky-nav sections. */
export function extractRulesSections(markdown: string): RulesSection[] {
  const sections: RulesSection[] = [];
  for (const line of markdown.split("\n")) {
    const match = /^#\s+(.+)$/.exec(line.trim());
    if (!match) continue;
    const rawTitle = match[1].trim();
    sections.push({
      id: githubHeadingId(rawTitle),
      title: plainSectionTitle(rawTitle),
    });
  }
  return sections;
}

/** Which section is active for a given scroll offset (web + native). */
export function activeSectionForOffset(
  sections: RulesSection[],
  headingOffsets: Map<string, number>,
  scrollY: number,
  stickyOffset = 0,
): string | null {
  if (sections.length === 0) return null;
  const probe = scrollY + stickyOffset + 8;
  let active = sections[0].id;
  for (const section of sections) {
    const top = headingOffsets.get(section.id);
    if (top == null) continue;
    if (top <= probe) active = section.id;
  }
  return active;
}
