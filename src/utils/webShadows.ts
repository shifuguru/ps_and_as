import { Platform, type TextStyle, type ViewStyle } from "react-native";

type ShadowSpec = {
  color: string;
  offsetX?: number;
  offsetY?: number;
  blur?: number;
  opacity?: number;
};

function rgbaFromHex(color: string, opacity: number): string {
  const raw = color.trim();
  if (raw.startsWith("rgba") || raw.startsWith("rgb")) return raw;
  const hex = raw.replace("#", "");
  if (hex.length === 3) {
    const r = parseInt(hex[0] + hex[0], 16);
    const g = parseInt(hex[1] + hex[1], 16);
    const b = parseInt(hex[2] + hex[2], 16);
    return `rgba(${r},${g},${b},${opacity})`;
  }
  if (hex.length >= 6) {
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${opacity})`;
  }
  return color;
}

/** Web-safe view shadow — avoids deprecated shadow* props on react-native-web. */
export function viewShadow(spec: ShadowSpec): ViewStyle {
  const x = spec.offsetX ?? 0;
  const y = spec.offsetY ?? 4;
  const blur = spec.blur ?? 8;
  const opacity = spec.opacity ?? 0.25;
  if (Platform.OS === "web") {
    return {
      boxShadow: `${x}px ${y}px ${blur}px ${rgbaFromHex(spec.color, opacity)}`,
    } as ViewStyle;
  }
  return {
    shadowColor: spec.color,
    shadowOffset: { width: x, height: y },
    shadowOpacity: opacity,
    shadowRadius: blur,
  };
}

/** Web-safe text shadow — avoids deprecated textShadow* props on web. */
export function textShadowStyle(spec: {
  color: string;
  offsetX?: number;
  offsetY?: number;
  blur?: number;
}): TextStyle {
  const x = spec.offsetX ?? 0;
  const y = spec.offsetY ?? 1;
  const blur = spec.blur ?? 2;
  if (Platform.OS === "web") {
    return {
      textShadow: `${x}px ${y}px ${blur}px ${spec.color}`,
    } as TextStyle;
  }
  return {
    textShadowColor: spec.color,
    textShadowOffset: { width: x, height: y },
    textShadowRadius: blur,
  };
}
