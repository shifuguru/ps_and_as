import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  useWindowDimensions,
  StyleProp,
  ViewStyle,
} from "react-native";
import ScreenContainer from "../components/ScreenContainer";
import BlurPanel from "../components/BlurPanel";
import MenuIcon from "../components/MenuIcon";
import { useLayoutInsets } from "../hooks/useLayoutInsets";

import { GOLD } from "../styles/uiStandards";

export type MainMenuButton = {
  label: string;
  icon: "plus" | "shuffle" | "person" | "globe" | "trophy" | "gear";
  action: () => void;
};

type Props = {
  buttons: MainMenuButton[];
  onButtonPress: (action: () => void) => void;
  style?: StyleProp<ViewStyle>;
};

function MenuGlassButton({
  label,
  icon,
  onPress,
}: {
  label: string;
  icon: MainMenuButton["icon"];
  onPress: () => void;
}) {
  return (
    <TouchableOpacity activeOpacity={0.82} onPress={onPress}>
      <BlurPanel intensity={52} style={styles.glassBtn}>
        <View style={styles.glassBtnRow}>
          <View style={styles.iconWrap}>
            <MenuIcon name={icon} size={20} color={GOLD} />
          </View>
          <Text style={styles.glassBtnText}>{label}</Text>
        </View>
      </BlurPanel>
    </TouchableOpacity>
  );
}

export default function MainMenu({ buttons, onButtonPress, style }: Props) {
  const insets = useLayoutInsets();
  const { width, height } = useWindowDimensions();
  const contentMaxWidth = Math.min(420, Math.max(300, width - 48));
  const titleFont =
    Platform.OS === "ios"
      ? "Snell Roundhand"
      : "'Georgia', 'Palatino Linotype', 'Book Antiqua', serif";

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
          <Text
            style={[
              styles.title,
              { fontFamily: titleFont, fontStyle: "italic" },
            ]}
          >
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

const styles = StyleSheet.create({
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
    color: "#ffffff",
    fontSize: 48,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 6,
    textShadowColor: "rgba(212, 175, 55, 0.28)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
  },
  subtitle: {
    color: GOLD,
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
    borderColor: "rgba(255,255,255,0.14)",
    overflow: "hidden",
  },
  glassBtnRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 15,
    paddingHorizontal: 18,
  },
  iconWrap: {
    width: 24,
    alignItems: "center",
    marginRight: 12,
  },
  glassBtnText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
});
