import { StyleSheet } from "react-native";
import { TextStyle, ViewStyle } from "react-native";
export const HEADER_OFFSET = 120;
const colors = {
  primary: "#0f0f0f", // deeper noir tone
  secondary: "#f0f0f0", // softer white for better readability
  accent: "#d4af37", // rich gold (Art Deco vibe)
  background: "#000000",
  overlay: "rgba(0,0,0,0.45)",
  buttonBackground: "rgba(20, 20, 20, 0.85)",
  buttonBorder: "rgba(212, 175, 55, 0.25)", // gold tint border
  highlight: "#ffcc00",
  shadow: "rgba(0, 0, 0, 0.9)",
};


const fonts = {
  regular: "System",
  bold: "System-Bold",
  title: "serif", // optional: Art Deco-like serif if available
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: "center",
    alignItems: "center",
  },

  background: {
    flex: 1,
    backgroundColor: colors.background,
  },

  backgroundOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.overlay,
  },

  logo: {
    width: 200,
    height: 200,
    marginBottom: 20,
  },

  title: {
    color: colors.secondary,
    fontFamily: fonts.title,
    fontSize: 34,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 12,
    textShadowColor: "rgba(255, 215, 0, 0.25)", // subtle gold glow
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 8,
  },

  subtitle: {
    color: colors.accent,
    fontSize: 16,
    textAlign: "center",
    letterSpacing: 1.2,
    marginBottom: 18,
  },

  developerLabel: {
    color: colors.accent,
    fontSize: 16,
    textAlign: "center",
    letterSpacing: 1.2,
  },

  buttonGroup: {
    width: "80%",
    marginTop: 20,
  },

  button: {
    backgroundColor: colors.buttonBackground,
    borderColor: colors.buttonBorder,
    borderWidth: 1,
    borderRadius: 10,
    marginVertical: 8,
    paddingVertical: 14,
    alignItems: "center",
    shadowColor: colors.shadow,
    shadowOpacity: 0.9,
    shadowRadius: 6,
    shadowOffset: { width: 3, height: 3 },
  },

  buttonText: {
    color: colors.secondary,
    fontSize: 18,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1.5,
    textShadowColor: "rgba(0,0,0,0.8)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },

  muteBtn: {
    backgroundColor: colors.buttonBackground,
    borderColor: colors.buttonBorder,
    borderWidth: 1,
    borderRadius: 10,
    marginVertical: 8,
    paddingVertical: 14,
    alignItems: "center",
    shadowColor: colors.shadow,
    shadowOpacity: 0.9,
    shadowRadius: 6,
    shadowOffset: { width: 3, height: 3 },
  },
  muteIcon: {
    color: colors.secondary,
    fontSize: 18,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1.5,
    textShadowColor: "rgba(0,0,0,0.8)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },

  // alias names used by App.tsx
  menuContainer: {
    marginTop: HEADER_OFFSET,
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.overlay,
    paddingHorizontal: 24,
  },

  menuButton: {
    ...StyleSheet.flatten([{
      backgroundColor: colors.buttonBackground,
      borderColor: colors.buttonBorder,
      borderWidth: 1,
      borderRadius: 10,
      marginVertical: 8,
      paddingVertical: 14,
      alignItems: "center",
      shadowColor: colors.shadow,
      shadowOpacity: 0.9,
      shadowRadius: 6,
      shadowOffset: { width: 3, height: 3 },
    }]),
  },

  menuButtonText: {
    ...StyleSheet.flatten([{
      color: colors.secondary,
      fontSize: 18,
      fontWeight: "600",
      textTransform: "uppercase",
      letterSpacing: 1.5,
    }]),
  },

  // Optional decorative accent line
  decoLine: {
    width: "60%",
    height: 2,
    backgroundColor: colors.accent,
    opacity: 0.6,
    marginVertical: 16,
  },
  // Header styles (centralized so all screens share consistent layout)
  headerContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 60,
    backgroundColor: "transparent",
    zIndex: 1000,
  } as ViewStyle,
  headerRow: {
    height: 100,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
  } as ViewStyle,
  headerLeft: { width: 88, alignItems: 'flex-start' } as ViewStyle,
  headerCenter: { position: 'absolute', left: 0, right: 0, alignItems: 'center' } as ViewStyle,
  headerRight: { width: 88, alignItems: 'flex-end' } as ViewStyle,
  headerTitle: {
    color: colors.secondary,
    fontSize: 18,
    fontWeight: '700',
    fontFamily: fonts.title,
  } as TextStyle,
  headerBackButton: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    alignSelf: 'flex-start',
  } as ViewStyle,
});

export { colors, fonts, styles };

