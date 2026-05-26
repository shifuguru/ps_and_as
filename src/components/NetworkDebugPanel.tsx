import React, { useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from "react-native";
import { colors, styles as themeStyles } from "../styles/theme";

interface DebugInfo {
  title: string;
  data: any;
}

interface NetworkDebugPanelProps {
  debugInfo: DebugInfo[];
}

export default function NetworkDebugPanel({ debugInfo }: NetworkDebugPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!isExpanded) {
    return (
      <TouchableOpacity
        style={styles.collapsedButton}
        onPress={() => setIsExpanded(true)}
      >
        <Text style={styles.collapsedButtonText}>🔍 Debug</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.expandedContainer}>
      <View style={styles.header}>
        <Text style={styles.headerText}>🔍 Network Debug</Text>
        <TouchableOpacity onPress={() => setIsExpanded(false)}>
          <Text style={styles.closeButton}>✕</Text>
        </TouchableOpacity>
      </View>
      
      <ScrollView style={styles.content}>
        {debugInfo.map((info, index) => (
          <View key={index} style={styles.section}>
            <Text style={styles.sectionTitle}>{info.title}</Text>
            <View style={styles.dataContainer}>
              <Text style={styles.dataText}>
                {typeof info.data === "object" 
                  ? JSON.stringify(info.data, null, 2)
                  : String(info.data)}
              </Text>
            </View>
          </View>
        ))}
        
        {debugInfo.length === 0 && (
          <Text style={styles.emptyText}>No debug info available</Text>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  collapsedButton: {
    position: "absolute",
    top: 100,
    right: 16,
    backgroundColor: "rgba(20,20,20,0.9)",
    borderWidth: 1,
    borderColor: "rgba(122,172,214,0.25)",
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    zIndex: 1100,
  },
  collapsedButtonText: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: "600",
  },
  expandedContainer: {
    position: "absolute",
    top: 100,
    right: 16,
    width: 320,
    maxHeight: 500,
    backgroundColor: "rgba(15, 15, 15, 0.98)",
    borderWidth: 1,
    borderColor: "#7aacd6",
    borderRadius: 12,
    zIndex: 100,
    shadowColor: "#7aacd6",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(122, 172, 214, 0.3)",
  },
  headerText: {
    color: "#7aacd6",
    fontSize: 14,
    fontWeight: "600",
  },
  closeButton: {
    color: "#7aacd6",
    fontSize: 18,
    fontWeight: "bold",
    paddingHorizontal: 8,
  },
  content: {
    padding: 12,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    color: "#7aacd6",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 6,
    textTransform: "uppercase",
  },
  dataContainer: {
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    borderRadius: 6,
    padding: 10,
    borderLeftWidth: 3,
    borderLeftColor: "#7aacd6",
  },
  dataText: {
    color: "rgba(255, 255, 255, 0.8)",
    fontSize: 11,
    fontFamily: "monospace",
  },
  emptyText: {
    color: "rgba(255, 255, 255, 0.4)",
    fontSize: 12,
    textAlign: "center",
    marginTop: 20,
  },
});
