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
  ActivityIndicator,
  Platform,
  useWindowDimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from "react-native";
import ScreenContainer from "../components/ScreenContainer";
import ScreenTopBar from "../components/ScreenTopBar";
import BottomBar, {
  BottomBarControls,
  BottomBarLeave,
  menuBottomReserve,
} from "../components/BottomBar";
import { useLayoutInsets } from "../hooks/useLayoutInsets";
import { contentMaxWidth } from "../styles/uiStandards";
import { useAppTheme } from "../context/ThemeContext";
import { fetchReadmeMarkdown } from "../utils/readmeFallback";
import {
  parseReadmeHtml,
  removeReadmeMarkdownStyles,
  syncReadmeMarkdownStyles,
} from "../utils/readmeMarkdown";
import {
  installReadmeLinkHandlers,
  bindReadmeMarkdownLinks,
  escapeSelectorId,
} from "../utils/readmeAnchorScroll";
import {
  activeSectionForOffset,
  extractRulesSections,
} from "../utils/rulesHeadings";

type Props = {
  onBack: () => void;
};

const NAV_PROBE_OFFSET = 8;

export default function ReadMeScreen({ onBack }: Props) {
  const { colors, ui } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useLayoutInsets();
  const { width } = useWindowDimensions();
  const contentMax = contentMaxWidth(width);
  const bottomBarHeight = menuBottomReserve(insets.bottom || 0);

  const readmeTheme = useMemo(
    () => ({
      linkColor: colors.accent,
      linkBg: colors.btnAccentBg,
      linkBorder: colors.btnAccentBorder,
      textPrimary: colors.textPrimary,
      borderMuted: colors.panelBorder,
      surface: colors.surface,
    }),
    [
      colors.accent,
      colors.btnAccentBg,
      colors.btnAccentBorder,
      colors.textPrimary,
      colors.panelBorder,
      colors.surface,
    ],
  );

  const [markdown, setMarkdown] = useState<string | null>(null);
  const [html, setHtml] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const webScrollRef = useRef<HTMLDivElement | null>(null);
  const [markdownRoot, setMarkdownRoot] = useState<HTMLElement | null>(null);
  const [activeSectionTitle, setActiveSectionTitle] = useState("Rules");
  const headingOffsets = useRef<Map<string, number>>(new Map());
  const scrollRaf = useRef<number | null>(null);

  const sections = useMemo(
    () => (markdown ? extractRulesSections(markdown) : []),
    [markdown],
  );

  useEffect(() => {
    let cancelled = false;
    void fetchReadmeMarkdown()
      .then((text) => {
        if (cancelled) return;
        setMarkdown(text);
        if (Platform.OS === "web") {
          setHtml(parseReadmeHtml(text));
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setLoadError(err.message || "Could not load rules");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

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
      const activeId = activeSectionForOffset(
        sections,
        headingOffsets.current,
        scrollY,
        NAV_PROBE_OFFSET,
      );
      const title =
        sections.find((s) => s.id === activeId)?.title ??
        sections[0]?.title ??
        "Rules";
      setActiveSectionTitle(title);
    },
    [sections],
  );

  useEffect(() => {
    if (sections[0]?.title) setActiveSectionTitle(sections[0].title);
  }, [sections]);

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

  const onNativeScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      updateActiveSection(event.nativeEvent.contentOffset.y);
    },
    [updateActiveSection],
  );

  const loading = !markdown && !loadError;
  const showHtml = Platform.OS === "web" && !!html && !loadError;

  const rulesBody = (
    <View style={[styles.content, { maxWidth: contentMax }]}>
      {loading ? (
        <ActivityIndicator
          color={colors.accent}
          size="large"
          style={styles.loader}
        />
      ) : null}

      {loadError ? (
        <Text style={styles.errorText}>
          {loadError}. Tap Back below to return to the game.
        </Text>
      ) : null}

      {showHtml ? (
        <View style={styles.markdownWrap}>
          <article
            // @ts-expect-error web article element
            ref={setMarkdownRoot}
            className="markdown-body"
            dangerouslySetInnerHTML={{ __html: html }}
            style={styles.markdownWeb}
          />
        </View>
      ) : null}

      {markdown && !showHtml && !loadError ? (
        <Text style={styles.plainMarkdown} selectable>
          {markdown}
        </Text>
      ) : null}
    </View>
  );

  const scrollPadding = {
    paddingTop: 8,
    paddingBottom: bottomBarHeight + 16,
  };

  return (
    <ScreenContainer ignoreHeaderOffset style={{ flex: 1 }}>
      <View style={[styles.page, { paddingTop: insets.top + 12 }]}>
        <View style={[styles.header, { maxWidth: contentMax }]}>
          <ScreenTopBar title="Rules" />
          <Text style={styles.sectionTitle} numberOfLines={1}>
            {activeSectionTitle}
          </Text>
        </View>

        {Platform.OS === "web" ? (
          <View
            // @ts-expect-error web div scroll container
            ref={webScrollRef}
            style={styles.webScroll}
          >
            <View style={[ui.scrollContent, scrollPadding]}>{rulesBody}</View>
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
            {rulesBody}
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
    header: {
      width: "100%",
      alignSelf: "center",
      paddingHorizontal: 24,
      paddingBottom: 6,
    },
    sectionTitle: {
      color: colors.textPrimary,
      fontSize: 24,
      fontWeight: "800",
      letterSpacing: 0.2,
      paddingHorizontal: 4,
      paddingTop: 2,
      paddingBottom: 6,
      lineHeight: 30,
    },
    scroll: {
      flex: 1,
    },
    webScroll: {
      flex: 1,
      minHeight: 0,
      overflow: "scroll",
    } as object,
    content: {
      width: "100%",
      alignSelf: "center",
    },
    bottomControls: {
      paddingTop: 18,
    },
    loader: {
      marginTop: 32,
    },
    errorText: {
      color: colors.textSecondary,
      fontSize: 15,
      lineHeight: 22,
      paddingHorizontal: 4,
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
  });
}
