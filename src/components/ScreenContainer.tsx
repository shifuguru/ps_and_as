import React from 'react';
import { View, StyleProp, ViewStyle, LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  ignoreHeaderOffset?: boolean;
  onLayout?: (event: LayoutChangeEvent) => void;
};

// Header row height defined in theme.headerRow (100). We add the safe-area top inset
// so interactive content sits below the header regardless of device notch/statusbar.
const HEADER_ROW_HEIGHT = 100;

/**
 * Edge-to-edge screen shell.
 *
 * The container always fills the viewport. Safe-area values may pad *content*
 * (e.g. legacy header offset) but must never shrink the visual composition —
 * wallpaper and screen chrome continue under the home indicator / notch.
 */
export default function ScreenContainer({ children, style, ignoreHeaderOffset, onLayout }: Props) {
  const insets = useSafeAreaInsets();
  const paddingTop = ignoreHeaderOffset ? 0 : insets.top + HEADER_ROW_HEIGHT;

  // Never use SafeAreaView here — it shrinks the layout box on all edges and
  // creates the false "footer" band under edge-to-edge wallpaper.
  return (
    <View
      onLayout={onLayout}
      style={[
        {
          flex: 1,
          backgroundColor: "transparent",
          position: "relative",
          paddingTop,
        },
        style as any,
      ]}
    >
      {ignoreHeaderOffset ? children : <View style={{ flex: 1 }}>{children}</View>}
    </View>
  );
}
