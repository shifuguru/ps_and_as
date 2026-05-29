import { Platform } from "react-native";
import type { ScrollView } from "react-native";
import type { RefObject } from "react";
import {
  isGameHomeLink,
  linkWantsRefresh,
  openGameLink,
} from "./readmeGameLinks";

/** Scroll an RN Web ScrollView to a README heading id (TOC / in-page links). */
export function scrollToReadmeHeading(
  scrollRef: RefObject<ScrollView | null>,
  id: string,
): void {
  if (Platform.OS !== "web") return;

  const heading = document.getElementById(id);
  const scrollView = scrollRef.current;
  if (!heading || !scrollView) return;

  const scrollNode = (
    scrollView as ScrollView & { getScrollableNode?: () => HTMLElement }
  ).getScrollableNode?.();

  if (scrollNode) {
    const headRect = heading.getBoundingClientRect();
    const scrollRect = scrollNode.getBoundingClientRect();
    const next = scrollNode.scrollTop + headRect.top - scrollRect.top - 20;
    scrollNode.scrollTo({ top: Math.max(0, next), behavior: "smooth" });
    return;
  }

  scrollView.scrollTo({ y: Math.max(0, heading.offsetTop - 20), animated: true });
}

export function installReadmeLinkHandlers(
  scrollRef: RefObject<ScrollView | null>,
  enabled: boolean,
  options?: { onDismiss?: () => void },
): () => void {
  if (Platform.OS !== "web" || !enabled) return () => {};

  const handleClick = (e: MouseEvent) => {
    const link = (e.target as HTMLElement | null)?.closest?.("a");
    if (!link) return;
    const href = link.getAttribute("href");
    if (!href) return;

    if (href.startsWith("#")) {
      e.preventDefault();
      e.stopPropagation();
      scrollToReadmeHeading(scrollRef, decodeURIComponent(href.slice(1)));
      return;
    }

    if (!isGameHomeLink(href)) return;

    e.preventDefault();
    e.stopPropagation();
    const refresh = linkWantsRefresh(href, link.textContent ?? "");
    openGameLink({
      refresh,
      inAppDismiss: refresh ? undefined : options?.onDismiss,
    });
  };

  document.addEventListener("click", handleClick, true);
  return () => document.removeEventListener("click", handleClick, true);
}
