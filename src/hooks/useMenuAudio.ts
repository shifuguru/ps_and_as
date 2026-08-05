// hooks/useMenuAudio.ts
import { useCallback, useEffect, useRef, useState } from "react";
import type { GameSfxId } from "../audio/gameSfx";

// We avoid a top-level `import { Audio } from 'expo-av'` because
// some versions of the package export a `Video` entry that Metro may
// try to resolve even when we only need Audio, which causes bundling
// to fail. Instead require dynamically inside runtime code and
// gracefully no-op when it's not available.

const MUTE_KEY = "ps_and_as_muted";

type ExpoAudioModule = typeof import("expo-av");

function resolveEffectSource(effect: string): number | null {
  switch (effect) {
    case "card_select":
      return require("../../assets/sounds/card_select.wav");
    case "card_play":
      return require("../../assets/sounds/card_play.wav");
    case "card_play_multi":
      return require("../../assets/sounds/card_play_multi.wav");
    case "card_land":
      return require("../../assets/sounds/card_land.wav");
    case "pass":
      return require("../../assets/sounds/pass.wav");
    case "turn_start":
      return require("../../assets/sounds/turn_start.wav");
    case "card_deal":
      return require("../../assets/sounds/card_deal.wav");
    case "pile_clear":
      return require("../../assets/sounds/pile_clear.wav");
    case "shuffle":
      // Soft deal flap stands in until a dedicated shuffle asset exists.
      return require("../../assets/sounds/card_deal.wav");
    case "chips":
      return require("../../assets/sounds/button_click.wav");
    case "click":
    default:
      return require("../../assets/sounds/button_click.wav");
  }
}

export function useMenuAudio() {
  const audioModuleRef = useRef<ExpoAudioModule | null>(null);
  const unlockedRef = useRef(false);
  const mutedRef = useRef(false);
  const [muted, setMuted] = useState<boolean>(false);

  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      let initMuted = false;
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const AsyncStorage = require("@react-native-async-storage/async-storage").default;
        const stored = await AsyncStorage.getItem(MUTE_KEY);
        if (stored !== null) {
          initMuted = stored === "1";
        }
      } catch {
        // AsyncStorage not available or read failed; ignore
      }
      if (cancelled) return;
      setMuted(initMuted);
      mutedRef.current = initMuted;

      // Defer expo-av until first play — avoid pulling the module + decoder work
      // onto the splash/boot critical path.
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const ensureAudioModule = useCallback(async (): Promise<ExpoAudioModule | null> => {
    if (audioModuleRef.current) return audioModuleRef.current;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const AudioModule = require("expo-av") as ExpoAudioModule;
      audioModuleRef.current = AudioModule;
      try {
        await AudioModule.Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          allowsRecordingIOS: false,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
        });
      } catch {
        // Some platforms reject mode flags — SFX can still work.
      }
      return AudioModule;
    } catch (e) {
      console.warn("expo-av not available, menu audio disabled", e);
      return null;
    }
  }, []);

  const unlockAudio = useCallback(async () => {
    if (unlockedRef.current) return;
    const AudioModule = await ensureAudioModule();
    if (!AudioModule) return;
    unlockedRef.current = true;
    try {
      await AudioModule.Audio.setIsEnabledAsync?.(true);
    } catch {
      // optional API
    }
  }, [ensureAudioModule]);

  const playEffect = useCallback(async (effect: GameSfxId | string) => {
    if (mutedRef.current) return;
    const AudioModule = await ensureAudioModule();
    if (!AudioModule) return;

    await unlockAudio();

    const source = resolveEffectSource(effect);
    if (!source) return;

    try {
      const volume =
        effect === "turn_start"
          ? 0.72
          : effect === "card_select"
            ? 0.45
            : effect === "card_land"
              ? 0.48
              : effect === "pass"
                ? 0.5
                : 0.6;
      const { sound } = await AudioModule.Audio.Sound.createAsync(source, {
        shouldPlay: true,
        volume,
      });
      sound.setOnPlaybackStatusUpdate((status: any) => {
        if (status?.didJustFinish) {
          void sound.unloadAsync();
        }
      });
    } catch (e) {
      // Autoplay / missing asset — stay silent rather than throw into gameplay.
      if (typeof __DEV__ !== "undefined" && __DEV__) {
        console.warn("playEffect failed", effect, e);
      }
    }
  }, [ensureAudioModule, unlockAudio]);

  const toggleMute = useCallback(async () => {
    const next = !mutedRef.current;
    setMuted(next);
    mutedRef.current = next;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const AsyncStorage = require("@react-native-async-storage/async-storage").default;
      await AsyncStorage.setItem(MUTE_KEY, next ? "1" : "0");
    } catch {
      // ignore
    }
  }, []);

  const isMuted = useCallback(() => mutedRef.current, []);

  return { playEffect, toggleMute, isMuted, muted, setMuted, unlockAudio };
}
