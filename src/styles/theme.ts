import { StyleSheet } from "react-native";
import { TextStyle, ViewStyle } from "react-native";
export const HEADER_OFFSET = 120;
const colors = {
  primary: "#0a0a0a",
  secondary: "#e8e8e8",
  accent: "#7aacd6",
  background: "#000000",
  overlay: "rgba(0,0,0,0.45)",
  buttonBackground: "rgba(255, 255, 255, 0.06)",
  buttonBorder: "rgba(255, 255, 255, 0.10)",
  highlight: "#7aacd6",
  shadow: "rgba(0, 0, 0, 0.9)",
};


const fonts = {
  regular: "System",
  bold: "System-Bold",
  title: "'Inter', 'SF Pro Display', -apple-system, 'Helvetica Neue', sans-serif",
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
    width: '100%',
    height: '100%',
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
    letterSpacing: -0.5,
  },

  subtitle: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 14,
    textAlign: "center",
    letterSpacing: 0.5,
    marginBottom: 18,
  },

  developerLabel: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 14,
    textAlign: "center",
    letterSpacing: 0.5,
  },

  buttonGroup: {
    width: "80%",
    marginTop: 20,
  },

  button: {
    backgroundColor: colors.buttonBackground,
    borderColor: colors.buttonBorder,
    borderWidth: 1,
    borderRadius: 12,
    marginVertical: 6,
    paddingVertical: 14,
    alignItems: "center",
  },

  buttonText: {
    color: colors.secondary,
    fontSize: 15,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },

  muteBtn: {
    backgroundColor: colors.buttonBackground,
    borderColor: colors.buttonBorder,
    borderWidth: 1,
    borderRadius: 12,
    marginVertical: 6,
    paddingVertical: 14,
    alignItems: "center",
  },
  muteIcon: {
    color: colors.secondary,
    fontSize: 15,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },

  // alias names used by App.tsx
  menuContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "transparent",
    paddingHorizontal: 24,
  },

  menuButton: {
    ...StyleSheet.flatten([{
      backgroundColor: colors.buttonBackground,
      borderColor: colors.buttonBorder,
      borderWidth: 1,
      borderRadius: 12,
      marginVertical: 6,
      paddingVertical: 14,
      alignItems: "center",
    }]),
  },

  menuButtonText: {
    ...StyleSheet.flatten([{
      color: colors.secondary,
      fontSize: 15,
      fontWeight: "600",
      textTransform: "uppercase",
      letterSpacing: 1.2,
    }]),
  },

  // Optional decorative accent line
  decoLine: {
    width: "60%",
    height: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
    marginVertical: 16,
  },
  // Header styles (centralized so all screens share consistent layout)
  headerContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
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
    fontWeight: '600',
    fontFamily: fonts.title,
    letterSpacing: -0.3,
  } as TextStyle,
  headerBackButton: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    alignSelf: 'flex-start',
  } as ViewStyle,
});

export { colors, fonts, styles };
