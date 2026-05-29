import { Platform } from "react-native";
import { marked } from "marked";

const GITHUB_MD_CSS = {
  light:
    "https://cdnjs.cloudflare.com/ajax/libs/github-markdown-css/5.6.1/github-markdown-light.min.css",
  dark:
    "https://cdnjs.cloudflare.com/ajax/libs/github-markdown-css/5.6.1/github-markdown-dark.min.css",
} as const;

const MD_CSS_ID = "ps-readme-markdown-css";
const MD_OVERRIDE_CSS_ID = "ps-readme-markdown-overrides";

export type ReadmeMarkdownTheme = {
  linkColor: string;
  linkBg: string;
  linkBorder: string;
};

function githubHeadingId(plain: string): string {
  return plain
    .toLowerCase()
    .trim()
    .replace(/&/g, "")
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-");
}

function tokenPlainText(token: {
  text?: string;
  tokens?: { text?: string; tokens?: unknown[] }[];
}): string {
  if (!token) return "";
  if (typeof token.text === "string") return token.text;
  if (Array.isArray(token.tokens)) {
    return token.tokens.map((t) => tokenPlainText(t as typeof token)).join("");
  }
  return "";
}

function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

let parserReady = false;

function ensureMarkedParser(): void {
  if (parserReady) return;
  marked.use({
    renderer: {
      heading(this: { parser: { parseInline: (tokens: unknown[]) => string } }, {
        tokens,
        depth,
      }: {
        tokens: Parameters<typeof tokenPlainText>[0][];
        depth: number;
      }) {
        const plain = tokens.map(tokenPlainText).join("");
        const id = githubHeadingId(plain);
        const inner = this.parser.parseInline(tokens);
        return `<h${depth} id="${id}">${inner}</h${depth}>\n`;
      },
      link(
        this: { parser: { parseInline: (tokens: unknown[]) => string } },
        token: {
          href?: string | null;
          title?: string | null;
          tokens: unknown[];
        },
      ) {
        const text = this.parser.parseInline(token.tokens);
        const href = token.href ?? "#";
        const safeHref = escapeHtmlAttr(href);
        const external =
          href.startsWith("http://") || href.startsWith("https://");
        const titleAttr = token.title
          ? ` title="${escapeHtmlAttr(token.title)}"`
          : "";
        const targetAttr = external
          ? ' target="_blank" rel="noopener noreferrer"'
          : "";
        return `<a class="readme-link-pill" href="${safeHref}"${titleAttr}${targetAttr}>${text}</a>`;
      },
    },
  });
  parserReady = true;
}

/** Parse README markdown to GitHub-flavoured HTML (web). */
export function parseReadmeHtml(markdown: string): string {
  ensureMarkedParser();
  return marked.parse(markdown, { gfm: true, breaks: true }) as string;
}

function overrideCss(theme: ReadmeMarkdownTheme): string {
  return `
.markdown-body a.readme-link-pill {
  display: inline-block;
  color: ${theme.linkColor} !important;
  background: ${theme.linkBg} !important;
  border: 1px solid ${theme.linkBorder} !important;
  border-radius: 999px;
  padding: 5px 14px;
  margin: 3px 6px 3px 0;
  font-weight: 700;
  font-size: 13px;
  line-height: 1.35;
  text-decoration: none !important;
  box-decoration-break: clone;
  -webkit-box-decoration-break: clone;
}
.markdown-body a.readme-link-pill:hover {
  filter: brightness(1.08);
  text-decoration: none !important;
}
.markdown-body a.readme-link-pill:active {
  transform: scale(0.98);
}
`;
}

/** Inject github-markdown-css + in-app link pill overrides for Read Me. */
export function syncReadmeMarkdownStyles(
  mode: "light" | "dark",
  theme: ReadmeMarkdownTheme,
): void {
  if (Platform.OS !== "web") return;
  const doc = (globalThis as { document?: Document }).document;
  if (!doc) return;

  let link = doc.getElementById(MD_CSS_ID) as HTMLLinkElement | null;
  const href = GITHUB_MD_CSS[mode];
  if (!link) {
    link = doc.createElement("link");
    link.id = MD_CSS_ID;
    link.rel = "stylesheet";
    doc.head.appendChild(link);
  }
  if (link.href !== href) {
    link.href = href;
  }

  let override = doc.getElementById(MD_OVERRIDE_CSS_ID) as HTMLStyleElement | null;
  const css = overrideCss(theme);
  if (!override) {
    override = doc.createElement("style");
    override.id = MD_OVERRIDE_CSS_ID;
    doc.head.appendChild(override);
  }
  if (override.textContent !== css) {
    override.textContent = css;
  }
}

export function removeReadmeMarkdownStyles(): void {
  if (Platform.OS !== "web") return;
  const doc = (globalThis as { document?: Document }).document;
  doc?.getElementById(MD_CSS_ID)?.remove();
  doc?.getElementById(MD_OVERRIDE_CSS_ID)?.remove();
}
