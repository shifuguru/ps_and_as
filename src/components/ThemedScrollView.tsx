import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  NativeSyntheticEvent,
  NativeScrollEvent,
  StyleProp,
  ViewStyle,
} from "react-native";
import { useAppTheme } from "../context/ThemeContext";
import { hexToRgba } from "../utils/colorTheory";

const SCROLLBAR_WIDTH = 8;
const SCROLLBAR_GUTTER = 14;
const SCROLLBAR_INSET = 8;
const MIN_THUMB_HEIGHT = 36;

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

  const resolvedContentStyle = useMemo(
    () =>
      scrollable
        ? [contentContainerStyle, { paddingRight: SCROLLBAR_GUTTER }]
        : contentContainerStyle,
    [contentContainerStyle, scrollable],
  );

  return (
    <View style={[styles.container, style]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={resolvedContentStyle}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onLayout={(event) => setLayoutHeight(event.nativeEvent.layout.height)}
        onContentSizeChange={(_, height) => setContentHeight(height)}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
      {scrollable ? (
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
      position: "relative",
    },
    scroll: {
      flex: 1,
    },
    track: {
      position: "absolute",
      right: SCROLLBAR_INSET,
      width: SCROLLBAR_WIDTH,
      borderRadius: SCROLLBAR_WIDTH / 2,
      backgroundColor: hexToRgba(colors.gold, colors.mode === "dark" ? 0.14 : 0.1),
      borderWidth: 1,
      borderColor: hexToRgba(colors.gold, colors.mode === "dark" ? 0.38 : 0.28),
      zIndex: 20,
      overflow: "hidden",
    },
    thumb: {
      width: SCROLLBAR_WIDTH - 2,
      alignSelf: "center",
      borderRadius: (SCROLLBAR_WIDTH - 2) / 2,
      backgroundColor: colors.gold,
    },
  });
}
