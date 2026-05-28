import React, { Component, type ErrorInfo, type ReactNode } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from "react-native";
import FeltBackground from "./FeltBackground";
import FullscreenBlurScrim from "./FullscreenBlurScrim";
import BlurPanel from "./BlurPanel";
import { useAppTheme } from "../context/ThemeContext";
import { attemptAppRefresh } from "../utils/appRefresh";

type Props = {
  children: ReactNode;
};

type State = {
  hasError: boolean;
  error: Error | null;
};

export default class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[AppErrorBoundary]", error, info.componentStack);
  }

  private handleRefresh = () => {
    this.setState({ hasError: false, error: null });
    attemptAppRefresh();
  };

  render() {
    if (this.state.hasError) {
      return (
        <AppErrorFallback
          error={this.state.error}
          onRefresh={this.handleRefresh}
        />
      );
    }
    return this.props.children;
  }
}

function AppErrorFallback({
  error,
  onRefresh,
}: {
  error: Error | null;
  onRefresh: () => void;
}) {
  const { colors, ui, blur } = useAppTheme();
  const styles = createStyles(colors);

  return (
    <View style={styles.root} accessibilityViewIsModal>
      <FeltBackground fullBleed />
      <FullscreenBlurScrim />
      <View style={styles.foreground}>
        <BlurPanel style={[ui.panel, styles.panel]} {...blur.panel} intensity={58}>
          <Text style={ui.panelEyebrow}>Something went wrong</Text>
          <Text style={styles.title}>We hit a snag</Text>
          <Text style={styles.body}>
            Sorry about that — we're aiming to fix this as soon as we can. Try
            refreshing the app; if the problem persists, come back a little later.
          </Text>
          {__DEV__ && error?.message ? (
            <Text style={styles.devError} selectable>
              {error.message}
            </Text>
          ) : null}
          <TouchableOpacity
            style={[ui.actionPrimary, styles.primaryBtn]}
            onPress={onRefresh}
            activeOpacity={0.88}
            accessibilityRole="button"
            accessibilityLabel="Attempt refresh"
          >
            <Text style={ui.actionPrimaryText}>Attempt refresh</Text>
          </TouchableOpacity>
          <Text style={styles.hint}>
            {Platform.OS === "web"
              ? "This reloads the page and clears the error."
              : "If nothing changes, close the app completely and reopen it."}
          </Text>
        </BlurPanel>
      </View>
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useAppTheme>["colors"]) {
  return StyleSheet.create({
    root: {
      flex: 1,
      position: "relative",
    },
    foreground: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: "center",
      paddingHorizontal: 24,
      zIndex: 1,
    },
    panel: {
      width: "100%",
      maxWidth: 400,
      alignSelf: "center",
    },
    title: {
      color: colors.textPrimary,
      fontSize: 22,
      fontWeight: "800",
      marginBottom: 10,
    },
    body: {
      color: colors.textSecondary,
      fontSize: 15,
      lineHeight: 22,
      marginBottom: 14,
    },
    devError: {
      color: colors.textMuted,
      fontSize: 11,
      lineHeight: 16,
      fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
      marginBottom: 14,
    },
    primaryBtn: {
      width: "100%",
    },
    hint: {
      color: colors.textMuted,
      fontSize: 11,
      lineHeight: 16,
      marginTop: 12,
      textAlign: "center",
    },
  });
}
