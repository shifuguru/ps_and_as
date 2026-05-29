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
const PICKER_NATIVE_ID = "felt-color-picker";

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

export default function FeltColorPicker({ value, onChange, colors }: Props) {
  const rootRef = useRef<View>(null);
  const slTouchRef = useRef<View>(null);
  const hueTouchRef = useRef<View>(null);
  const hueTrackRef = useRef<View>(null);
  const [slWidth, setSlWidth] = useState(0);
  const [hueWidth, setHueWidth] = useState(0);
  const hslRef = useRef<{ h: number; s: number; l: number } | null>(null);
  const pickHueRef = useRef<(x: number) => void>(() => {});
  const pickSlRef = useRef<(x: number, y: number) => void>(() => {});

  const slTouchLockRef = useWebTouchScrollLockRef();
  const hueTouchLockRef = useWebTouchScrollLockRef();
  useWebTouchScrollLock(rootRef, true, slWidth + hueWidth);

  const hsl = useMemo(() => {
    const rgb = hexToRgb(value);
    if (!rgb) return { h: 145, s: 72, l: 32 };
    const next = rgbToHsl(rgb);
    hslRef.current = next;
    return next;
  }, [value]);

  const hueColor = useMemo(
    () => rgbToHex(hslToRgb({ h: hsl.h, s: 100, l: 50 })),
    [hsl.h],
  );

  const emitHsl = useCallback(
    (next: { h: number; s: number; l: number }) => {
      hslRef.current = next;
      onChange(hslToHex(next.h, next.s, next.l));
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
      const s = clampChannel((x / slWidth) * 100, 0, 100);
      const l = clampChannel(100 - (y / SL_HEIGHT) * 100, 0, 100);
      const base = hslRef.current ?? hsl;
      emitHsl({ h: base.h, s, l });
    },
    [emitHsl, hsl, slWidth],
  );

  const pickHue = useCallback(
    (x: number) => {
      if (hueWidth <= 0) return;
      const h = clampChannel((x / hueWidth) * 360, 0, 359.9);
      const base = hslRef.current ?? hsl;
      emitHsl({ h, s: base.s, l: base.l });
    },
    [emitHsl, hsl, hueWidth],
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

  const slMarkerX = (hsl.s / 100) * Math.max(slWidth, 1);
  const slMarkerY = (1 - hsl.l / 100) * SL_HEIGHT;
  const hueMarkerX = (hsl.h / 360) * Math.max(hueWidth, 1);
  const normalized = normalizeHexColor(value) ?? value;

  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View
      ref={rootRef}
      nativeID={PICKER_NATIVE_ID}
      style={[styles.root, Platform.OS === "web" && styles.rootWeb]}
    >
      <Text style={styles.label}>Saturation & lightness</Text>
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

      <Text style={styles.label}>Hue</Text>
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
              { left: hueMarkerX - 7, backgroundColor: hueColor },
            ]}
          />
        </View>
      </View>

      <View style={styles.previewRow}>
        <View style={[styles.previewSwatch, { backgroundColor: normalized }]} />
        <Text style={styles.previewHex}>{normalized.toUpperCase()}</Text>
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
      color: colors.textMuted,
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
      width: 14,
      height: HUE_HEIGHT - 6,
      borderRadius: 7,
      borderWidth: 2,
      borderColor: "#ffffff",
    },
    previewRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginTop: 4,
    },
    previewSwatch: {
      width: 34,
      height: 34,
      borderRadius: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.panelBorder,
    },
    previewHex: {
      color: colors.textPrimary,
      fontSize: 14,
      fontWeight: "700",
      letterSpacing: 0.4,
    },
  });
}
