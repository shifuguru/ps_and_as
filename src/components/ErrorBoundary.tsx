import React from "react";
import { View, Text, TouchableOpacity } from "react-native";

interface Props {
  children: React.ReactNode;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#1a2e1a" }}>
          <Text style={{ color: "#ff6b6b", fontSize: 18, fontWeight: "700", marginBottom: 12 }}>Something went wrong</Text>
          <Text style={{ color: "#ccc", fontSize: 14, textAlign: "center", paddingHorizontal: 20, marginBottom: 16 }}>
            {this.state.error?.message || "An unexpected error occurred"}
          </Text>
          {this.props.onReset && (
            <TouchableOpacity
              onPress={() => {
                this.setState({ hasError: false, error: null });
                this.props.onReset?.();
              }}
              style={{ paddingVertical: 10, paddingHorizontal: 24, backgroundColor: "#333", borderRadius: 8 }}
            >
              <Text style={{ color: "#fff", fontSize: 16 }}>Back to Menu</Text>
            </TouchableOpacity>
          )}
        </View>
      );
    }

    return this.props.children;
  }
}
