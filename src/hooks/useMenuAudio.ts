// hooks/useMenuAudio.ts
import { useCallback, useEffect, useRef, useState } from "react";
import type { GameSfxId } from "../audio/gameSfx";
import {
  resolveEffectVolume,
  pickPoolSlot,
  SFX_POOL_SIZE,
} from "../audio/sfxPlayback";
import { isAdsAudioSuppressed } from "../services/ads/adsAudioBridge";

// We avoid a top-level `import { Audio } from 'expo-av'` because
// some versions of the package export a `Video` entry that Metro may
// try to resolve even when we only need Audio, which causes bundling
// to fail. Instead require dynamically inside runtime code and
// gracefully no-op when it's not available.

const MUTE_KEY = "ps_and_as_muted";

type ExpoAudioModule = typeof import("expo-av");
type ExpoSound = InstanceType<ExpoAudioModule["Audio"]["Sound"]>;

type PoolEntry = {
  sound: ExpoSound;
  playing: boolean;
};

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

/** Best-effort resume for browser autoplay / suspended contexts. */
async function resumeAudioSubsystem(
  AudioModule: ExpoAudioModule,
): Promise<void> {
  try {
    await AudioModule.Audio.setIsEnabledAsync?.(true);
  } catch {
    // optional API
  }
}

export function useMenuAudio() {
  const audioModuleRef = useRef<ExpoAudioModule | null>(null);
  const unlockedRef = useRef(false);
  const mutedRef = useRef(false);
  const poolsRef = useRef<Map<string, PoolEntry[]>>(new Map());
  const poolCursorRef = useRef<Map<string, number>>(new Map());
  const preloadInflightRef = useRef<Map<string, Promise<PoolEntry[]>>>(
    new Map(),
  );
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
        const AsyncStorage = require("@react-native-async-storage/async-storage")
          .default;
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
      // onto the splash/boot critical path. Unused ambience track removed.
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  // Unload pooled sounds on unmount.
  useEffect(() => {
    return () => {
      const pools = poolsRef.current;
      poolsRef.current = new Map();
      for (const entries of pools.values()) {
        for (const entry of entries) {
          void entry.sound.unloadAsync().catch(() => {});
        }
      }
    };
  }, []);

  // Re-enable audio when the tab / app becomes active again (idle wait + pass).
  useEffect(() => {
    const onVisible = () => {
      const AudioModule = audioModuleRef.current;
      if (!AudioModule || mutedRef.current) return;
      void resumeAudioSubsystem(AudioModule);
    };

    const doc = typeof document !== "undefined" ? document : null;
    doc?.addEventListener?.("visibilitychange", onVisible);
    const win = typeof window !== "undefined" ? window : null;
    win?.addEventListener?.("focus", onVisible);

    let appSub: { remove: () => void } | null = null;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { AppState } = require("react-native");
      appSub = AppState.addEventListener("change", (next: string) => {
        if (next === "active") onVisible();
      });
    } catch {
      // web / no AppState
    }

    return () => {
      doc?.removeEventListener?.("visibilitychange", onVisible);
      win?.removeEventListener?.("focus", onVisible);
      appSub?.remove?.();
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

  const ensurePool = useCallback(
    async (
      AudioModule: ExpoAudioModule,
      effect: string,
    ): Promise<PoolEntry[]> => {
      const existing = poolsRef.current.get(effect);
      if (existing && existing.length > 0) return existing;

      const inflight = preloadInflightRef.current.get(effect);
      if (inflight) return inflight;

      const source = resolveEffectSource(effect);
      if (!source) return [];

      const task = (async () => {
        const entries: PoolEntry[] = [];
        for (let i = 0; i < SFX_POOL_SIZE; i++) {
          try {
            const { sound } = await AudioModule.Audio.Sound.createAsync(
              source,
              {
                shouldPlay: false,
                volume: resolveEffectVolume(effect),
              },
            );
            const entry: PoolEntry = { sound, playing: false };
            sound.setOnPlaybackStatusUpdate((status: any) => {
              if (status?.didJustFinish || status?.isPlaying === false) {
                // Only clear when finished (not mid-seek pauses).
                if (status?.didJustFinish) {
                  entry.playing = false;
                }
              }
            });
            entries.push(entry);
          } catch {
            // Partial pool is still useful.
            break;
          }
        }
        if (entries.length > 0) {
          poolsRef.current.set(effect, entries);
        }
        preloadInflightRef.current.delete(effect);
        return entries;
      })();

      preloadInflightRef.current.set(effect, task);
      return task;
    },
    [],
  );

  const playPooledEntry = useCallback(
    (effect: string, entry: PoolEntry) => {
      const volume = resolveEffectVolume(effect);
      entry.playing = true;
      // Fire-and-forget: awaiting setStatusAsync added tap→sound latency.
      void entry.sound
        .setStatusAsync({
          positionMillis: 0,
          shouldPlay: true,
          volume,
        })
        .catch(() => {
          entry.playing = false;
        });
    },
    [],
  );

  const tryPlayFromPool = useCallback(
    (effect: string): boolean => {
      const pool = poolsRef.current.get(effect);
      if (!pool || pool.length === 0) return false;
      const playingFlags = pool.map((e) => e.playing);
      const cursor = poolCursorRef.current.get(effect) ?? 0;
      const { slot, nextIndex } = pickPoolSlot(playingFlags, cursor);
      poolCursorRef.current.set(effect, nextIndex);
      const entry = pool[slot];
      if (!entry) return false;
      playPooledEntry(effect, entry);
      return true;
    },
    [playPooledEntry],
  );

  const unlockAudio = useCallback(async () => {
    const AudioModule = await ensureAudioModule();
    if (!AudioModule) return;
    unlockedRef.current = true;
    void resumeAudioSubsystem(AudioModule);
    // Warm common cues during the unlock gesture so later idle plays reuse
    // already-unlocked media elements (browser autoplay).
    void ensurePool(AudioModule, "click");
    void ensurePool(AudioModule, "card_select");
    void ensurePool(AudioModule, "card_play");
    void ensurePool(AudioModule, "card_play_multi");
    void ensurePool(AudioModule, "card_land");
    void ensurePool(AudioModule, "pass");
    void ensurePool(AudioModule, "pile_clear");
    void ensurePool(AudioModule, "turn_start");
    void ensurePool(AudioModule, "card_deal");
  }, [ensureAudioModule, ensurePool]);

  const playEffect = useCallback(
    (effect: GameSfxId | string) => {
      if (isAdsAudioSuppressed()) return;
      if (mutedRef.current) return;

      // Fast path: pool already warm — start playback without awaiting resume /
      // createAsync (those waits made menu clicks and throws feel late).
      if (tryPlayFromPool(effect)) {
        const AudioModule = audioModuleRef.current;
        if (AudioModule) void resumeAudioSubsystem(AudioModule);
        return;
      }

      void (async () => {
        const AudioModule = await ensureAudioModule();
        if (!AudioModule) return;

        void resumeAudioSubsystem(AudioModule);
        if (!unlockedRef.current) {
          unlockedRef.current = true;
          void ensurePool(AudioModule, "click");
          void ensurePool(AudioModule, "card_select");
          void ensurePool(AudioModule, "card_play");
          void ensurePool(AudioModule, "card_play_multi");
          void ensurePool(AudioModule, "card_land");
          void ensurePool(AudioModule, "pass");
          void ensurePool(AudioModule, "pile_clear");
          void ensurePool(AudioModule, "turn_start");
          void ensurePool(AudioModule, "card_deal");
        }
        unlockedRef.current = true;

        const pool = await ensurePool(AudioModule, effect);
        if (pool.length === 0) return;
        // Prefer sync pool play once loaded; avoid a second await on status.
        if (tryPlayFromPool(effect)) return;

        const volume = resolveEffectVolume(effect);
        try {
          const source = resolveEffectSource(effect);
          if (!source) return;
          const { sound } = await AudioModule.Audio.Sound.createAsync(source, {
            shouldPlay: true,
            volume,
          });
          sound.setOnPlaybackStatusUpdate((status: any) => {
            if (status?.didJustFinish) {
              void sound.unloadAsync();
            }
          });
        } catch (err) {
          if (typeof __DEV__ !== "undefined" && __DEV__) {
            console.warn("playEffect failed", effect, err);
          }
        }
      })();
    },
    [ensureAudioModule, ensurePool, tryPlayFromPool],
  );

  const toggleMute = useCallback(async () => {
    const next = !mutedRef.current;
    setMuted(next);
    mutedRef.current = next;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const AsyncStorage = require("@react-native-async-storage/async-storage")
        .default;
      await AsyncStorage.setItem(MUTE_KEY, next ? "1" : "0");
    } catch {
      // ignore
    }
  }, []);

  const isMuted = useCallback(() => mutedRef.current, []);

  return { playEffect, toggleMute, isMuted, muted, setMuted, unlockAudio };
}
