import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from "react-native";
import { styles } from "../styles/theme";
import BackButton from "../components/BackButton";
import Header from "../components/Header";
import { NetworkAdapter } from "../game/network";
import NetworkDebugPanel from "../components/NetworkDebugPanel";
import { getOrCreatePlayerId } from "../services/gameCenter";

interface AvailableRoom {
  roomId: string;
  hostName: string;
  roomName?: string;
  playerCount: number;
  maxPlayers: number;
  createdAt: number;
}

export default function FindGame({ 
  onBack, 
  onJoinRoom, 
  adapter,
  onNavigateToAchievements
}: { 
  onBack: () => void; 
  onJoinRoom: (roomId: string, playerName: string) => void; 
  adapter: NetworkAdapter;
  onNavigateToAchievements?: () => void;
}) {
  const [availableRooms, setAvailableRooms] = useState<AvailableRoom[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [playerName, setPlayerName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<"disconnected" | "connecting" | "connected">("disconnected");
  const [lastDiscoveryTime, setLastDiscoveryTime] = useState<number>(0);
  const [discoveryCount, setDiscoveryCount] = useState<number>(0);

  // Initialize player ID from GameCenter
  useEffect(() => {
    let mounted = true;
    
    (async () => {
      console.log("[FindGame] Initializing player authentication...");
      const playerInfo = await getOrCreatePlayerId();
      if (mounted) {
        setPlayerId(playerInfo.id);
        setPlayerName(playerInfo.displayName);
        console.log("[FindGame] Player initialized:", playerInfo);
      }
      
      // If GameCenter authentication is pending, check again after a delay
      if (playerInfo.source === "fallback") {
        setTimeout(async () => {
          console.log("[FindGame] Re-checking player info...");
          const updatedInfo = await getOrCreatePlayerId();
          if (mounted) {
            setPlayerId(updatedInfo.id);
            setPlayerName(updatedInfo.displayName);
            console.log("[FindGame] Player info updated:", updatedInfo);
          }
        }, 2000);
      }
    })();
    
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    let mounted = true;
    console.log("[FindGame] Component mounted, initializing...");

    // Subscribe to network messages
    adapter.on("message", (ev) => {
      if (!mounted) return;
      console.log("[FindGame] Received event:", ev.type, ev);
      
      if (ev.type === "state" && ev.state) {
        if (ev.state.type === "availableRooms") {
          console.log("[FindGame] Available rooms:", ev.state.rooms);
          setAvailableRooms(ev.state.rooms || []);
          setIsSearching(false);
          setLastDiscoveryTime(Date.now());
          setDiscoveryCount(prev => prev + 1);
        } else if (ev.state.type === "error") {
          console.error("[FindGame] Error:", ev.state.message);
          setError(ev.state.message);
          setIsSearching(false);
          setConnectionStatus("disconnected");
        } else if (ev.state.type === "connected") {
          console.log("[FindGame] Connected successfully");
          setConnectionStatus("connected");
        }
      }
    });

    // Connect and start discovering rooms
    (async () => {
      try {
        console.log("[FindGame] Connecting to server...");
        setConnectionStatus("connecting");
        setIsSearching(true);
        await adapter.connect();
        console.log("[FindGame] Connected, requesting room discovery...");
        setConnectionStatus("connected");
        if ((adapter as any).discoverRooms) {
          (adapter as any).discoverRooms();
        } else {
          console.warn("[FindGame] Adapter does not support discoverRooms");
          setError("Adapter does not support room discovery");
          setConnectionStatus("disconnected");
        }
      } catch (e) {
        console.error("FindGame: adapter connect/discover failed", e);
        setError("Failed to connect to server");
        setIsSearching(false);
        setConnectionStatus("disconnected");
      }
    })();

    // Auto-refresh every 3 seconds
    const interval = setInterval(() => {
      console.log("[FindGame] Auto-refresh: requesting room discovery...");
      if ((adapter as any).discoverRooms) {
        (adapter as any).discoverRooms();
      }
    }, 3000);

    return () => {
      console.log("[FindGame] Component unmounting, cleaning up...");
      mounted = false;
      clearInterval(interval);
      try {
        adapter.disconnect();
      } catch (e) {
        // ignore
      }
    };
  }, []);

  const handleJoinRoom = (roomId: string) => {
    if (!playerName.trim()) {
      setError("Please enter your name");
      return;
    }
    setError(null);
    onJoinRoom(roomId, playerName.trim());
  };

  const formatTimeAgo = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return "just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  return (
    <ScrollView contentContainerStyle={[styles.menuContainer, { paddingBottom: 40 }]}>
      <Header title="Find Game" onBack={onBack} />
      {/* Debug Panel */}
      <NetworkDebugPanel 
        debugInfo={[
          {
            title: "Connection Status",
            data: {
              status: connectionStatus,
              playerId: playerId?.substring(0, 20) + "...",
              adapterType: (adapter as any).constructor.name
            }
          },
          {
            title: "Discovery Info",
            data: {
              roomsFound: availableRooms.length,
              isSearching,
              discoveryCount,
              lastDiscovery: lastDiscoveryTime ? new Date(lastDiscoveryTime).toLocaleTimeString() : "Never"
            }
          },
          {
            title: "Available Rooms",
            data: availableRooms.length > 0 
              ? availableRooms.map(r => ({ id: r.roomId, host: r.hostName, players: r.playerCount }))
              : "None"
          },
          {
            title: "Error",
            data: error || "None"
          }
        ]}
      />

      <Text style={styles.title}>Find Game</Text>
      <Text style={styles.subtitle}>Join nearby players</Text>

      {/* Player Name Display */}
      <View style={{ width: "80%", marginTop: 20 }}>
        <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 14, marginBottom: 8 }}>Your Name:</Text>
        <View style={{ 
          borderWidth: 1,
          borderColor: "rgba(212, 175, 55, 0.3)",
          borderRadius: 8,
          paddingVertical: 12, 
          paddingHorizontal: 16,
          backgroundColor: "rgba(0,0,0,0.2)",
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center"
        }}>
          <Text style={{ color: "white", fontSize: 16 }}>{playerName}</Text>
          <TouchableOpacity onPress={onNavigateToAchievements || onBack}>
            <Text style={{ color: "#d4af37", fontSize: 12 }}>Change in Achievements →</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Error Message */}
      {error && (
        <View style={{ 
          width: "80%", 
          marginTop: 12, 
          padding: 12, 
          backgroundColor: "rgba(255,0,0,0.1)",
          borderRadius: 8,
          borderLeftWidth: 3,
          borderLeftColor: "#ff4444"
        }}>
          <Text style={{ color: "#ff6666", fontSize: 13 }}>{error}</Text>
        </View>
      )}

      {/* Search Status */}
      <View style={{ 
        width: "80%", 
        marginTop: 20, 
        flexDirection: "row", 
        alignItems: "center",
        justifyContent: "space-between"
      }}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          {isSearching && <ActivityIndicator size="small" color="#d4af37" style={{ marginRight: 8 }} />}
          <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 14 }}>
            {isSearching ? "Searching..." : `Found ${availableRooms.length} game${availableRooms.length !== 1 ? 's' : ''}`}
          </Text>
        </View>
        <TouchableOpacity 
          onPress={() => {
            if ((adapter as any).discoverRooms) {
              setIsSearching(true);
              (adapter as any).discoverRooms();
            }
          }}
          style={{ padding: 4 }}
        >
          <Text style={{ color: "#d4af37", fontSize: 13 }}>🔄 Refresh</Text>
        </TouchableOpacity>
      </View>

      {/* Available Rooms */}
      <View style={{ width: "80%", marginTop: 16 }}>
        {availableRooms.length === 0 && !isSearching ? (
          <View style={{ 
            padding: 24, 
            backgroundColor: "rgba(0,0,0,0.3)",
            borderRadius: 12,
            alignItems: "center"
          }}>
            <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 15, textAlign: "center" }}>
              No games found nearby
            </Text>
            <Text style={{ color: "rgba(255,255,255,0.3)", fontSize: 13, textAlign: "center", marginTop: 8 }}>
              Create a game and invite others!
            </Text>
          </View>
        ) : (
          availableRooms.map((room) => (
            <View 
              key={room.roomId}
              style={{
                backgroundColor: "rgba(0,0,0,0.4)",
                borderRadius: 12,
                borderWidth: 1,
                borderColor: "rgba(212, 175, 55, 0.2)",
                padding: 16,
                marginBottom: 12,
                shadowColor: "#d4af37",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 4
              }}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: "#d4af37", fontSize: 16, fontWeight: "600", marginBottom: 4 }}>
                    {room.roomName || room.hostName + "'s Game"}
                  </Text>
                  <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, marginBottom: 4 }}>
                    Host: {room.hostName}
                  </Text>
                  <View style={{ flexDirection: "row", alignItems: "center", marginTop: 4 }}>
                    <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 13 }}>
                      👥 {room.playerCount}/{room.maxPlayers} players
                    </Text>
                    <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, marginLeft: 12 }}>
                      {formatTimeAgo(room.createdAt)}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={{
                    backgroundColor: room.playerCount >= room.maxPlayers ? "rgba(100,100,100,0.3)" : "rgba(212, 175, 55, 0.2)",
                    paddingVertical: 8,
                    paddingHorizontal: 16,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: room.playerCount >= room.maxPlayers ? "rgba(150,150,150,0.3)" : "#d4af37",
                    marginLeft: 12
                  }}
                  onPress={() => handleJoinRoom(room.roomId)}
                  disabled={room.playerCount >= room.maxPlayers || !playerName.trim()}
                >
                  <Text style={{ 
                    color: room.playerCount >= room.maxPlayers ? "rgba(255,255,255,0.4)" : "#d4af37", 
                    fontSize: 14,
                    fontWeight: "600"
                  }}>
                    {room.playerCount >= room.maxPlayers ? "Full" : "Join"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </View>

      {/* Back Button */}
      <View style={{ width: "80%", marginTop: 24 }}>
        {/* Use shared BackButton component for consistent look */}
        <BackButton onPress={onBack} />
      </View>
    </ScrollView>
  );
}
