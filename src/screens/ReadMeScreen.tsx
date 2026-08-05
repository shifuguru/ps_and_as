import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Platform,
  useWindowDimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Pressable,
  Linking,
} from "react-native";
import ScreenContainer from "../components/ScreenContainer";
import ScreenTopBar from "../components/ScreenTopBar";
import RulesSectionNav from "../components/RulesSectionNav";
import BottomBar, {
  BottomBarControls,
  BottomBarLeave,
  menuBottomReserve,
} from "../components/BottomBar";
import { useLayoutInsets } from "../hooks/useLayoutInsets";
import { contentMaxWidth } from "../styles/uiStandards";
import { useAppTheme } from "../context/ThemeContext";
import {
  parseReadmeHtml,
  removeReadmeMarkdownStyles,
  syncReadmeMarkdownStyles,
} from "../utils/readmeMarkdown";
import {
  installReadmeLinkHandlers,
  bindReadmeMarkdownLinks,
  scrollToReadmeHeading,
  escapeSelectorId,
} from "../utils/readmeAnchorScroll";
import {
  activeSectionForOffset,
  extractRulesSections,
} from "../utils/rulesHeadings";
import {
  RULES_MARKDOWN,
  RULES_PRIVACY_URL,
} from "./rulesContent";

type Props = {
  onBack: () => void;
};

const NAV_PROBE_OFFSET = 12;

export default function ReadMeScreen({ onBack }: Props) {
  const { colors, ui } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useLayoutInsets();
  const { width } = useWindowDimensions();
  const contentMax = contentMaxWidth(width);
  const bottomBarHeight = menuBottomReserve(insets.bottom || 0);

  const markdown = RULES_MARKDOWN;
  const sections = useMemo(() => extractRulesSections(markdown), [markdown]);

  const readmeTheme = useMemo(
    () => ({
      linkColor: colors.accent,
      linkBg: colors.btnAccentBg,
      linkBorder: colors.btnAccentBorder,
      textPrimary: colors.textPrimary,
      borderMuted: colors.panelBorder,
    }),
    [
      colors.accent,
      colors.btnAccentBg,
      colors.btnAccentBorder,
      colors.textPrimary,
      colors.panelBorder,
    ],
  );

  const html = useMemo(
    () => (Platform.OS === "web" ? parseReadmeHtml(markdown) : null),
    [markdown],
  );

  const scrollRef = useRef<ScrollView>(null);
  const webScrollRef = useRef<HTMLDivElement | null>(null);
  const [markdownRoot, setMarkdownRoot] = useState<HTMLElement | null>(null);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(
    sections[0]?.id ?? null,
  );
  const headingOffsets = useRef<Map<string, number>>(new Map());
  const scrollRaf = useRef<number | null>(null);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    syncReadmeMarkdownStyles(colors.mode, readmeTheme);
    return () => removeReadmeMarkdownStyles();
  }, [colors.mode, readmeTheme]);

  useEffect(() => {
    if (Platform.OS !== "web" || !html || !markdownRoot) return;
    return bindReadmeMarkdownLinks(markdownRoot, { onDismiss: onBack });
  }, [html, markdownRoot, onBack]);

  useEffect(
    () =>
      installReadmeLinkHandlers(
        scrollRef,
        Platform.OS !== "web" && !!html,
        { onDismiss: onBack, root: markdownRoot },
      ),
    [html, markdownRoot, onBack],
  );

  const measureHeadings = useCallback(() => {
    const next = new Map<string, number>();
    for (const section of sections) {
      const el =
        markdownRoot?.querySelector<HTMLElement>(
          `#${escapeSelectorId(section.id)}`,
        ) ??
        (Platform.OS === "web" ? document.getElementById(section.id) : null);
      if (!el) continue;

      if (Platform.OS === "web" && webScrollRef.current) {
        const container = webScrollRef.current;
        const top =
          el.getBoundingClientRect().top -
          container.getBoundingClientRect().top +
          container.scrollTop;
        next.set(section.id, top);
      } else if (scrollRef.current) {
        next.set(section.id, el.offsetTop);
      }
    }
    headingOffsets.current = next;
  }, [markdownRoot, sections]);

  useEffect(() => {
    measureHeadings();
    if (Platform.OS !== "web") return;
    const container = webScrollRef.current;
    if (!container) return;
    const observer = new ResizeObserver(() => measureHeadings());
    observer.observe(container);
    if (markdownRoot) observer.observe(markdownRoot);
    return () => observer.disconnect();
  }, [html, markdownRoot, measureHeadings]);

  const updateActiveSection = useCallback(
    (scrollY: number) => {
      const active = activeSectionForOffset(
        sections,
        headingOffsets.current,
        scrollY,
        NAV_PROBE_OFFSET,
      );
      if (active) setActiveSectionId(active);
    },
    [sections],
  );

  const onNativeScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      updateActiveSection(event.nativeEvent.contentOffset.y);
    },
    [updateActiveSection],
  );

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const container = webScrollRef.current;
    if (!container) return;

    const onScroll = () => {
      if (scrollRaf.current != null) return;
      scrollRaf.current = requestAnimationFrame(() => {
        scrollRaf.current = null;
        updateActiveSection(container.scrollTop);
      });
    };

    container.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      container.removeEventListener("scroll", onScroll);
      if (scrollRaf.current != null) cancelAnimationFrame(scrollRaf.current);
    };
  }, [html, updateActiveSection]);

  const scrollToSection = useCallback(
    (id: string) => {
      setActiveSectionId(id);
      if (Platform.OS === "web" && webScrollRef.current) {
        const heading =
          markdownRoot?.querySelector<HTMLElement>(
            `#${escapeSelectorId(id)}`,
          ) ?? document.getElementById(id);
        if (heading) {
          const container = webScrollRef.current;
          const top =
            heading.getBoundingClientRect().top -
            container.getBoundingClientRect().top +
            container.scrollTop;
          container.scrollTo({
            top: Math.max(0, top - NAV_PROBE_OFFSET),
            behavior: "smooth",
          });
        }
        return;
      }
      scrollToReadmeHeading(scrollRef, id, markdownRoot);
    },
    [markdownRoot],
  );

  const showHtml = Platform.OS === "web" && !!html;

  const markdownBody = showHtml ? (
    <View style={styles.markdownWrap}>
      <article
        // @ts-expect-error web article element
        ref={setMarkdownRoot}
        className="markdown-body"
        dangerouslySetInnerHTML={{ __html: html }}
        style={styles.markdownWeb}
      />
    </View>
  ) : (
    <Text style={styles.plainMarkdown} selectable>
      {markdown}
    </Text>
  );

  const scrollContent = (
    <View style={[styles.scrollInner, { maxWidth: contentMax }]}>
      {markdownBody}
      <Pressable
        onPress={() => void Linking.openURL(RULES_PRIVACY_URL)}
        style={styles.privacyRow}
        accessibilityRole="link"
        accessibilityLabel="Privacy policy"
      >
        <Text style={styles.privacyText}>Privacy policy</Text>
      </Pressable>
    </View>
  );

  const headerBlock = (
    <View style={[styles.headerBlock, { maxWidth: contentMax }]}>
      <ScreenTopBar title="Rules" />
      <RulesSectionNav
        sections={sections}
        activeId={activeSectionId}
        onSelect={scrollToSection}
      />
    </View>
  );

  const topPadding = insets.top + 12;
  const scrollPadding = {
    paddingTop: 8,
    paddingBottom: bottomBarHeight + 12,
  };

  return (
    <ScreenContainer ignoreHeaderOffset style={{ flex: 1 }}>
      <View style={[styles.page, { paddingTop: topPadding }]}>
        <View style={[ui.scrollContent, styles.headerWrap]}>{headerBlock}</View>

        {Platform.OS === "web" ? (
          <View
            // @ts-expect-error web div scroll container
            ref={webScrollRef}
            style={styles.webScroll}
          >
            <View style={[ui.scrollContent, scrollPadding]}>{scrollContent}</View>
          </View>
        ) : (
          <ScrollView
            ref={scrollRef}
            style={styles.scroll}
            contentContainerStyle={[ui.scrollContent, scrollPadding]}
            showsVerticalScrollIndicator
            onScroll={onNativeScroll}
            scrollEventThrottle={16}
          >
            {scrollContent}
          </ScrollView>
        )}
      </View>

      <BottomBar>
        <BottomBarControls style={styles.bottomControls}>
          <BottomBarLeave onPress={onBack} label="Back" />
        </BottomBarControls>
      </BottomBar>
    </ScreenContainer>
  );
}

function createStyles(colors: ReturnType<typeof useAppTheme>["colors"]) {
  return StyleSheet.create({
    page: {
      flex: 1,
      minHeight: 0,
    },
    headerWrap: {
      zIndex: 20,
    },
    headerBlock: {
      width: "100%",
      alignSelf: "center",
      backgroundColor: colors.surface,
    },
    scroll: {
      flex: 1,
    },
    webScroll: {
      flex: 1,
      minHeight: 0,
      overflow: "scroll",
    } as object,
    scrollInner: {
      width: "100%",
      alignSelf: "center",
    },
    bottomControls: {
      paddingTop: 18,
    },
    markdownWrap: {
      width: "100%",
    },
    markdownWeb: {
      backgroundColor: "transparent",
      boxSizing: "border-box",
      minWidth: 200,
      paddingHorizontal: 4,
      paddingVertical: 8,
    } as object,
    plainMarkdown: {
      color: colors.textPrimary,
      fontSize: 14,
      lineHeight: 21,
      fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
      paddingHorizontal: 4,
    },
    privacyRow: {
      alignSelf: "flex-start",
      marginTop: 8,
      marginBottom: 4,
      paddingHorizontal: 4,
      paddingVertical: 8,
    },
    privacyText: {
      color: colors.textTertiary,
      fontSize: 12,
      textDecorationLine: "underline",
    },
  });
}
