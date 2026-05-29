import React, { Component, type ErrorInfo, type ReactNode } from "react";
import CrashLandingPage from "./CrashLandingPage";

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
