import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  Platform,
  NativeSyntheticEvent,
  NativeScrollEvent,
  StyleProp,
  ViewStyle,
} from "react-native";
import { useAppTheme } from "../context/ThemeContext";
import { PS_THEMED_SCROLLBAR_CLASS } from "../utils/themedScrollbar";

const SCROLLBAR_WIDTH = 6;
const SCROLLBAR_INSET = 6;
const MIN_THUMB_HEIGHT = 32;

type Props = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
};

export default function ThemedScrollView({
  children,
  style,
  contentContainerStyle,
}: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [layoutHeight, setLayoutHeight] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);
  const [offsetY, setOffsetY] = useState(0);

  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    setOffsetY(event.nativeEvent.contentOffset.y);
  }, []);

  const scrollable = contentHeight > layoutHeight + 1;
  const maxScroll = Math.max(0, contentHeight - layoutHeight);
  const thumbHeight = scrollable
    ? Math.max(MIN_THUMB_HEIGHT, (layoutHeight / contentHeight) * layoutHeight)
    : 0;
  const maxThumbTravel = Math.max(0, layoutHeight - thumbHeight);
  const thumbTop =
    maxScroll > 0 ? (offsetY / maxScroll) * maxThumbTravel : 0;

  const webScrollbarStyle =
    Platform.OS === "web"
      ? ({
          ["--scroll-thumb" as string]: colors.gold,
          ["--scroll-track" as string]: colors.actionTrackBg,
          ["--scroll-thumb-hover" as string]: colors.actionPrimaryBorder,
        } as ViewStyle)
      : undefined;

  return (
    <View style={[styles.container, style]}>
      <ScrollView
        style={[styles.scroll, webScrollbarStyle]}
        contentContainerStyle={contentContainerStyle}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onLayout={(event) => setLayoutHeight(event.nativeEvent.layout.height)}
        onContentSizeChange={(_, height) => setContentHeight(height)}
        showsVerticalScrollIndicator={false}
        // @ts-expect-error className is supported on RN Web
        className={Platform.OS === "web" ? PS_THEMED_SCROLLBAR_CLASS : undefined}
      >
        {children}
      </ScrollView>
      {scrollable && Platform.OS !== "web" ? (
        <View
          style={[styles.track, { top: SCROLLBAR_INSET, bottom: SCROLLBAR_INSET }]}
          pointerEvents="none"
        >
          <View
            style={[
              styles.thumb,
              { height: thumbHeight, transform: [{ translateY: thumbTop }] },
            ]}
          />
        </View>
      ) : null}
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useAppTheme>["colors"]) {
  return StyleSheet.create({
    container: {
      flex: 1,
    },
    scroll: {
      flex: 1,
    },
    track: {
      position: "absolute",
      right: SCROLLBAR_INSET,
      width: SCROLLBAR_WIDTH,
      borderRadius: SCROLLBAR_WIDTH / 2,
      backgroundColor: colors.actionTrackBg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.actionTrackBorder,
    },
    thumb: {
      width: SCROLLBAR_WIDTH,
      borderRadius: SCROLLBAR_WIDTH / 2,
      backgroundColor: colors.gold,
    },
  });
}
