import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, TextInput, FlatList, ScrollView, Alert } from "react-native";
import { styles } from "../styles/theme";
import { NetworkAdapter, MockAdapter } from "../game/network";
import NetworkDebugPanel from "../components/NetworkDebugPanel";
import { getOrCreatePlayerId } from "../services/gameCenter";


export default function CreateGame({ 
  onBack, 
  onStart, 
  adapter, 
  isJoining = false,
  onNavigateToAchievements,
  joinRoomId
}: { 
  onBack: () => void; 
  onStart: (names: string[], localPlayerName: string, localPlayerId?: string) => void; 
  adapter?: NetworkAdapter;
  isJoining?: boolean;
  onNavigateToAchievements?: () => void;
  joinRoomId?: string;
}) {
  const [names, setNames] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const net = adapter ?? new MockAdapter();
  const [localId, setLocalId] = useState<string | null>(null);
  const [localReady, setLocalReady] = useState(false);
  const [hostId, setHostId] = useState<string | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [playerName, setPlayerName] = useState<string>("Player");
  const [connectionStatus, setConnectionStatus] = useState<"disconnected" | "connecting" | "connected">("disconnected");
  const [roomCreated, setRoomCreated] = useState(false);
  const [roomName, setRoomName] = useState<string>("My Game");
  const [actualRoomId, setActualRoomId] = useState<string>("demo");
  const [playerNameReady, setPlayerNameReady] = useState(false);

  // Initialize player ID from GameCenter
  useEffect(() => {
    let mounted = true;
    
    (async () => {
      console.log("[CreateGame] Initializing player authentication...");
      const playerInfo = await getOrCreatePlayerId();
      if (mounted) {
        setPlayerId(playerInfo.id);
        setPlayerName(playerInfo.displayName);
        setPlayerNameReady(true); // Mark as ready
        console.log("[CreateGame] Player initialized:", playerInfo);
      }
      
      // If GameCenter authentication is pending, check again after a delay
      if (playerInfo.source === "fallback") {
        setTimeout(async () => {
          console.log("[CreateGame] Re-checking player info...");
          const updatedInfo = await getOrCreatePlayerId();
          if (mounted) {
            setPlayerId(updatedInfo.id);
            setPlayerName(updatedInfo.displayName);
            console.log("[CreateGame] Player info updated:", updatedInfo);
          }
        }, 2000);
      }
    })();
    
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    let mounted = true;
    const log = (...args: any[]) => console.log('[CreateGame]', 'playerId=' + (playerId ?? '??'), 'localId=' + (localId ?? '??'), ...args);
    log("Component mounted with adapter:", adapter ? "provided" : "none");

    // subscribe to network messages
    net.on("message", (ev) => {
      if (!mounted) return;
  log("Received event:", ev.type, ev);
      
      // support state messages from adapters
      if (ev.type === "state" && ev.state && ev.state.type === "lobby") {
  log("Lobby update:", ev.state);
        setNames(ev.state.players.map((p: any) => p.name));
        setHostId(ev.state.host ?? null);
        setConnectionStatus("connected");
        // if localId known, update our ready state
        if (localId) {
          const me = (ev.state.players || []).find((p: any) => p.id === localId);
          setLocalReady(!!(me && me.ready));
        }
      }
  if (ev.type === "state" && ev.state && ev.state.type === "startGame") {
  log("Game starting with players:", ev.state.players);
  log("Calling onStart callback with localPlayerName:", playerName, "playerId:", playerId);
    onStart(ev.state.players, playerName, playerId ?? undefined);
      }
      if (ev.type === "state" && ev.state && ev.state.type === "connected") {
  log("Connected with id:", ev.state.id, "name:", ev.state.name);
        // connected gives us our assigned id. Only treat this as *our* id when the
        // name matches our selected playerName (prevents mock join events overwriting localId)
        if (ev.state.name === playerName) {
          setLocalId(ev.state.id);
          setConnectionStatus("connected");
        } else {
          // If this is a MockAdapter-created CPU, auto-mark them ready so local games
          // don't get stuck waiting for host. We detect MockAdapter by checking the
          // net object's constructor name (safe for dev/mock scenarios).
          try {
            if ((net as any)?.constructor?.name === "MockAdapter" && typeof ev.state.name === "string" && ev.state.name.startsWith("CPU ")) {
              console.log(`[CreateGame] Auto-readying CPU player ${ev.state.name} (${ev.state.id})`);
              // actualRoomId should have been set when the room was created in demo mode
              if (actualRoomId) {
                (net as any).toggleReady(actualRoomId, ev.state.id, true);
              }
            }
          } catch (e) {
            // ignore
          }
        }
      }
      if (ev.type === "state" && ev.state && ev.state.type === "kicked") {
        console.warn("[CreateGame] Kicked from room:", ev.state.message);
        Alert.alert(
          "Removed from Game",
          ev.state.message || "You have been removed from the game",
          [{ text: "OK", onPress: () => onBack() }]
        );
      }
    });

    return () => {
          log("Component unmounting, disconnecting...");
      mounted = false;
      try {
        if (adapter) adapter.disconnect();
      } catch (e) {
        // ignore
      }
    };
  }, []);

  // Separate effect to create/join room once playerName is ready
  useEffect(() => {
    if (!playerNameReady) {
      console.log("[CreateGame] Waiting for player name to be ready...");
      return;
    }

    let mounted = true;

    (async () => {
          try {
            if (adapter) {
              console.log("[CreateGame] Connecting real adapter... isJoining:", isJoining, "playerName:", playerName, "playerId:", playerId);
              setConnectionStatus("connecting");
              await adapter.connect();
              
              // Only create room if we're NOT joining an existing one
              if (!isJoining) {
                // Now we know playerName is loaded
                if ((adapter as any).createRoom) {
                  const hostName = playerName;
                  // generate a unique room id to avoid collisions when multiple devices use the same room name
                  const rid = `${roomName.trim().replace(/\s+/g, '_')}-${Date.now()}`;
                  console.log("[CreateGame] Creating new room '", roomName, "' with host:", hostName, "roomId:", rid);
                  (adapter as any).createRoom(rid, hostName);
                  setActualRoomId(rid);
                  setRoomCreated(true);
                }
              } else {
                console.log("[CreateGame] Joining existing room via auto-join", "joinRoomId=", joinRoomId);
                if (joinRoomId) {
                  setActualRoomId(joinRoomId);
                }
                setRoomCreated(true);
              }
            } else {
          console.log("[CreateGame] Using MockAdapter for demo");
            setConnectionStatus("connecting");
            // for demo (no adapter) populate with simulated players (default 3 players)
            const m = net as MockAdapter;
            // create a unique mock room id so multiple devices running the app don't collide
            const rid = `${roomName.trim().replace(/\s+/g, '_')}-${Date.now()}`;
            const hostName = playerName || "You (Host)";
            m.createRoom(rid, hostName);
            // record the room id so later CPU joins use the same id
            setActualRoomId(rid);
            // Add two default opponents (CPU 1 and CPU 2) to make default player count 3
            m.joinRoom(rid, "CPU 1");
            m.joinRoom(rid, "CPU 2");
            // Immediately update local UI names so the host is included and Start enables
            setNames([hostName, "CPU 1", "CPU 2"]);
            setLocalReady(true);
            setRoomCreated(true);
            setConnectionStatus("connected");
        }
      } catch (e) {
        console.error("[CreateGame] adapter connect/createRoom failed", e);
        setConnectionStatus("disconnected");
      }
    })();

    return () => {
      mounted = false;
    };
  }, [playerNameReady]); // Only run when playerName becomes ready

  return (
    <ScrollView contentContainerStyle={[styles.menuContainer, { paddingBottom: 40 }]}>
      {/* Debug Panel */}
      <NetworkDebugPanel 
        debugInfo={[
          {
            title: "Connection Status",
            data: {
              status: connectionStatus,
              playerId: playerId?.substring(0, 20) + "...",
              localId: localId?.substring(0, 20) + "...",
              hostId: hostId?.substring(0, 20) + "...",
              isHost: localId === hostId,
              adapterType: (net as any).constructor.name,
              roomCreated
            }
          },
          {
            title: "Lobby Info",
            data: {
              playerCount: names.length,
              players: names,
              localReady
            }
          }
        ]}
      />

      <Text style={styles.title}>Create Game</Text>
      <Text style={styles.subtitle}>Add player names (2-8 players)</Text>

      {/* Player Name Display */}
      <View style={{ width: "80%", marginTop: 12 }}>
        <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 14, marginBottom: 8 }}>Your Name:</Text>
        <View style={{ 
          borderWidth: 1,
          borderColor: "rgba(212, 175, 55, 0.3)",
          borderRadius: 8,
          paddingVertical: 12, 
          paddingHorizontal: 16,
          backgroundColor: "rgba(0,0,0,0.2)",
          marginBottom: 8,
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

      {/* Room Name Input */}
      <View style={{ width: "80%", marginTop: 0 }}>
        <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 14, marginBottom: 8 }}>Room Name:</Text>
        <TextInput
          placeholder="Enter room name"
          placeholderTextColor="rgba(255,255,255,0.5)"
          value={roomName}
          onChangeText={setRoomName}
          style={{ 
            color: "white", 
            borderWidth: 1,
            borderColor: "rgba(212, 175, 55, 0.3)",
            borderRadius: 8,
            paddingVertical: 12, 
            paddingHorizontal: 16,
            backgroundColor: "rgba(0,0,0,0.3)",
            marginBottom: 12
          }}
        />
      </View>

      <View style={{ width: "80%", marginTop: 12 }}>
        {names.map((item, index) => {
          const isLocalPlayer = index === 0 && localId === hostId; // First player if you're the host
          const isCPU = item.startsWith("CPU ");
          const canRemove = (localId === hostId && !isLocalPlayer) || isCPU; // Host can remove others + anyone can remove CPU
          
          return (
            <View key={item + index} style={{ flexDirection: "row", width: "100%", justifyContent: "space-between", alignItems: "center", marginVertical: 6 }}>
              <Text style={{ color: isCPU ? "rgba(255,255,255,0.6)" : "white" }}>
                {index + 1}. {item}
                {isCPU && " 🤖"}
              </Text>
              {canRemove && (
                <TouchableOpacity 
                  onPress={() => {
                    if (isCPU) {
                      // Remove CPU locally
                      setNames((s) => s.filter((_, i) => i !== index));
                    } else if (adapter && (adapter as any).kickPlayer) {
                      // Emit kick event to server for real players
                      console.log("[CreateGame] Kicking player:", item);
                      (adapter as any).kickPlayer(roomName, item);
                    } else {
                      // For mock adapter, just remove locally
                      setNames((s) => s.filter((_, i) => i !== index));
                    }
                  }}
                >
                  <Text style={{ color: "#d4af37" }}>Remove</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}
      </View>

      {/* Add/Remove CPU Players */}
      <View style={{ width: "80%", marginTop: 16, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 14 }}>CPU Players:</Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <TouchableOpacity 
            style={[styles.menuButton, { paddingVertical: 8, paddingHorizontal: 16, backgroundColor: "rgba(212, 175, 55, 0.2)" }]}
            onPress={() => {
              const cpuCount = names.filter(n => n.startsWith("CPU ")).length;
              if (names.length < 8) {
                const cpuName = `CPU ${cpuCount + 1}`;
                setNames((s) => [...s, cpuName]);
                console.log("[CreateGame] Added CPU player:", cpuName);
                // If using MockAdapter (local/demo), also register the CPU with the mock room
                try {
                  if ((net as any)?.constructor?.name === "MockAdapter") {
                    const m = net as MockAdapter;
                    const rid = actualRoomId || roomName;
                    // ensure we have a room id
                    setActualRoomId(rid);
                    m.joinRoom(rid, cpuName);
                    // MockAdapter will emit a connected event for the CPU; our handler will auto-ready them
                  }
                } catch (e) {
                  console.warn('[CreateGame] Failed to add CPU to MockAdapter room', e);
                }
              }
            }}
            disabled={names.length >= 8}
          >
            <Text style={[styles.menuButtonText, { opacity: names.length >= 8 ? 0.5 : 1 }]}>+</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.menuButton, { paddingVertical: 8, paddingHorizontal: 16, backgroundColor: "rgba(212, 175, 55, 0.1)" }]}
            onPress={() => {
              const lastCPUIndex = names.map((n, i) => ({ n, i })).reverse().find(({ n }) => n.startsWith("CPU "))?.i;
              if (lastCPUIndex !== undefined) {
                setNames((s) => s.filter((_, i) => i !== lastCPUIndex));
                console.log("[CreateGame] Removed last CPU player");
              }
            }}
            disabled={names.filter(n => n.startsWith("CPU ")).length === 0}
          >
            <Text style={[styles.menuButtonText, { opacity: names.filter(n => n.startsWith("CPU ")).length === 0 ? 0.5 : 1 }]}>−</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={{ flexDirection: "row", width: "80%", marginTop: 12 }}>
        <TextInput
          placeholder="Player name"
          placeholderTextColor="rgba(255,255,255,0.5)"
          value={input}
          onChangeText={setInput}
          style={{ flex: 1, color: "white", borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.08)", marginRight: 8, paddingVertical: 8 }}
        />
        <TouchableOpacity style={[styles.menuButton, { paddingVertical: 8, paddingHorizontal: 16 }]} onPress={() => { if (input.trim()) { setNames((s) => [...s, input.trim()]); setInput(""); } }}>
          <Text style={styles.menuButtonText}>Add</Text>
        </TouchableOpacity>
      </View>

      <View style={{ width: "80%", marginTop: 18 }}>
        <TouchableOpacity
          // compute disabled state for styling
            onPress={() => {
            console.log("[CreateGame] Start Game button pressed");
            const usingMock = (adapter == null) || ((net as any)?.constructor?.name === "MockAdapter");
            if (usingMock) {
              // Offline/local flow: start immediately
              console.log("[CreateGame] Starting offline/local game");
              onStart(names, playerName, playerId ?? undefined);
              return;
            }

            // Online flow: behave as before (only host can call start on server)
            console.log("[CreateGame] Adapter check:", {
              hasAdapter: !!adapter,
              hasStartGame: !!(net as any).startGame,
              isHost: localId === hostId,
              localId,
              hostId,
              namesLength: names.length
            });
            if ((net as any).startGame) {
              if (hostId && localId === hostId) {
                console.log("[CreateGame] Calling adapter.startGame with roomId:", actualRoomId);
                (net as any).startGame(actualRoomId);
              } else {
                console.log("[CreateGame] Not host, cannot start");
              }
              } else {
                console.log("[CreateGame] No startGame method, calling onStart directly with playerName:", playerName, "playerId:", playerId);
              onStart(names, playerName, playerId ?? undefined);
            }
          }}
          disabled={names.length < 2 || (!(adapter == null) && localId !== hostId)}
          style={[styles.menuButton, (names.length < 2 || (!(adapter == null) && localId !== hostId)) ? { opacity: 0.45 } : null]}
        >
          <Text style={[styles.menuButtonText, (names.length < 2 || (!(adapter == null) && localId !== hostId)) ? { opacity: 0.7 } : null]}>{
            // Label logic: offline (mock) shows START GAME; online shows host/waiting labels
            ( (adapter == null) || ((net as any)?.constructor?.name === "MockAdapter") )
              ? "START GAME"
              : (names.length >= 2 ? (localId && hostId && localId === hostId ? "Start Game" : "Waiting for host...") : "Waiting for players...")
          }</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.menuButton, { marginTop: 8 }]} onPress={() => onBack()}>
          <Text style={styles.menuButtonText}>Back</Text>
        </TouchableOpacity>
        
        {/* Debug/Test controls */}
        <View style={{ marginTop: 12, padding: 8, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.1)" }}>
          <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, marginBottom: 8 }}>Test Controls:</Text>
          <TouchableOpacity onPress={() => { if ((net as any).joinRoom) (net as any).joinRoom(actualRoomId, "Remote"); }}>
            <Text style={{ color: "#d4af37", fontSize: 13 }}>Simulate Remote Join</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={{ marginTop: 8 }}
            onPress={() => {
              // toggle ready locally and via adapter if supported
              const next = !localReady;
              setLocalReady(next);
              if ((net as any).toggleReady && localId) {
                (net as any).toggleReady(actualRoomId, localId, next);
              } else if (!(adapter)) {
                // MockAdapter supports toggleReady
                (net as MockAdapter).toggleReady(actualRoomId, localId as string, next);
              }
            }}
          >
            <Text style={{ color: localReady ? "#7CFC00" : "#d4af37", fontSize: 13 }}>{localReady ? "Ready ✓" : "Not ready"}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}
