import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, TextInput, ScrollView, Alert, ActivityIndicator, StyleSheet } from "react-native";
import { styles } from "../styles/theme";
import { 
  authenticatePlayer, 
  isPlayerAuthenticated, 
  getOrCreatePlayerId,
  getCachedPlayerName,
  cachePlayerName,
  PlayerInfo 
} from "../services/gameCenter";

export default function Achievements({ onBack }: { onBack: () => void }) {
  const [playerInfo, setPlayerInfo] = useState<PlayerInfo | null>(null);
  const [playerName, setPlayerName] = useState<string>("");
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Load player info on mount
  useEffect(() => {
    loadPlayerInfo();
  }, []);

  const loadPlayerInfo = async () => {
    setIsLoading(true);
    try {
      const info = await getOrCreatePlayerId();
      setPlayerInfo(info);
      setPlayerName(info.displayName);
      console.log("[Achievements] Loaded player info:", info);
    } catch (error) {
      console.error("[Achievements] Failed to load player info:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async () => {
    setIsAuthenticating(true);
    try {
      console.log("[Achievements] Attempting GameCenter login...");
      const info = await authenticatePlayer();
      
      if (info.source === "gamecenter") {
        setPlayerInfo(info);
        setPlayerName(info.displayName);
        await cachePlayerName(info.displayName);
        Alert.alert(
          "Login Successful",
          `Welcome, ${info.displayName}!`,
          [{ text: "OK" }]
        );
      } else {
        Alert.alert(
          "Login Failed",
          "GameCenter is not available. You can still set your name manually.",
          [{ text: "OK" }]
        );
      }
    } catch (error) {
      console.error("[Achievements] Login error:", error);
      Alert.alert(
        "Login Error",
        "Could not connect to GameCenter. Please check your settings.",
        [{ text: "OK" }]
      );
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      "Logout",
      "Are you sure you want to log out? Your local name will be preserved.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Logout",
          style: "destructive",
          onPress: async () => {
            // Reset to fallback info
            const info = await getOrCreatePlayerId();
            setPlayerInfo({ ...info, source: "fallback", isAuthenticated: false });
            Alert.alert("Logged Out", "You can still play with your local name.", [{ text: "OK" }]);
          }
        }
      ]
    );
  };

  const handleSaveName = async () => {
    if (!playerName.trim()) {
      Alert.alert("Invalid Name", "Please enter a valid name.", [{ text: "OK" }]);
      return;
    }

    try {
      await cachePlayerName(playerName.trim());
      if (playerInfo) {
        setPlayerInfo({ ...playerInfo, displayName: playerName.trim() });
      }
      Alert.alert("Name Saved", `Your name has been set to: ${playerName.trim()}`, [{ text: "OK" }]);
    } catch (error) {
      console.error("[Achievements] Failed to save name:", error);
      Alert.alert("Error", "Failed to save name. Please try again.", [{ text: "OK" }]);
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color="#d4af37" />
        <Text style={{ color: "#fff", marginTop: 16, fontSize: 16 }}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20 }}>
        {/* Header */}
        <View style={local.header}>
          <TouchableOpacity onPress={onBack} style={local.backButton}>
            <Text style={local.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <Text style={local.title}>Achievements</Text>
        </View>

        {/* Player Profile Section */}
        <View style={local.section}>
          <Text style={local.sectionTitle}>Player Profile</Text>
          
          {/* Player Name Input */}
          <View style={local.inputContainer}>
            <Text style={local.label}>Display Name</Text>
            <TextInput
              style={local.input}
              value={playerName}
              onChangeText={setPlayerName}
              placeholder="Enter your name"
              placeholderTextColor="rgba(255,255,255,0.3)"
              maxLength={20}
            />
            <TouchableOpacity 
              style={local.saveButton}
              onPress={handleSaveName}
            >
              <Text style={local.saveButtonText}>Save Name</Text>
            </TouchableOpacity>
          </View>

          {/* Authentication Status */}
          <View style={local.statusContainer}>
            <View style={local.statusRow}>
              <Text style={local.statusLabel}>Status:</Text>
              <View style={[
                local.statusBadge, 
                playerInfo?.isAuthenticated ? local.statusAuthenticated : local.statusGuest
              ]}>
                <Text style={local.statusBadgeText}>
                  {playerInfo?.isAuthenticated ? "🎮 Authenticated" : "👤 Guest"}
                </Text>
              </View>
            </View>

            <View style={local.statusRow}>
              <Text style={local.statusLabel}>Source:</Text>
              <Text style={local.statusValue}>
                {playerInfo?.source === "gamecenter" ? "GameCenter" : "Local Device"}
              </Text>
            </View>

            <View style={local.statusRow}>
              <Text style={local.statusLabel}>Player ID:</Text>
              <Text style={[local.statusValue, { fontSize: 11, opacity: 0.6 }]}>
                {playerInfo?.id.substring(0, 24)}...
              </Text>
            </View>
          </View>

          {/* Login/Logout Button */}
          {playerInfo?.isAuthenticated ? (
            <TouchableOpacity 
              style={local.logoutButton}
              onPress={handleLogout}
            >
              <Text style={local.logoutButtonText}>Logout from GameCenter</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity 
              style={local.loginButton}
              onPress={handleLogin}
              disabled={isAuthenticating}
            >
              {isAuthenticating ? (
                <ActivityIndicator size="small" color="#000" />
              ) : (
                <Text style={local.loginButtonText}>Login with GameCenter</Text>
              )}
            </TouchableOpacity>
          )}

          <Text style={local.helpText}>
            {playerInfo?.isAuthenticated 
              ? "Your name is synced with GameCenter. Changes here won't affect your GameCenter profile."
              : "Login with GameCenter to sync your profile across devices. Or play as a guest with a local name."
            }
          </Text>
        </View>

        {/* Achievements Section (Placeholder) */}
        <View style={local.section}>
          <Text style={local.sectionTitle}>🏆 Your Achievements</Text>
          <View style={local.achievementPlaceholder}>
            <Text style={local.achievementPlaceholderText}>
              No achievements yet!
            </Text>
            <Text style={local.achievementPlaceholderSubtext}>
              Play games to unlock achievements
            </Text>
          </View>
        </View>

        {/* Stats Section (Placeholder) */}
        <View style={local.section}>
          <Text style={local.sectionTitle}>📊 Statistics</Text>
          <View style={local.statsGrid}>
            <View style={local.statCard}>
              <Text style={local.statValue}>0</Text>
              <Text style={local.statLabel}>Games Played</Text>
            </View>
            <View style={local.statCard}>
              <Text style={local.statValue}>0</Text>
              <Text style={local.statLabel}>Games Won</Text>
            </View>
            <View style={local.statCard}>
              <Text style={local.statValue}>0%</Text>
              <Text style={local.statLabel}>Win Rate</Text>
            </View>
            <View style={local.statCard}>
              <Text style={local.statValue}>0</Text>
              <Text style={local.statLabel}>Achievements</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const local = StyleSheet.create({
  header: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    marginBottom: 24,
    paddingTop: 8,
  },
  backButton: {
    padding: 8,
    marginRight: 12,
  },
  backButtonText: {
    color: "#d4af37",
    fontSize: 16,
    fontWeight: "600" as const,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold" as const,
    color: "#d4af37",
    flex: 1,
  },
  section: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(212,175,55,0.2)",
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold" as const,
    color: "#d4af37",
    marginBottom: 16,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 14,
    marginBottom: 8,
    fontWeight: "600" as const,
  },
  input: {
    backgroundColor: "rgba(0,0,0,0.3)",
    borderWidth: 1,
    borderColor: "rgba(212,175,55,0.3)",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: "#fff",
    marginBottom: 12,
  },
  saveButton: {
    backgroundColor: "#d4af37",
    borderRadius: 8,
    padding: 12,
    alignItems: "center" as const,
  },
  saveButtonText: {
    color: "#000",
    fontSize: 16,
    fontWeight: "bold" as const,
  },
  statusContainer: {
    backgroundColor: "rgba(0,0,0,0.3)",
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  statusRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    marginBottom: 12,
  },
  statusLabel: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 14,
    width: 80,
  },
  statusValue: {
    color: "#fff",
    fontSize: 14,
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    flex: 1,
  },
  statusAuthenticated: {
    backgroundColor: "rgba(76,175,80,0.2)",
    borderWidth: 1,
    borderColor: "rgba(76,175,80,0.5)",
  },
  statusGuest: {
    backgroundColor: "rgba(158,158,158,0.2)",
    borderWidth: 1,
    borderColor: "rgba(158,158,158,0.5)",
  },
  statusBadgeText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600" as const,
    textAlign: "center" as const,
  },
  loginButton: {
    backgroundColor: "#d4af37",
    borderRadius: 8,
    padding: 14,
    alignItems: "center" as const,
    marginBottom: 12,
  },
  loginButtonText: {
    color: "#000",
    fontSize: 16,
    fontWeight: "bold" as const,
  },
  logoutButton: {
    backgroundColor: "rgba(244,67,54,0.2)",
    borderWidth: 1,
    borderColor: "rgba(244,67,54,0.5)",
    borderRadius: 8,
    padding: 14,
    alignItems: "center" as const,
    marginBottom: 12,
  },
  logoutButtonText: {
    color: "#ff5252",
    fontSize: 16,
    fontWeight: "bold" as const,
  },
  helpText: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center" as const,
  },
  achievementPlaceholder: {
    padding: 40,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  achievementPlaceholderText: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 16,
    marginBottom: 8,
  },
  achievementPlaceholderSubtext: {
    color: "rgba(255,255,255,0.3)",
    fontSize: 14,
  },
  statsGrid: {
    flexDirection: "row" as const,
    flexWrap: "wrap" as const,
    gap: 12,
  },
  statCard: {
    backgroundColor: "rgba(0,0,0,0.3)",
    borderRadius: 8,
    padding: 16,
    width: "47%",
    alignItems: "center",
  },
  statValue: {
    color: "#d4af37",
    fontSize: 28,
    fontWeight: "bold" as const,
    marginBottom: 4,
  },
  statLabel: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 12,
    textAlign: "center",
  },
});
