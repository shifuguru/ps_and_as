import React, { useMemo } from "react";
import { useClientBuildLabel } from "../hooks/useClientBuildLabel";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  StyleProp,
  ViewStyle,
} from "react-native";
import ScreenContainer from "../components/ScreenContainer";
import AddToHomeScreenBanner from "../components/AddToHomeScreenBanner";
import BlurPanel from "../components/BlurPanel";
import MenuIcon from "../components/MenuIcon";
import { useLayoutInsets } from "../hooks/useLayoutInsets";
import { useVisualViewportSize } from "../hooks/useVisualViewportSize";
import { gameTitleFaceStyle } from "../utils/gameTitleFont";
import { onFeltTextStyle } from "../utils/onFeltTypography";
import { useAppTheme } from "../context/ThemeContext";

export type MainMenuButton = {
  label: string;
  icon: "plus" | "shuffle" | "person" | "globe" | "multiplayer" | "trophy" | "gear" | "list";
  action: () => void;
  badgeCount?: number;
  /** Max value before showing "N+" (default 9). */
  badgeCap?: number;
  badgeA11yLabel?: string;
};

function formatBadgeCount(count: number, cap: number): string {
  if (count > cap) return `${cap}+`;
  return String(count);
}

type Props = {
  buttons: MainMenuButton[];
  onButtonPress: (action: () => void) => void;
  style?: StyleProp<ViewStyle>;
};

const MENU_ICON_SIZE = 20;
const MENU_ICON_SLOT = 24;
const MENU_BTN_HPAD = 18;

function MenuGlassButton({
  label,
  icon,
  badgeCount = 0,
  badgeCap = 9,
  badgeA11yLabel,
  onPress,
}: {
  label: string;
  icon: MainMenuButton["icon"];
  badgeCount?: number;
  badgeCap?: number;
  badgeA11yLabel?: string;
  onPress: () => void;
}) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const showBadge = badgeCount > 0;
  const badgeLabel = formatBadgeCount(badgeCount, badgeCap);

  return (
    <TouchableOpacity activeOpacity={0.82} onPress={onPress}>
      <View style={styles.glassBtnWrap}>
        <BlurPanel intensity={52} style={styles.glassBtn}>
          <View style={styles.glassBtnRow}>
            <View style={styles.iconColumn}>
              <MenuIcon name={icon} size={MENU_ICON_SIZE} color={colors.gold} />
            </View>
            <Text style={styles.glassBtnText}>{label}</Text>
            <View style={styles.iconColumn} />
          </View>
        </BlurPanel>
        {showBadge ? (
          <View
            style={styles.menuBadge}
            accessibilityLabel={badgeA11yLabel ?? `${badgeCount}`}
          >
            <Text style={styles.menuBadgeText}>{badgeLabel}</Text>
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

export default function MainMenu({ buttons, onButtonPress, style }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useLayoutInsets();
  const { width, height } = useVisualViewportSize();
  const contentMaxWidth = Math.min(420, Math.max(300, width - 48));
  const versionLabel = useClientBuildLabel();

  return (
    <ScreenContainer ignoreHeaderOffset style={[{ flex: 1 }, style]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          {
            // Full-viewport composition. Bottom pad only clears the home
            // indicator for the last controls — no extra dead "footer" band.
            minHeight: height,
            paddingTop: insets.top + 16,
            paddingBottom: Math.max(insets.bottom, 12),
          },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.content, { maxWidth: contentMaxWidth }]}>
          <Text style={[styles.title, gameTitleFaceStyle()]}>
            P&apos;s & A&apos;s
          </Text>
          <Text style={styles.subtitle}>Presidents & Assholes</Text>
          <Text style={styles.versionLabel}>{versionLabel}</Text>

          <AddToHomeScreenBanner />

          <View style={styles.buttonStack}>
            {buttons.map((btn) => (
              <MenuGlassButton
                key={btn.label}
                label={btn.label}
                icon={btn.icon}
                badgeCount={btn.badgeCount}
                badgeCap={btn.badgeCap}
                badgeA11yLabel={btn.badgeA11yLabel}
                onPress={() => onButtonPress(btn.action)}
              />
            ))}
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

function createStyles(colors: ReturnType<typeof useAppTheme>["colors"]) {
  return StyleSheet.create({
    scroll: {
      flex: 1,
    },
    scrollContent: {
      flexGrow: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 24,
      overflow: "visible",
    },
    content: {
      width: "100%",
    },
    title: {
      fontSize: 48,
      fontWeight: "700",
      textAlign: "center",
      marginBottom: 6,
      ...onFeltTextStyle(colors.onFelt, "primary"),
    },
    subtitle: {
      fontSize: 15,
      textAlign: "center",
      letterSpacing: 1.4,
      marginBottom: 6,
      fontWeight: "600",
      ...onFeltTextStyle(colors.onFelt, "accent"),
    },
    versionLabel: {
      fontSize: 11,
      textAlign: "center",
      letterSpacing: 0.5,
      marginBottom: 22,
      fontWeight: "500",
      ...onFeltTextStyle(colors.onFelt, "accent"),
    },
    buttonStack: {
      gap: 10,
      overflow: "visible",
    },
    glassBtnWrap: {
      position: "relative",
      overflow: "visible",
    },
    glassBtn: {
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.panelBorder,
      overflow: "hidden",
    },
    glassBtnRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 15,
      paddingHorizontal: MENU_BTN_HPAD,
      minHeight: 50,
    },
    iconColumn: {
      width: MENU_ICON_SLOT,
      alignItems: "center",
      justifyContent: "center",
    },
    menuBadge: {
      position: "absolute",
      top: -6,
      right: 10,
      minWidth: 18,
      height: 18,
      paddingHorizontal: 5,
      borderRadius: 999,
      backgroundColor: colors.gold,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.btnGoldBorder,
      alignItems: "center",
      justifyContent: "center",
      zIndex: 1,
    },
    menuBadgeText: {
      color: colors.textOnGold,
      fontSize: 10,
      fontWeight: "800",
      letterSpacing: 0.1,
      fontVariant: ["tabular-nums"],
    },
    glassBtnText: {
      flex: 1,
      color: colors.textPrimary,
      fontSize: 15,
      fontWeight: "700",
      letterSpacing: 0.3,
      textAlign: "center",
    },
  });
}
