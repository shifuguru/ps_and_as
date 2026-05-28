import React, { useMemo } from "react";
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
import BlurPanel from "../components/BlurPanel";
import MenuIcon from "../components/MenuIcon";
import { useLayoutInsets } from "../hooks/useLayoutInsets";
import { useVisualViewportSize } from "../hooks/useVisualViewportSize";
import { gameTitleFaceStyle } from "../utils/gameTitleFont";
import { useAppTheme } from "../context/ThemeContext";

export type MainMenuButton = {
  label: string;
  icon: "plus" | "shuffle" | "person" | "globe" | "multiplayer" | "trophy" | "gear" | "list";
  action: () => void;
};

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
  onPress,
}: {
  label: string;
  icon: MainMenuButton["icon"];
  onPress: () => void;
}) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <TouchableOpacity activeOpacity={0.82} onPress={onPress}>
      <BlurPanel intensity={52} style={styles.glassBtn}>
        <View style={styles.glassBtnRow}>
          <View style={styles.iconColumn}>
            <MenuIcon name={icon} size={MENU_ICON_SIZE} color={colors.gold} />
          </View>
          <Text style={styles.glassBtnText}>{label}</Text>
          <View style={styles.iconColumn} />
        </View>
      </BlurPanel>
    </TouchableOpacity>
  );
}

export default function MainMenu({ buttons, onButtonPress, style }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useLayoutInsets();
  const { width, height } = useVisualViewportSize();
  const contentMaxWidth = Math.min(420, Math.max(300, width - 48));

  return (
    <ScreenContainer ignoreHeaderOffset style={[{ flex: 1 }, style]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top + 16,
            paddingBottom: Math.max(insets.bottom, 16) + 20,
            minHeight: height - insets.top - insets.bottom,
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

          <View style={styles.buttonStack}>
            {buttons.map((btn) => (
              <MenuGlassButton
                key={btn.label}
                label={btn.label}
                icon={btn.icon}
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
    },
    content: {
      width: "100%",
    },
    title: {
      color: colors.onFelt.textPrimary,
      fontSize: 48,
      fontWeight: "700",
      textAlign: "center",
      marginBottom: 6,
      textShadowColor: colors.onFelt.textShadow,
      textShadowOffset: { width: 0, height: 2 },
      textShadowRadius: 10,
    },
    subtitle: {
      color: colors.onFelt.accent,
      fontSize: 15,
      textAlign: "center",
      letterSpacing: 1.4,
      marginBottom: 28,
      fontWeight: "600",
    },
    buttonStack: {
      gap: 10,
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
