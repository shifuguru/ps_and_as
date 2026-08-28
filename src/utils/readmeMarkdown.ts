import { Platform } from "react-native";
import { marked } from "marked";
import { githubHeadingId } from "./githubHeadingId";
import {
  isGameHomeLink,
  linkWantsRefresh,
} from "./readmeGameLinks";

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
  textPrimary: string;
  borderMuted: string;
  /** Optional — used when sticky section titles replace in-body h1s. */
  surface?: string;
};

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
        tokens: unknown[];
        depth: number;
      }) {
        const plain = tokens.map((t) => tokenPlainText(t as Parameters<typeof tokenPlainText>[0])).join("");
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
        const plainLabel = token.tokens.map(tokenPlainText).join("");
        const gameLink = isGameHomeLink(href);
        const refreshLink = gameLink && linkWantsRefresh(href, plainLabel);
        const titleAttr = token.title
          ? ` title="${escapeHtmlAttr(token.title)}"`
          : "";
        const external =
          !gameLink &&
          (href.startsWith("http://") || href.startsWith("https://"));
        const targetAttr = external
          ? ' target="_blank" rel="noopener noreferrer"'
          : "";
        const actionAttr = gameLink
          ? ` data-readme-game-link="1"${refreshLink ? ' data-readme-refresh="1"' : ""}`
          : "";
        return `<a class="readme-link-pill" href="${safeHref}"${titleAttr}${targetAttr}${actionAttr}>${text}</a>`;
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
.markdown-body {
  color: ${theme.textPrimary};
}
.markdown-body h1 {
  /* Section label lives in the sticky header under "Rules" — keep anchors only. */
  margin: 0 !important;
  padding: 0 !important;
  border: 0 !important;
  height: 0 !important;
  overflow: hidden !important;
  opacity: 0;
  pointer-events: none;
  scroll-margin-top: 0;
}
.markdown-body h2,
.markdown-body h3,
.markdown-body h4,
.markdown-body h5,
.markdown-body h6 {
  scroll-margin-top: 12px;
  border-bottom: none !important;
  padding-bottom: 0.15em;
  color: ${theme.textPrimary} !important;
}
.markdown-body h2 {
  font-size: 1.45em !important;
  font-weight: 800 !important;
  margin-top: 1.1em !important;
  margin-bottom: 0.45em !important;
  line-height: 1.25 !important;
}
.markdown-body h3 {
  font-size: 1.2em !important;
  font-weight: 700 !important;
  margin-top: 1em !important;
  margin-bottom: 0.35em !important;
  line-height: 1.3 !important;
}
.markdown-body p,
.markdown-body li {
  font-size: 15px;
  line-height: 1.55;
}
.markdown-body table {
  font-size: 14px;
}
.markdown-body hr {
  height: 0.2em;
  padding: 0;
  margin: 24px 0;
  background-color: ${theme.borderMuted};
  border: 0;
}
.markdown-body blockquote {
  border-left: none !important;
  padding: 0 !important;
  margin: 0 0 16px;
  color: ${theme.textPrimary} !important;
}
.markdown-body blockquote > :first-child {
  margin-top: 0;
}
.markdown-body blockquote > :last-child {
  margin-bottom: 0;
}
.markdown-body blockquote p {
  color: inherit !important;
}
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
  cursor: pointer;
  pointer-events: auto;
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
