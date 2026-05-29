import { Platform } from "react-native";
import type { ScrollView } from "react-native";
import type { RefObject } from "react";
import {
  isGameHomeLink,
  linkWantsRefresh,
  openGameLink,
} from "./readmeGameLinks";

const SCROLL_PADDING = 20;

function escapeSelectorId(id: string): string {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(id);
  }
  return id.replace(/([ !"#$%&'()*+,./:;<=>?@[\\\]^`{|}~])/g, "\\$1");
}

function findHeading(id: string, root?: HTMLElement | null): HTMLElement | null {
  if (root) {
    const inRoot = root.querySelector<HTMLElement>(`#${escapeSelectorId(id)}`);
    if (inRoot) return inRoot;
  }
  return document.getElementById(id);
}

function scrollableNode(
  scrollRef: RefObject<ScrollView | null>,
): HTMLElement | null {
  const scrollView = scrollRef.current;
  if (!scrollView) return null;

  const scrollNode = (
    scrollView as ScrollView & { getScrollableNode?: () => HTMLElement }
  ).getScrollableNode?.();

  return scrollNode ?? null;
}

function findScrollableAncestor(el: HTMLElement): HTMLElement | null {
  let node: HTMLElement | null = el.parentElement;
  while (node && node !== document.body) {
    const style = window.getComputedStyle(node);
    const canScrollY =
      /(auto|scroll|overlay)/.test(style.overflowY) &&
      node.scrollHeight > node.clientHeight + 1;
    if (canScrollY) return node;
    node = node.parentElement;
  }
  return null;
}

function scrollElementToHeading(
  container: HTMLElement,
  heading: HTMLElement,
): void {
  const headTop =
    heading.getBoundingClientRect().top -
    container.getBoundingClientRect().top +
    container.scrollTop;
  container.scrollTo({
    top: Math.max(0, headTop - SCROLL_PADDING),
    behavior: "smooth",
  });
}

/** Scroll to a README heading id (TOC / in-page links). */
export function scrollToReadmeHeading(
  scrollRef: RefObject<ScrollView | null> | undefined,
  id: string,
  root?: HTMLElement | null,
): void {
  if (Platform.OS !== "web") return;

  const heading = findHeading(id, root);
  if (!heading) return;

  if (scrollRef?.current) {
    const fromRef = scrollableNode(scrollRef);
    if (fromRef) {
      scrollElementToHeading(fromRef, heading);
      return;
    }

    scrollRef.current.scrollTo({
      y: Math.max(0, heading.offsetTop - SCROLL_PADDING),
      animated: true,
    });
    return;
  }

  const fromDom = findScrollableAncestor(heading);
  if (fromDom) {
    scrollElementToHeading(fromDom, heading);
    return;
  }

  heading.scrollIntoView({ behavior: "smooth", block: "start" });
}

function handleReadmeLinkClick(
  e: Event,
  link: HTMLAnchorElement,
  scrollRef: RefObject<ScrollView | null> | undefined,
  root: HTMLElement | null | undefined,
  onDismiss?: () => void,
): void {
  const href = link.getAttribute("href");
  if (!href) return;

  if (href.startsWith("#")) {
    e.preventDefault();
    e.stopPropagation();
    scrollToReadmeHeading(scrollRef, decodeURIComponent(href.slice(1)), root);
    return;
  }

  if (!isGameHomeLink(href)) return;

  e.preventDefault();
  e.stopPropagation();
  const refresh = linkWantsRefresh(href, link.textContent ?? "");
  openGameLink({
    refresh,
    inAppDismiss: refresh ? undefined : onDismiss,
  });
}

/** Bind click handlers on every README anchor (reliable on RN Web). */
export function bindReadmeMarkdownLinks(
  root: HTMLElement,
  options?: {
    scrollRef?: RefObject<ScrollView | null>;
    onDismiss?: () => void;
  },
): () => void {
  if (Platform.OS !== "web") return () => {};

  const cleanups: Array<() => void> = [];
  const links = root.querySelectorAll("a[href]");

  links.forEach((node) => {
    const link = node as HTMLAnchorElement;
    const handler = (e: Event) => {
      handleReadmeLinkClick(
        e,
        link,
        options?.scrollRef,
        root,
        options?.onDismiss,
      );
    };
    link.addEventListener("click", handler, true);
    cleanups.push(() => link.removeEventListener("click", handler, true));
  });

  return () => {
    for (const cleanup of cleanups) cleanup();
  };
}

export function installReadmeLinkHandlers(
  scrollRef: RefObject<ScrollView | null>,
  enabled: boolean,
  options?: { onDismiss?: () => void; root?: HTMLElement | null },
): () => void {
  if (Platform.OS !== "web" || !enabled) return () => {};

  const unbindRoot = options?.root
    ? bindReadmeMarkdownLinks(options.root, {
        scrollRef,
        onDismiss: options.onDismiss,
      })
    : () => {};

  const handleClick = (e: MouseEvent) => {
    const link = (e.target as HTMLElement | null)?.closest?.("a");
    if (!link || options?.root?.contains(link)) return;
    handleReadmeLinkClick(e, link, scrollRef, options?.root, options?.onDismiss);
  };

  document.addEventListener("click", handleClick, true);

  return () => {
    unbindRoot();
    document.removeEventListener("click", handleClick, true);
  };
}
