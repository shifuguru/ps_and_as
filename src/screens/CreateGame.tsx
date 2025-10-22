import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, TextInput, FlatList } from "react-native";
import { styles } from "../styles/theme";
import { NetworkAdapter, MockAdapter } from "../game/network";


export default function CreateGame({ onBack, onStart, adapter }: { onBack: () => void; onStart: (names: string[]) => void; adapter?: NetworkAdapter }) {
  const [names, setNames] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const net = adapter ?? new MockAdapter();
  const [localId, setLocalId] = useState<string | null>(null);
  const [localReady, setLocalReady] = useState(false);
  const [hostId, setHostId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    // subscribe to network messages
    net.on("message", (ev) => {
      if (!mounted) return;
      // support state messages from adapters
      if (ev.type === "state" && ev.state && ev.state.type === "lobby") {
        setNames(ev.state.players.map((p: any) => p.name));
        setHostId(ev.state.host ?? null);
        // if localId known, update our ready state
        if (localId) {
          const me = (ev.state.players || []).find((p: any) => p.id === localId);
          setLocalReady(!!(me && me.ready));
        }
      }
      if (ev.type === "state" && ev.state && ev.state.type === "startGame") {
        onStart(ev.state.players);
      }
      if (ev.type === "state" && ev.state && ev.state.type === "connected") {
        // connected gives us our assigned id
        setLocalId(ev.state.id);
      }
    });

    // if a real adapter was provided, attempt to connect and create/join a room
    (async () => {
      try {
        if (adapter) {
          await adapter.connect();
          // create a room if supported (host)
          if ((adapter as any).createRoom) (adapter as any).createRoom("demo", "You (Host)");
        } else {
          // for demo (no adapter) populate with 2 simulated players
          const m = net as MockAdapter;
          m.createRoom("demo", "You (Host)");
          m.joinRoom("demo", "Player 2");
          // capture our mock id via connected event (sync)
          // localId will be set by the connected event handled above
        }
      } catch (e) {
        // no-op; fallback to MockAdapter behavior
        console.warn("CreateGame: adapter connect/createRoom failed", e);
      }
    })();

    return () => {
      mounted = false;
      try {
        if (adapter) adapter.disconnect();
      } catch (e) {
        // ignore
      }
    };
  }, []);

  return (
    <View style={styles.menuContainer}>
      <Text style={styles.title}>Create Game</Text>
      <Text style={styles.subtitle}>Add player names (2-8 players)</Text>

      <FlatList
        data={names}
        keyExtractor={(item, idx) => item + idx}
        renderItem={({ item, index }) => (
          <View style={{ flexDirection: "row", width: "80%", justifyContent: "space-between", alignItems: "center", marginVertical: 6 }}>
            <Text style={{ color: "white" }}>{index + 1}. {item}</Text>
            <TouchableOpacity onPress={() => setNames((s) => s.filter((_, i) => i !== index))}>
              <Text style={{ color: "#d4af37" }}>Remove</Text>
            </TouchableOpacity>
          </View>
        )}
      />

      <View style={{ flexDirection: "row", width: "80%", marginTop: 12 }}>
        <TextInput
          placeholder="Player name"
          placeholderTextColor="rgba(255,255,255,0.5)"
          value={input}
          onChangeText={setInput}
          style={{ flex: 1, color: "white", borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.08)", marginRight: 8 }}
        />
        <TouchableOpacity style={styles.menuButton} onPress={() => { if (input.trim()) { setNames((s) => [...s, input.trim()]); setInput(""); } }}>
          <Text style={styles.menuButtonText}>Add</Text>
        </TouchableOpacity>
      </View>

      <View style={{ width: "80%", marginTop: 18 }}>
        <TouchableOpacity
          style={styles.menuButton}
          onPress={() => {
            // if adapter supports startGame call it on a room (host only)
            if ((net as any).startGame) {
              // only host may start
              if (hostId && localId === hostId) {
                (net as any).startGame("demo");
              }
            } else {
              onStart(names);
            }
          }}
          disabled={names.length < 2 || ((adapter || (hostId !== null)) && localId !== hostId) }
        >
          <Text style={styles.menuButtonText}>{names.length >= 2 ? (localId && hostId && localId === hostId ? "Start Game" : "Waiting for host...") : "Waiting for players..."}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.menuButton, { marginTop: 8 }]} onPress={() => onBack()}>
          <Text style={styles.menuButtonText}>Back</Text>
        </TouchableOpacity>
        <View style={{ marginTop: 8 }}>
          <TouchableOpacity onPress={() => { if ((net as any).joinRoom) (net as any).joinRoom("demo", "Remote"); }}>
            <Text style={{ color: "#d4af37" }}>Simulate Remote Join</Text>
          </TouchableOpacity>
          <View style={{ marginTop: 8 }}>
            <TouchableOpacity onPress={() => {
              // toggle ready locally and via adapter if supported
              const next = !localReady;
              setLocalReady(next);
              if ((net as any).toggleReady && localId) (net as any).toggleReady("demo", localId, next);
              else if (!(adapter)) {
                // MockAdapter supports toggleReady
                (net as MockAdapter).toggleReady("demo", localId as string, next);
              }
            }}>
              <Text style={{ color: localReady ? "#7CFC00" : "#d4af37" }}>{localReady ? "Ready (click to unready)" : "Not ready (click to ready)"}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}
