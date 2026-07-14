import React, { Component, type ErrorInfo, type ReactNode } from "react";
import { Platform, ScrollView, StyleSheet, Text, View, TouchableOpacity } from "react-native";
import CrashLandingPage from "./CrashLandingPage";
import ReadmeFallbackRedirect from "./ReadmeFallbackRedirect";
import { logRenderCrash, type RenderCrashReport } from "../utils/renderCrashDiagnostics";

type Props = {
  children: ReactNode;
};

type State = {
  hasError: boolean;
  error: Error | null;
  report: RenderCrashReport | null;
};

const isDev = typeof __DEV__ !== "undefined" && __DEV__;

export default class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null, report: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    const report = logRenderCrash(error, info);
    console.error("[AppErrorBoundary]", error, info.componentStack);
    console.error("[AppErrorBoundary] message:", error?.message);
    console.error("[AppErrorBoundary] name:", error?.name);
    console.error("[AppErrorBoundary] stack:", error?.stack);
    console.error("[AppErrorBoundary] componentStack:", info.componentStack);
    if (isDev) {
      console.error("[AppErrorBoundary][__DEV__] FULL REPORT\n", report.formatted);
    }
    if (typeof globalThis !== "undefined") {
      (globalThis as { __LAST_APP_CRASH?: unknown }).__LAST_APP_CRASH = {
        message: error?.message,
        name: error?.name,
        stack: error?.stack,
        componentStack: info.componentStack,
        originComponent: report.originComponent,
        location: report.location,
        formatted: report.formatted,
        phaseTrace:
          (globalThis as { __ROUND_END_PHASE_TRACE?: unknown })
            .__ROUND_END_PHASE_TRACE ?? null,
      };
    }
    this.setState({ report });
  }

  private handleRefresh = () => {
    this.setState({ hasError: false, error: null, report: null });
  };

  render() {
    if (this.state.hasError) {
      // __DEV__: keep stacks on-screen — do not hide behind README redirect.
      if (isDev) {
        const { error, report } = this.state;
        return (
          <View style={styles.devRoot}>
            <Text style={styles.devTitle}>Round-end crash (__DEV__)</Text>
            <Text style={styles.devMeta}>
              {error?.name ?? "Error"}: {error?.message ?? "(no message)"}
            </Text>
            {report?.originComponent ? (
              <Text style={styles.devMeta}>
                Offending component: {report.originComponent}
              </Text>
            ) : null}
            {report?.location?.file ? (
              <Text style={styles.devMeta}>
                File: {report.location.file}
                {report.location.line != null ? `:${report.location.line}` : ""}
                {report.location.column != null
                  ? `:${report.location.column}`
                  : ""}
              </Text>
            ) : null}
            <ScrollView style={styles.devScroll}>
              <Text style={styles.devSection}>JS stack</Text>
              <Text style={styles.devMono}>{error?.stack ?? "(none)"}</Text>
              <Text style={styles.devSection}>React component stack</Text>
              <Text style={styles.devMono}>
                {report?.componentStack?.trim() || "(none)"}
              </Text>
              <Text style={styles.devSection}>Formatted</Text>
              <Text style={styles.devMono}>{report?.formatted ?? "(none)"}</Text>
            </ScrollView>
            <TouchableOpacity
              style={styles.devBtn}
              onPress={this.handleRefresh}
              accessibilityRole="button"
              accessibilityLabel="Dismiss crash and retry"
            >
              <Text style={styles.devBtnText}>Retry</Text>
            </TouchableOpacity>
          </View>
        );
      }

      if (Platform.OS === "web") {
        return <ReadmeFallbackRedirect />;
      }
      return (
        <CrashLandingPage
          error={this.state.error}
          onRefresh={this.handleRefresh}
        />
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  devRoot: {
    flex: 1,
    backgroundColor: "#1a0a0a",
    padding: 16,
    paddingTop: 48,
  },
  devTitle: {
    color: "#ff8a80",
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 8,
  },
  devMeta: {
    color: "#ffebee",
    fontSize: 13,
    marginBottom: 4,
  },
  devScroll: {
    flex: 1,
    marginTop: 12,
    marginBottom: 12,
  },
  devSection: {
    color: "#ffab91",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 12,
    marginBottom: 4,
  },
  devMono: {
    color: "#ffcdd2",
    fontSize: 11,
    fontFamily: Platform.OS === "web" ? "ui-monospace, monospace" : "monospace",
  },
  devBtn: {
    alignSelf: "flex-start",
    backgroundColor: "#c62828",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  devBtnText: {
    color: "#fff",
    fontWeight: "700",
  },
});
