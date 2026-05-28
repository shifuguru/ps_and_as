import { Dimensions, ScaledSize } from "react-native";
import { useVisualViewportSize } from "../hooks/useVisualViewportSize";

export const breakpoints = {
  mobile: 480,
  tablet: 768,
  desktop: 1024,
  wide: 1440,
};

// Hook for responsive dimensions that update on orientation / browser chrome changes.
export function useResponsiveDimensions(): ScaledSize {
  return useVisualViewportSize();
}

// Detect device type based on width
export function getDeviceType(width: number) {
  if (width < breakpoints.tablet) return "mobile";
  if (width < breakpoints.desktop) return "tablet";
  if (width < breakpoints.wide) return "desktop";
  return "wide";
}

// Check if in landscape orientation
export function isLandscape(width: number, height: number): boolean {
  return width > height;
}

function clampWidth(width: number) {
  return Math.min(width, 1400);
}

/**
 * Scale a value based on screen width
 * @param mobile Value for mobile (< 768px)
 * @param tablet Value for tablet (768-1024px)
 * @param desktop Value for desktop (1024-1440px)
 * @param wide Value for wide (>= 1440px)
 */
export function scale(
  mobile: number,
  tablet?: number,
  desktop?: number,
  wide?: number
): number {
  const width = clampWidth(Dimensions.get("window").width);
  
  if (width < breakpoints.tablet) return mobile;
  if (width < breakpoints.desktop) return tablet ?? mobile;
  if (width < breakpoints.wide) return desktop ?? tablet ?? mobile;
  return wide ?? desktop ?? tablet ?? mobile;
}

/**
 * Adaptive scale based on screen width with landscape adjustment
 */
export function adaptiveScale(
  baseValue: number,
  width: number,
  height: number,
): number {
  const isLand = isLandscape(width, height);
  
  // For landscape iPad, reduce vertical spacing but maintain horizontal
  if (isLand && width > 768) {
    return baseValue * 0.78; // stronger reduction for landscape/tablet
  }
  
  return baseValue;
}

export const responsive = {
  // Font sizes - adaptive per device
  fontSize: {
    xs: scale(10, 11, 12, 13),
    sm: scale(12, 13, 14, 15),
    base: scale(14, 15, 16, 17),
    lg: scale(16, 17, 18, 20),
    xl: scale(18, 20, 22, 24),
    "2xl": scale(20, 22, 24, 28),
    "3xl": scale(24, 26, 28, 32),
  },

  // Spacing - more aggressive for landscape
  spacing: {
    xs: scale(4, 4, 6, 8),
    sm: scale(6, 8, 10, 12),
    md: scale(8, 10, 12, 16),
    lg: scale(12, 14, 16, 20),
    xl: scale(16, 20, 24, 28),
    "2xl": scale(20, 24, 32, 40),
  },

  // Component heights - scale down for landscape
  buttonHeight: scale(46, 52, 58, 64),
  cardHeight: scale(140, 160, 180, 200),
  bottomBarHeight: scale(200, 220, 240, 260),
  statusBarHeight: scale(80, 100, 120, 140),

  // Padding
  paddingHorizontal: scale(12, 14, 16, 20),
  paddingVertical: scale(8, 10, 12, 16),

  // Border radius
  borderRadius: {
    sm: scale(8, 10, 12, 14),
    md: scale(12, 14, 16, 18),
    lg: scale(16, 18, 20, 24),
    xl: scale(20, 24, 28, 32),
  },

  // Shadow
  shadowRadius: scale(6, 8, 12, 16),
};
