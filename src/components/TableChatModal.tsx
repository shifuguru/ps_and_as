import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  ViewStyle,
} from "react-native";
import { BlurView } from "expo-blur";
import BlurPanel from "./BlurPanel";
import { tableChatBubbleColors } from "../chat/tableChatAppearance";
import { TABLE_CHAT_MESSAGES } from "../chat/tableChatMessages";
import { triggerHaptic } from "../utils/haptics";
import { useAppTheme } from "../context/ThemeContext";

type Props = {
  visible: boolean;
  onSelect: (emoteId: string) => void;
  onClose: () => void;
};

const USAGE_KEY = "tableChatUsage";
const HANDLE_AREA_HEIGHT = 36;
const SHEET_HORIZONTAL_PADDING = 28;
const SHEET_BOTTOM_PADDING = 12;
const SHEET_BORDER_ALLOWANCE = 2;
const INITIAL_HEIGHT_RATIO = 0.4;
const OPTION_BLUR_INTENSITY = 90;
const OPTION_GLASS_COLOR = "rgba(25, 25, 25, 0.702)";

function getAsyncStorage(): {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
} | null {
  try {
    return require("@react-native-async-storage/async-storage").default;
  } catch {
    return null;
  }
}

export default function TableChatModal({
  visible,
  onSelect,
  onClose,
}: Props) {
  const { colors, blur } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { height: windowHeight } = useWindowDimensions();
  const [headerHeight, setHeaderHeight] = useState(70);
  const [hintHeight, setHintHeight] = useState(36);
  const [allHeight, setAllHeight] = useState(0);
  const [optionLayouts, setOptionLayouts] = useState<Record<string, { y: number; height: number }>>({});
  const maxSheetHeight = Math.max(1, windowHeight * 0.85);
  const initialHeightLimit = Math.min(maxSheetHeight, windowHeight * INITIAL_HEIGHT_RATIO);

  const [usage, setUsage] = useState<Record<string, number>>({});
  const [hoveredOption, setHoveredOption] = useState<string | null>(null);
  const [desktopPointer, setDesktopPointer] = useState(false);
  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined" || !window.matchMedia) return;
    const query = window.matchMedia("(pointer: fine) and (hover: hover)");
    const update = () => setDesktopPointer(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  const usageRef = useRef(usage);
  usageRef.current = usage;
  const ordered = useMemo(
    () =>
      TABLE_CHAT_MESSAGES.map((entry, index) => ({ entry, index }))
        .sort(
          (a, b) =>
            (usage[b.entry.id] ?? 0) - (usage[a.entry.id] ?? 0) || a.index - b.index,
        )
        .map((row) => row.entry),
    [usage],
  );
  const measured = allHeight > 0 && ordered.every((entry) => optionLayouts[entry.id]);
  const chromeHeight = headerHeight + SHEET_BOTTOM_PADDING + SHEET_BORDER_ALLOWANCE;
  const hasOverflow = measured && chromeHeight + allHeight > initialHeightLimit;
  const availableOptionHeight = Math.max(0, initialHeightLimit - chromeHeight - hintHeight);
  const visibleOptions = hasOverflow
    ? ordered.filter((entry) => {
        const layout = optionLayouts[entry.id];
        return layout.y + layout.height <= availableOptionHeight + 0.5;
      })
    : ordered;
  const visibleHeight = hasOverflow
    ? visibleOptions.reduce((height, entry) => {
        const layout = optionLayouts[entry.id];
        return Math.max(height, layout.y + layout.height);
      }, 0)
    : allHeight;
  const collapsedHeight = Math.min(
    maxSheetHeight,
    chromeHeight + visibleHeight + (hasOverflow ? hintHeight : 0),
  );
  const expandedHeight = Math.min(
    maxSheetHeight,
    chromeHeight + allHeight,
  );

  const sheetHeight = useRef(new Animated.Value(collapsedHeight)).current;
  const slideY = useRef(new Animated.Value(expandedHeight)).current;
  const heightRef = useRef(collapsedHeight);
  const dragStartRef = useRef(collapsedHeight);
  const dragStartedExpandedRef = useRef(false);
  const [expanded, setExpanded] = useState(false);
  const limitsRef = useRef({ collapsedHeight, expandedHeight, expanded, hasOverflow, onClose });
  limitsRef.current = { collapsedHeight, expandedHeight, expanded, hasOverflow, onClose };

  useEffect(() => {
    const id = sheetHeight.addListener(({ value }) => {
      heightRef.current = value;
    });
    return () => sheetHeight.removeListener(id);
  }, [sheetHeight]);

  useEffect(() => {
    if (!visible) return;
    sheetHeight.setValue(limitsRef.current.collapsedHeight);
    heightRef.current = limitsRef.current.collapsedHeight;
    setExpanded(false);
    slideY.setValue(limitsRef.current.collapsedHeight);
    Animated.timing(slideY, {
      toValue: 0,
      duration: 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    const store = getAsyncStorage();
    store
      ?.getItem(USAGE_KEY)
      .then((raw) => {
        if (raw) setUsage(JSON.parse(raw) ?? {});
      })
      .catch(() => undefined);
  }, [visible, sheetHeight, slideY]);

  const snapTo = useCallback(
    (showAll: boolean) => {
      const { collapsedHeight: collapsed, expandedHeight: full, hasOverflow: canExpand } = limitsRef.current;
      const nextExpanded = showAll && canExpand;
      setExpanded(nextExpanded);
      Animated.spring(sheetHeight, {
        toValue: nextExpanded ? full : collapsed,
        useNativeDriver: false,
        bounciness: 0,
        speed: 16,
      }).start();
    },
    [sheetHeight],
  );

  useEffect(() => {
    if (measured && !hasOverflow) setExpanded(false);
  }, [hasOverflow, measured]);

  useEffect(() => {
    if (!visible) return;
    Animated.spring(sheetHeight, {
      toValue: expanded ? expandedHeight : collapsedHeight,
      useNativeDriver: false,
      bounciness: 0,
      speed: 16,
    }).start();
  }, [visible, expanded, collapsedHeight, expandedHeight, sheetHeight]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          sheetHeight.stopAnimation();
          dragStartRef.current = heightRef.current;
          dragStartedExpandedRef.current = limitsRef.current.expanded;
        },
        onPanResponderMove: (_e, g) => {
          const { collapsedHeight: collapsed, expandedHeight: full } = limitsRef.current;
          const max = Math.max(collapsed, full);
          sheetHeight.setValue(
            Math.min(max, Math.max(Math.max(1, collapsed - 90), dragStartRef.current - g.dy)),
          );
        },
        onPanResponderRelease: (_e, g) => {
          const { collapsedHeight: collapsed, expandedHeight: full } = limitsRef.current;
          const max = Math.max(collapsed, full);
          const current = Math.min(max, Math.max(Math.max(1, collapsed - 90), dragStartRef.current - g.dy));
          if (
            !dragStartedExpandedRef.current &&
            (current < collapsed - 50 || (g.vy > 1.2 && current <= collapsed))
          ) {
            limitsRef.current.onClose();
            return;
          }
          const mid = (collapsed + max) / 2;
          if (g.vy < -0.5 || g.dy < -40) snapTo(true);
          else if (g.vy > 0.5 || g.dy > 40) snapTo(false);
          else if (max - collapsed < 1) snapTo(dragStartedExpandedRef.current);
          else snapTo(current > mid);
        },
        onPanResponderTerminate: () => {
          snapTo(dragStartedExpandedRef.current);
        },
      }),
    [sheetHeight, snapTo],
  );

  const handleSelect = (id: string) => {
    triggerHaptic("light");
    const next = { ...usageRef.current, [id]: (usageRef.current[id] ?? 0) + 1 };
    setUsage(next);
    getAsyncStorage()
      ?.setItem(USAGE_KEY, JSON.stringify(next))
      .catch(() => undefined);
    onSelect(id);
  };

  const optionContent = (
    entry: { id: string; text: string },
    measuring = false,
    highlighted = false,
  ) => (
    <>
      {measuring ? (
        <View style={styles.optionBubble}>
          <Text style={styles.optionText}>{entry.text}</Text>
        </View>
      ) : (
        <BlurView
          style={[styles.optionBubble, Platform.OS === "web" && styles.optionBubbleWeb]}
          tint="dark"
          intensity={OPTION_BLUR_INTENSITY}
          experimentalBlurMethod={Platform.OS === "android" ? "dimezisBlurView" : "none"}
        >
          {highlighted && <View pointerEvents="none" style={styles.optionHighlight} />}
          <Text style={styles.optionText}>{entry.text}</Text>
        </BlurView>
      )}
      <View style={styles.optionTail} testID="quick-chat-option-tail" />
    </>
  );
  const renderOption = (entry: { id: string; text: string }) => (
    <Pressable
      key={entry.id}
      style={styles.optionBtn}
      onHoverIn={() => setHoveredOption(entry.id)}
      onHoverOut={() => setHoveredOption(null)}
      onPress={() => handleSelect(entry.id)}
      accessibilityRole="button"
      accessibilityLabel={entry.text}
    >
      {({ pressed }) => optionContent(entry, false, pressed || hoveredOption === entry.id)}
    </Pressable>
  );

  const webHandleProps = Platform.OS === "web" ? {
    onKeyDown: (event: React.KeyboardEvent) => {
      if (event.key === "ArrowUp" || event.key === "ArrowRight" || event.key === "End") {
        event.preventDefault();
        snapTo(true);
      } else if (event.key === "ArrowDown" || event.key === "ArrowLeft" || event.key === "Home") {
        event.preventDefault();
        snapTo(false);
      }
    },
  } : {};

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close quick chat"
        />
        <Animated.View
          testID="quick-chat-sheet"
          style={[styles.sheetWrap, { height: sheetHeight, transform: [{ translateY: slideY }] }]}
        >
          <BlurPanel style={styles.sheet} contentStyle={styles.fill} preset={blur.modal}>
            <View
              style={styles.measurement}
              pointerEvents="none"
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              <View style={[styles.grid, desktopPointer && styles.desktopGrid]} onLayout={(event) => setAllHeight(event.nativeEvent.layout.height)}>
                {ordered.map((entry) => (
                  <View
                    key={entry.id}
                    style={styles.optionBtn}
                    onLayout={(event) => {
                      const { y, height } = event.nativeEvent.layout;
                      setOptionLayouts((previous) =>
                        previous[entry.id]?.y === y && previous[entry.id]?.height === height
                          ? previous
                          : { ...previous, [entry.id]: { y, height } },
                      );
                    }}
                  >
                    {optionContent(entry, true)}
                  </View>
                ))}
              </View>
            </View>
            <View onLayout={(event) => setHeaderHeight(event.nativeEvent.layout.height)}>
              {(!desktopPointer || hasOverflow) && <View
                style={[styles.handleArea, Platform.OS === "web" && styles.handleAreaWeb]}
                {...panResponder.panHandlers}
                {...webHandleProps}
                accessible
                focusable
                accessibilityRole={hasOverflow ? "adjustable" : undefined}
                accessibilityLabel={hasOverflow ? (expanded ? "Collapse quick chat" : "Expand quick chat") : "Quick chat handle"}
                accessibilityValue={hasOverflow ? { min: 0, max: 1, now: expanded ? 1 : 0 } : undefined}
                accessibilityActions={hasOverflow ? [
                  { name: "increment", label: "Expand quick chat" },
                  { name: "decrement", label: "Collapse quick chat" },
                ] : undefined}
                onAccessibilityAction={(event) => {
                  if (event.nativeEvent.actionName === "increment") snapTo(true);
                  if (event.nativeEvent.actionName === "decrement") snapTo(false);
                }}
              >
                <View style={styles.handle} />
              </View>}
              <Text style={[styles.title, desktopPointer && !hasOverflow && styles.desktopTitle]}>Quick Chat</Text>
            </View>
            <ScrollView style={styles.moreScroll} showsVerticalScrollIndicator={false}>
              <View style={[styles.grid, desktopPointer && styles.desktopGrid]}>{(expanded ? ordered : visibleOptions).map(renderOption)}</View>
              {hasOverflow && !expanded && (
                <Text style={styles.moreHintText} onLayout={(event) => setHintHeight(event.nativeEvent.layout.height)}>
                  Pull up for more
                </Text>
              )}
            </ScrollView>
          </BlurPanel>
        </Animated.View>
      </View>
    </Modal>
  );
}

function createStyles(colors: ReturnType<typeof useAppTheme>["colors"]) {
  const bubbleColors = tableChatBubbleColors(colors);
  return StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: "flex-end",
      backgroundColor: "rgba(0,0,0,0.25)",
    },
    sheetWrap: {
      width: "100%",
      alignSelf: "center",
    },
    fill: {
      flex: 1,
    },
    sheet: {
      flex: 1,
      borderTopLeftRadius: 36,
      borderTopRightRadius: 36,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.btnSecondaryBorder,
      paddingHorizontal: SHEET_HORIZONTAL_PADDING,
      paddingBottom: SHEET_BOTTOM_PADDING,
    },
    handleArea: {
      height: HANDLE_AREA_HEIGHT,
      alignItems: "center",
      justifyContent: "center",
    },
    handleAreaWeb: {
      touchAction: "none",
      cursor: "grab",
    } as object,
    handle: {
      width: 44,
      height: 5,
      borderRadius: 3,
      backgroundColor: colors.textMuted,
      opacity: 0.6,
    },
    title: {
      color: colors.btnSecondaryText,
      fontSize: 16,
      fontWeight: "800",
      textAlign: "center",
      marginBottom: 10,
    },
    desktopTitle: {
      marginTop: 16,
    },
    measurement: {
      position: "absolute",
      left: SHEET_HORIZONTAL_PADDING,
      right: SHEET_HORIZONTAL_PADDING,
      top: 0,
      opacity: 0,
    },
    grid: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "space-between",
      gap: 24,
    },
    desktopGrid: {
      width: "100%",
      maxWidth: 640,
      alignSelf: "center",
    },
    moreScroll: {
      flex: 1,
    },
    moreHintText: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: "700",
      textAlign: "center",
      paddingVertical: 10,
    },
    optionBtn: {
      maxWidth: "100%",
      minWidth: 44,
      minHeight: 44,
      alignItems: "center",
      justifyContent: "center",
    },
    optionBubble: {
      minWidth: 44,
      minHeight: 38,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: bubbleColors.border,
      backgroundColor: OPTION_GLASS_COLOR,
      overflow: "hidden",
    },
    optionBubbleWeb: {
      backdropFilter: "blur(18px) saturate(1.35)",
      WebkitBackdropFilter: "blur(18px) saturate(1.35)",
    } as ViewStyle,
    optionHighlight: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(255, 255, 255, 0.28)",
    },
    optionTail: {
      width: 0,
      height: 0,
      alignSelf: "flex-start",
      marginLeft: 16,
      marginTop: -1,
      borderRightWidth: 12,
      borderTopWidth: 7,
      borderRightColor: "transparent",
      borderTopColor: "rgba(135, 145, 140, 0.9)",
    },
    optionText: {
      color: "#f4f7f5",
      fontSize: 14,
      fontWeight: "700",
      textAlign: "center",
    },
  });
}
