import React, { useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from "react-native";

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
    backgroundColor: "rgba(212, 175, 55, 0.3)",
    borderWidth: 1,
    borderColor: "#d4af37",
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    zIndex: 100,
  },
  collapsedButtonText: {
    color: "#d4af37",
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
    borderColor: "#d4af37",
    borderRadius: 12,
    zIndex: 100,
    shadowColor: "#d4af37",
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
    borderBottomColor: "rgba(212, 175, 55, 0.3)",
  },
  headerText: {
    color: "#d4af37",
    fontSize: 14,
    fontWeight: "600",
  },
  closeButton: {
    color: "#d4af37",
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
    color: "#d4af37",
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
    borderLeftColor: "#d4af37",
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
