import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Platform,
  useWindowDimensions,
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
import { installReadmeLinkHandlers, bindReadmeMarkdownLinks } from "../utils/readmeAnchorScroll";

type Props = {
  onBack: () => void;
};

export default function ReadMeScreen({ onBack }: Props) {
  const { colors, ui } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useLayoutInsets();
  const { width } = useWindowDimensions();
  const contentMax = contentMaxWidth(width);
  const bottomBarHeight = menuBottomReserve(insets.bottom || 0);

  const readmeTheme = useMemo(
    () => ({
      linkColor: colors.gold,
      linkBg: colors.btnGoldBg,
      linkBorder: colors.btnGoldBorder,
      textPrimary: colors.textPrimary,
      borderMuted: colors.panelBorder,
    }),
    [
      colors.gold,
      colors.btnGoldBg,
      colors.btnGoldBorder,
      colors.textPrimary,
      colors.panelBorder,
    ],
  );

  const [markdown, setMarkdown] = useState<string | null>(null);
  const [html, setHtml] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const [markdownRoot, setMarkdownRoot] = useState<HTMLElement | null>(null);

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
          setLoadError(err.message || "Could not load README");
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

  const loading = !markdown && !loadError;
  const showHtml = Platform.OS === "web" && !!html && !loadError;

  const readmeBody = (
    <View style={[styles.content, { maxWidth: contentMax }]}>
      <ScreenTopBar title="Read Me" />

      {loading ? (
        <ActivityIndicator
          color={colors.gold}
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
    paddingTop: insets.top + 12,
    paddingBottom: bottomBarHeight,
  };

  return (
    <ScreenContainer ignoreHeaderOffset style={{ flex: 1 }}>
      {Platform.OS === "web" ? (
        <View style={styles.webScroll}>
          <View style={[ui.scrollContent, scrollPadding]}>{readmeBody}</View>
        </View>
      ) : (
        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={[ui.scrollContent, scrollPadding]}
          showsVerticalScrollIndicator
        >
          {readmeBody}
        </ScrollView>
      )}

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
