import React, { Component, type ErrorInfo, type ReactNode } from "react";
import { Platform } from "react-native";
import CrashLandingPage from "./CrashLandingPage";
import ReadmeFallbackRedirect from "./ReadmeFallbackRedirect";
import { isMissionControlRoute } from "../studio/loadStudioData";

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
  };

  render() {
    if (this.state.hasError) {
      if (Platform.OS === "web" && isMissionControlRoute()) {
        return (
          <CrashLandingPage
            error={this.state.error}
            onRefresh={this.handleRefresh}
          />
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
