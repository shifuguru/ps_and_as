import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  LayoutChangeEvent,
  Platform,
  type GestureResponderEvent,
} from "react-native";
import Svg, {
  Defs,
  LinearGradient,
  Stop,
  Rect,
} from "react-native-svg";
import {
  hexToRgb,
  hslToHex,
  hslToRgb,
  rgbToHex,
  rgbToHsl,
  feltHexFromHsl,
  type Hsl,
} from "../utils/colorTheory";
import { normalizeHexColor } from "../services/wallpaper";
import type { AppThemeColors } from "../styles/themeColors";
import {
  bindWebTouchScrollLock,
  resolveWebDomNode,
  useWebTouchScrollLock,
  useWebTouchScrollLockRef,
} from "../utils/webNoZoom";

type Props = {
  value: string;
  onChange: (hex: string) => void;
  colors: AppThemeColors;
};

const SL_HEIGHT = 168;
const HUE_HEIGHT = 22;
const HUE_HIT_HEIGHT = 44;
const MARKER = 12;
const HUE_MARKER_W = 14;
const PICKER_NATIVE_ID = "felt-color-picker";
const DEFAULT_HSL: Hsl = { h: 145, s: 72, l: 32 };

const captureTouch = {
  onStartShouldSetResponder: () => true,
  onMoveShouldSetResponder: () => true,
  onStartShouldSetResponderCapture: () => true,
  onMoveShouldSetResponderCapture: () => true,
  onResponderTerminationRequest: () => false,
};

function clampChannel(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * RGB black / white / gray has no meaningful hue. Keep the previous H/S so the
 * picker does not snap the hue wheel to red when lightness hits 0.
 */
function hslFromHex(hex: string, preserve: Hsl | null): Hsl {
  const rgb = hexToRgb(hex);
  if (!rgb) return preserve ?? DEFAULT_HSL;
  const next = rgbToHsl(rgb);
  if (!preserve) return next;

  const achromatic = next.s < 0.5;
  const atBlackOrWhite = next.l < 0.5 || next.l > 99.5;
  if (achromatic || atBlackOrWhite) {
    return {
      h: preserve.h,
      s: atBlackOrWhite ? preserve.s : next.s,
      l: next.l,
    };
  }
  return next;
}

export default function FeltColorPicker({ value, onChange, colors }: Props) {
  const rootRef = useRef<View>(null);
  const slTouchRef = useRef<View>(null);
  const hueTouchRef = useRef<View>(null);
  const hueTrackRef = useRef<View>(null);
  const [slWidth, setSlWidth] = useState(0);
  const [hueWidth, setHueWidth] = useState(0);
  const [hsl, setHsl] = useState<Hsl>(() => hslFromHex(value, null));
  const hslRef = useRef<Hsl>(hsl);
  const pickHueRef = useRef<(x: number) => void>(() => {});
  const pickSlRef = useRef<(x: number, y: number) => void>(() => {});

  const slTouchLockRef = useWebTouchScrollLockRef();
  const hueTouchLockRef = useWebTouchScrollLockRef();
  useWebTouchScrollLock(rootRef, true, slWidth + hueWidth);

  // External edits (hex field / presets) — merge achromatic props without losing hue.
  useEffect(() => {
    const normalized = normalizeHexColor(value);
    if (!normalized) return;
    // Prefer matching the hue-safe persisted form so dragging to black keeps local HSL.
    const persistedFromLocal = normalizeHexColor(
      feltHexFromHsl(hslRef.current.h, hslRef.current.s, hslRef.current.l),
    );
    if (normalized === persistedFromLocal) return;
    const self = normalizeHexColor(
      hslToHex(hslRef.current.h, hslRef.current.s, hslRef.current.l),
    );
    if (normalized === self) return;
    const next = hslFromHex(value, hslRef.current);
    hslRef.current = next;
    setHsl(next);
  }, [value]);

  const hueColor = useMemo(
    () => rgbToHex(hslToRgb({ h: hsl.h, s: 100, l: 50 })),
    [hsl.h],
  );

  const emitHsl = useCallback(
    (next: Hsl) => {
      const clamped = {
        h: clampChannel(next.h, 0, 359.9),
        s: clampChannel(next.s, 0, 100),
        l: clampChannel(next.l, 0, 100),
      };
      hslRef.current = clamped;
      setHsl(clamped);
      // Persist a hue-safe hex so theme accents don't snap to red on near-black.
      onChange(feltHexFromHsl(clamped.h, clamped.s, clamped.l));
    },
    [onChange],
  );

  const handleSlLayout = (event: LayoutChangeEvent) => {
    setSlWidth(event.nativeEvent.layout.width);
  };

  const handleHueLayout = (event: LayoutChangeEvent) => {
    setHueWidth(event.nativeEvent.layout.width);
  };

  const pickSl = useCallback(
    (x: number, y: number) => {
      if (slWidth <= 0) return;
      const cx = clampChannel(x, 0, slWidth);
      const cy = clampChannel(y, 0, SL_HEIGHT);
      const s = (cx / slWidth) * 100;
      const l = 100 - (cy / SL_HEIGHT) * 100;
      const base = hslRef.current;
      emitHsl({ h: base.h, s, l });
    },
    [emitHsl, slWidth],
  );

  const pickHue = useCallback(
    (x: number) => {
      if (hueWidth <= 0) return;
      const cx = clampChannel(x, 0, hueWidth);
      const h = (cx / hueWidth) * 360;
      const base = hslRef.current;
      emitHsl({ h, s: base.s, l: base.l });
    },
    [emitHsl, hueWidth],
  );

  pickSlRef.current = pickSl;
  pickHueRef.current = pickHue;

  const onSlTouch = (event: GestureResponderEvent) => {
    const { locationX, locationY } = event.nativeEvent;
    pickSl(locationX, locationY);
  };

  const onHueTouch = (event: GestureResponderEvent) => {
    const { locationX } = event.nativeEvent;
    pickHue(locationX);
  };

  useEffect(() => {
    if (Platform.OS !== "web") return;

    const touchNode = resolveWebDomNode(slTouchRef.current);
    if (!touchNode) return;

    const pickFromPointer = (event: PointerEvent) => {
      const rect = touchNode.getBoundingClientRect();
      pickSlRef.current(event.clientX - rect.left, event.clientY - rect.top);
    };

    const onPointerDown = (event: PointerEvent) => {
      touchNode.setPointerCapture(event.pointerId);
      event.preventDefault();
      pickFromPointer(event);
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!touchNode.hasPointerCapture(event.pointerId)) return;
      event.preventDefault();
      pickFromPointer(event);
    };
    const releasePointer = (event: PointerEvent) => {
      if (touchNode.hasPointerCapture(event.pointerId)) {
        touchNode.releasePointerCapture(event.pointerId);
      }
    };

    const unbindScrollLock = bindWebTouchScrollLock(touchNode);
    touchNode.addEventListener("pointerdown", onPointerDown);
    touchNode.addEventListener("pointermove", onPointerMove);
    touchNode.addEventListener("pointerup", releasePointer);
    touchNode.addEventListener("pointercancel", releasePointer);

    return () => {
      unbindScrollLock();
      touchNode.removeEventListener("pointerdown", onPointerDown);
      touchNode.removeEventListener("pointermove", onPointerMove);
      touchNode.removeEventListener("pointerup", releasePointer);
      touchNode.removeEventListener("pointercancel", releasePointer);
    };
  }, [slWidth]);

  useEffect(() => {
    if (Platform.OS !== "web") return;

    const touchNode = resolveWebDomNode(hueTouchRef.current);
    const trackNode = resolveWebDomNode(hueTrackRef.current);
    if (!touchNode || !trackNode) return;

    const pickFromPointer = (event: PointerEvent) => {
      const rect = trackNode.getBoundingClientRect();
      pickHueRef.current(event.clientX - rect.left);
    };

    const onPointerDown = (event: PointerEvent) => {
      touchNode.setPointerCapture(event.pointerId);
      event.preventDefault();
      pickFromPointer(event);
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!touchNode.hasPointerCapture(event.pointerId)) return;
      event.preventDefault();
      pickFromPointer(event);
    };
    const releasePointer = (event: PointerEvent) => {
      if (touchNode.hasPointerCapture(event.pointerId)) {
        touchNode.releasePointerCapture(event.pointerId);
      }
    };

    const unbindScrollLock = bindWebTouchScrollLock(touchNode);
    touchNode.addEventListener("pointerdown", onPointerDown);
    touchNode.addEventListener("pointermove", onPointerMove);
    touchNode.addEventListener("pointerup", releasePointer);
    touchNode.addEventListener("pointercancel", releasePointer);

    return () => {
      unbindScrollLock();
      touchNode.removeEventListener("pointerdown", onPointerDown);
      touchNode.removeEventListener("pointermove", onPointerMove);
      touchNode.removeEventListener("pointerup", releasePointer);
      touchNode.removeEventListener("pointercancel", releasePointer);
    };
  }, [hueWidth]);

  // Keep markers fully inside the pads (not half-clipped past the edge).
  const slMarkerX =
    slWidth <= 0
      ? 0
      : clampChannel((hsl.s / 100) * slWidth, MARKER / 2, slWidth - MARKER / 2);
  const slMarkerY = clampChannel(
    (1 - hsl.l / 100) * SL_HEIGHT,
    MARKER / 2,
    SL_HEIGHT - MARKER / 2,
  );
  const hueMarkerX =
    hueWidth <= 0
      ? 0
      : clampChannel(
          (hsl.h / 360) * hueWidth,
          HUE_MARKER_W / 2,
          hueWidth - HUE_MARKER_W / 2,
        );
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View
      ref={rootRef}
      nativeID={PICKER_NATIVE_ID}
      style={[styles.root, Platform.OS === "web" && styles.rootWeb]}
    >
      <Text style={styles.label}>Felt Color</Text>
      <View
        ref={(node) => {
          slTouchRef.current = node;
          slTouchLockRef(node);
        }}
        style={[styles.slTouchPad, Platform.OS === "web" && styles.touchPadWeb]}
        onLayout={handleSlLayout}
        {...captureTouch}
        onResponderGrant={onSlTouch}
        onResponderMove={onSlTouch}
      >
        <View style={styles.slWrap}>
          <Svg width={slWidth || 1} height={SL_HEIGHT}>
            <Defs>
              <LinearGradient id="feltSat" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor="#ffffff" />
                <Stop offset="1" stopColor={hueColor} />
              </LinearGradient>
              <LinearGradient id="feltLight" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="rgba(0,0,0,0)" />
                <Stop offset="1" stopColor="#000000" />
              </LinearGradient>
            </Defs>
            <Rect
              x="0"
              y="0"
              width={slWidth || 1}
              height={SL_HEIGHT}
              rx="12"
              fill="url(#feltSat)"
            />
            <Rect
              x="0"
              y="0"
              width={slWidth || 1}
              height={SL_HEIGHT}
              rx="12"
              fill="url(#feltLight)"
            />
          </Svg>
          <View
            pointerEvents="none"
            style={[
              styles.marker,
              {
                left: slMarkerX - MARKER / 2,
                top: slMarkerY - MARKER / 2,
                borderColor: hsl.l > 55 ? "rgba(0,0,0,0.55)" : "#ffffff",
              },
            ]}
          />
        </View>
      </View>

      <Text style={styles.label}>Accent & Highlight Influence</Text>
      <View
        ref={(node) => {
          hueTouchRef.current = node;
          hueTouchLockRef(node);
        }}
        style={[styles.hueTouchPad, Platform.OS === "web" && styles.touchPadWeb]}
        {...captureTouch}
        onResponderGrant={onHueTouch}
        onResponderMove={onHueTouch}
      >
        <View
          ref={hueTrackRef}
          style={styles.hueWrap}
          onLayout={handleHueLayout}
        >
          <Svg width={hueWidth || 1} height={HUE_HEIGHT}>
            <Defs>
              <LinearGradient id="feltHue" x1="0" y1="0" x2="1" y2="0">
                {[0, 60, 120, 180, 240, 300, 360].map((deg) => (
                  <Stop
                    key={deg}
                    offset={`${(deg / 360) * 100}%`}
                    stopColor={rgbToHex(hslToRgb({ h: deg, s: 100, l: 50 }))}
                  />
                ))}
              </LinearGradient>
            </Defs>
            <Rect
              x="0"
              y="0"
              width={hueWidth || 1}
              height={HUE_HEIGHT}
              rx="10"
              fill="url(#feltHue)"
            />
          </Svg>
          <View
            pointerEvents="none"
            style={[
              styles.hueMarker,
              { left: hueMarkerX - HUE_MARKER_W / 2, backgroundColor: hueColor },
            ]}
          />
        </View>
      </View>
    </View>
  );
}

function createStyles(colors: AppThemeColors) {
  return StyleSheet.create({
    root: {
      marginTop: 12,
      gap: 8,
    },
    rootWeb: {
      touchAction: "none",
    } as object,
    touchPadWeb: {
      touchAction: "none",
      cursor: "crosshair",
    } as object,
    label: {
      color: colors.textTertiary,
      fontSize: 11,
      fontWeight: "700",
      letterSpacing: 0.2,
      textTransform: "uppercase",
    },
    slTouchPad: {
      width: "100%",
    },
    slWrap: {
      height: SL_HEIGHT,
      borderRadius: 12,
      overflow: "hidden",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.panelBorder,
    },
    hueTouchPad: {
      minHeight: HUE_HIT_HEIGHT,
      justifyContent: "center",
      width: "100%",
    },
    hueWrap: {
      height: HUE_HEIGHT,
      borderRadius: 10,
      overflow: "hidden",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.panelBorder,
    },
    marker: {
      position: "absolute",
      width: MARKER,
      height: MARKER,
      borderRadius: MARKER / 2,
      borderWidth: 2,
      backgroundColor: "transparent",
    },
    hueMarker: {
      position: "absolute",
      top: 3,
      width: HUE_MARKER_W,
      height: HUE_HEIGHT - 6,
      borderRadius: 7,
      borderWidth: 2,
      borderColor: "#ffffff",
    },
  });
}
