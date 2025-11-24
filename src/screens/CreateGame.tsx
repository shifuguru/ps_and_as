import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, TextInput, FlatList, ScrollView, Alert, useWindowDimensions, Modal, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard } from "react-native";
import { styles } from "../styles/theme";
import BackButton from "../components/BackButton";
import Header from "../components/Header";
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
  const [selectedLobbyIndex, setSelectedLobbyIndex] = useState<number | null>(null);
  const [showPlayerModal, setShowPlayerModal] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<"disconnected" | "connecting" | "connected">("disconnected");
  const [roomCreated, setRoomCreated] = useState(false);
  const [roomName, setRoomName] = useState<string>("My Game");
  const [actualRoomId, setActualRoomId] = useState<string>("demo");
  const [playerNameReady, setPlayerNameReady] = useState(false);
  const { height } = useWindowDimensions();
  
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
  <KeyboardAvoidingView
    style={{ flex: 1 }}
    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 60}
  >
    <TouchableWithoutFeedback onPress={() => Keyboard.dismiss()}>
      <View style={[{ flex: 1, alignItems: "center" }]}> 
        <Header title="Create Game" onBack={onBack} />
        <Text style={styles.title}>Create Game</Text>
        <Text style={styles.subtitle}>Add players (2-8 players)</Text>

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

    {/* Players list (fills available space) */}
    <View
      style={{
        width: "80%",
        marginTop: 12,
        flex: 1,
        borderWidth: 1,
        borderColor: "rgba(212, 175, 55, 0.15)",
        borderRadius: 8,
        backgroundColor: "rgba(0,0,0,0.2)",
        overflow: "hidden",
        marginBottom: 180 // leave space for sticky bottom bar
      }}
    >
      <FlatList
        data={names}
        keyExtractor={(item, index) => `${item}-${index}`}
        showsVerticalScrollIndicator
        style={{ flex: 1 }}
        numColumns={2}
        contentContainerStyle={{ paddingVertical: 8, paddingHorizontal: 4 }}
        columnWrapperStyle={{ justifyContent: 'space-between', paddingHorizontal: 4 }}
        renderItem={({ item, index }) => {
          const isLocalPlayer = index === 0 && localId === hostId; // First player if you're the host
          const isCPU = item.startsWith("CPU ");
          const canRemove = (localId === hostId && !isLocalPlayer) || isCPU; // Host can remove others + anyone can remove CPU

          return (
            <TouchableOpacity
              key={`${item}-${index}`}
              activeOpacity={0.85}
              onPress={() => { setSelectedLobbyIndex(index); setShowPlayerModal(true); }}
              onLongPress={() => {
                const options: any[] = [];
                options.push({ text: 'Report', onPress: () => Alert.alert('Reported', `${item} has been reported. Thank you.`) });
                if (canRemove) {
                  options.unshift({ text: 'Remove', style: 'destructive', onPress: () => {
                    if (isCPU) {
                      setNames((s) => s.filter((_, i) => i !== index));
                    } else if (adapter && (adapter as any).kickPlayer) {
                      console.log('[CreateGame] Kicking player:', item);
                      (adapter as any).kickPlayer(roomName, item);
                    } else {
                      setNames((s) => s.filter((_, i) => i !== index));
                    }
                  }});
                }
                options.push({ text: 'Cancel', style: 'cancel' });
                Alert.alert(item, 'Lobby options', options);
              }}
              style={{
                width: '48%',
                marginBottom: 10,
                borderWidth: 1,
                borderColor: 'rgba(212,175,55,0.18)',
                borderRadius: 10,
                backgroundColor: 'rgba(0,0,0,0.25)',
                padding: 12
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: '#fff', fontWeight: '800' }}>{(item.split(' ').map(s=>s[0]).join('') || '?').slice(0,2)}</Text>
                </View>
                <View style={{ marginLeft: 8, flex: 1 }}>
                  <Text numberOfLines={1} style={{ color: isCPU ? 'rgba(255,255,255,0.7)' : '#fff', fontWeight: '700' }}>{item}{isCPU ? ' 🤖' : ''}</Text>
                  <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11 }}>{index === 0 && localId === hostId ? 'Host' : 'Player'}</Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </View>

  {/* Sticky bottom controls */}
    <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingBottom: 16, paddingTop: 10, backgroundColor: 'rgba(15,15,15,0.98)', borderTopWidth: 1, borderTopColor: 'rgba(212,175,55,0.25)', alignItems: 'center' }}>
      {/* Add/Remove CPU Players */}
      <View style={{ width: '90%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14 }}>CPU Players:</Text>
        <View style={{ flexDirection: 'row' }}>
          <TouchableOpacity
            style={[styles.menuButton, { paddingVertical: 8, paddingHorizontal: 16, backgroundColor: 'rgba(212,175,55,0.1)', marginRight: 8 }]}
            onPress={() => {
              const lastCPUIndex = names
                .map((n, i) => ({ n, i }))
                .reverse()
                .find(({ n }) => n.startsWith('CPU '))?.i;
              if (lastCPUIndex !== undefined) {
                setNames((s) => s.filter((_, i) => i !== lastCPUIndex));
                console.log('[CreateGame] Removed last CPU player');
              }
            }}
            disabled={names.filter((n) => n.startsWith('CPU ')).length === 0}
          >
            <Text style={[styles.menuButtonText, { opacity: names.filter((n) => n.startsWith('CPU ')).length === 0 ? 0.5 : 1 }]}>−</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.menuButton, { paddingVertical: 8, paddingHorizontal: 16, backgroundColor: 'rgba(212,175,55,0.2)' }]}
            onPress={() => {
              if (names.length >= 8) return;
              // Generate next available unique CPU name (fill gaps, avoid duplicates)
              const usedNums = new Set<number>();
              for (const n of names) {
                const m = /^CPU\s+(\d+)$/i.exec(n.trim());
                if (m) usedNums.add(parseInt(m[1], 10));
              }
              let i = 1;
              while (usedNums.has(i)) i++;
              let cpuName = `CPU ${i}`;
              // Defensive fallback if some weird collision exists
              while (names.some(n => n.toLowerCase() === cpuName.toLowerCase())) {
                i++;
                cpuName = `CPU ${i}`;
              }
              setNames((s) => [...s, cpuName]);
              console.log('[CreateGame] Added CPU player:', cpuName);
              try {
                if ((net as any)?.constructor?.name === 'MockAdapter') {
                  const m = net as MockAdapter;
                  const rid = actualRoomId || roomName;
                  setActualRoomId(rid);
                  m.joinRoom(rid, cpuName);
                }
              } catch (e) {
                console.warn('[CreateGame] Failed to add CPU to MockAdapter room', e);
              }
            }}
            disabled={names.length >= 8}
          >
            <Text style={[styles.menuButtonText, { opacity: names.length >= 8 ? 0.5 : 1 }]}>+</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Manual Human Player Add input */}
      <View style={{ flexDirection: 'row', width: '90%', marginTop: 10 }}>
        <TextInput
          placeholder="Player name"
          placeholderTextColor="rgba(255,255,255,0.5)"
          value={input}
          onChangeText={setInput}
          style={{ flex: 1, color: 'white', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)', marginRight: 8, paddingVertical: 8 }}
        />
        <TouchableOpacity
          style={[styles.menuButton, { paddingVertical: 8, paddingHorizontal: 16 }]}
          onPress={() => {
            const trimmed = input.trim();
            if (!trimmed) return;
            // Prevent duplicate names (case-insensitive)
            const exists = names.some(n => n.toLowerCase() === trimmed.toLowerCase());
            if (exists) {
              Alert.alert('Duplicate name', 'That name is already in the lobby. Please choose a different one.');
              return;
            }
            // If lobby is full, try to remove the last CPU to make room
            if (names.length >= 8) {
              const lastCPUIndex = names
                .map((n, i) => ({ n, i }))
                .reverse()
                .find(({ n }) => n.startsWith('CPU '))?.i;
              if (lastCPUIndex === undefined) {
                Alert.alert('Lobby full', 'The lobby is full and there are no CPU slots to replace.');
                return;
              }
              setNames((s) => {
                const copy = s.slice();
                // Recompute in case names changed
                const lastIdx = copy
                  .map((n, i) => ({ n, i }))
                  .reverse()
                  .find(({ n }) => n.startsWith('CPU '))?.i;
                if (lastIdx !== undefined) copy.splice(lastIdx, 1);
                copy.push(trimmed);
                return copy;
              });
              setInput('');
              return;
            }
            setNames((s) => [...s, trimmed]);
            setInput('');
          }}
        >
          <Text style={styles.menuButtonText}>Add</Text>
        </TouchableOpacity>
      </View>

      {/* Start / Back */}
      <View style={{ width: '90%', marginTop: 12 }}>
        <TouchableOpacity
          onPress={() => {
            console.log('[CreateGame] Start Game button pressed');
            const usingMock = adapter == null || (net as any)?.constructor?.name === 'MockAdapter';
            if (usingMock) {
              console.log('[CreateGame] Starting offline/local game');
              onStart(names, playerName, playerId ?? undefined);
              return;
            }
            if ((net as any).startGame) {
              if (hostId && localId === hostId) {
                console.log('[CreateGame] Calling adapter.startGame with roomId:', actualRoomId);
                (net as any).startGame(actualRoomId);
              } else {
                console.log('[CreateGame] Not host, cannot start');
              }
            } else {
              onStart(names, playerName, playerId ?? undefined);
            }
          }}
          disabled={names.length < 2 || (!(adapter == null) && localId !== hostId)}
          style={[styles.menuButton, names.length < 2 || (!(adapter == null) && localId !== hostId) ? { opacity: 0.45 } : null]}
        >
          <Text style={[styles.menuButtonText, names.length < 2 || (!(adapter == null) && localId !== hostId) ? { opacity: 0.7 } : null]}>
            {(adapter == null) || ((net as any)?.constructor?.name === 'MockAdapter')
              ? 'START GAME'
              : names.length >= 2
                ? localId && hostId && localId === hostId
                  ? 'Start Game'
                  : 'Waiting for host...'
                : 'Waiting for players...'}
          </Text>
        </TouchableOpacity>
        {/* Use shared BackButton component for consistent look */}
        <BackButton onPress={() => onBack()} />
      </View>
    </View>

    {/* Player details modal */}
    <Modal visible={showPlayerModal} transparent animationType="fade" onRequestClose={() => setShowPlayerModal(false)}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ backgroundColor: 'rgba(15,15,15,0.98)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(212,175,55,0.35)', padding: 16, minWidth: 280 }}>
          <Text style={{ color: '#d4af37', fontWeight: '800', fontSize: 16, marginBottom: 8 }}>Player</Text>
          <Text style={{ color: '#fff', marginBottom: 16 }}>{typeof selectedLobbyIndex === 'number' ? names[selectedLobbyIndex] : ''}</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <TouchableOpacity style={[styles.menuButton, { flex: 1, marginRight: 8 }]} onPress={() => { setShowPlayerModal(false); onNavigateToAchievements && onNavigateToAchievements(); }}>
              <Text style={styles.menuButtonText}>View Achievements</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.menuButton, { flex: 1, marginLeft: 8 }]} onPress={() => setShowPlayerModal(false)}>
              <Text style={styles.menuButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
      </View>
    </TouchableWithoutFeedback>
  </KeyboardAvoidingView>
  );
}