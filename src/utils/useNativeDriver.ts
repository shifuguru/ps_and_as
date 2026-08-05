import { Platform } from "react-native";

/**
 * RN Animated's native driver is unavailable on web and warns on every
 * `useNativeDriver: true` call (floods DevTools). Keep native on iOS/Android.
 */
export const USE_NATIVE_DRIVER = Platform.OS !== "web";
