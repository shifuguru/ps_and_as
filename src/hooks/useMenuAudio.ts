// hooks/useMenuAudio.ts
import { useEffect, useRef, useState } from "react";

// We avoid a top-level `import { Audio } from 'expo-av'` because
// some versions of the package export a `Video` entry that Metro may
// try to resolve even when we only need Audio, which causes bundling
// to fail. Instead require dynamically inside runtime code and
// gracefully no-op when it's not available.

export function useMenuAudio() {
  const bgSound = useRef<any>(null);
  const [muted, setMuted] = useState<boolean>(false);

  useEffect(() => {
    const load = async () => {
      // Try to load persisted mute state (AsyncStorage may not be available in all envs)
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const AsyncStorage = require("@react-native-async-storage/async-storage").default;
        const stored = await AsyncStorage.getItem("ps_and_as_muted");
        if (stored !== null) {
          const val = stored === "1";
          setMuted(val);
        }
      } catch (e) {
        // AsyncStorage not available or read failed; ignore
      }

      let AudioModule: typeof import("expo-av") | null = null;
      try {
        // dynamic require to prevent Metro resolving unnecessary exports
        // at bundle-time (like './Video')
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        AudioModule = require("expo-av");
      } catch (e) {
        console.warn("expo-av not available, menu audio disabled", e);
        return;
      }

      const { sound } = await AudioModule.Audio.Sound.createAsync(
        require("../../assets/sounds/bg_casino_ambience.mp3"),
        { shouldPlay: true, isLooping: true, volume: 0.3 }
      );
      bgSound.current = sound;
    };

    load();

    return () => {
      if (bgSound.current) {
        bgSound.current.unloadAsync();
      }
    };
  }, []);

  const playEffect = async (effect: string) => {
    {/*  
    let source;
    switch (effect) {
      case "shuffle":
        // placeholder file exists as .txt — replace with .mp3 when available
        source = require("../../assets/sounds/card_shuffle.txt");
        break;
      case "chips":
        source = require("../../assets/sounds/chips_clink.txt");
        break;
      case "click":
      default:
        source = require("../../assets/sounds/button_click.txt");
        break;
    }
    // If source is falsy for any reason, skip playing
    if (!source) return;
    const { sound } = await Audio.Sound.createAsync(source, { shouldPlay: true, volume: 0.6 });
    sound.setOnPlaybackStatusUpdate((status) => {
      if ((status as any).didJustFinish) sound.unloadAsync();
    });
    */}
  };

  const toggleMute = async () => {
    const next = !muted;
    setMuted(next);
    // persist
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const AsyncStorage = require("@react-native-async-storage/async-storage").default;
      await AsyncStorage.setItem("ps_and_as_muted", next ? "1" : "0");
    } catch (e) {
      // ignore
    }
    if (bgSound.current) {
      try {
        await bgSound.current.setIsMutedAsync(next);
      } catch (e) {
        try {
          await bgSound.current.setStatusAsync({ isMuted: next });
        } catch (_) {
          // ignore
        }
      }
    }
  };

  const isMuted = () => muted;

  return { playEffect, toggleMute, isMuted, muted, setMuted };
}
