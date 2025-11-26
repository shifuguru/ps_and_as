import React from 'react';
import { View, StyleProp, ViewStyle } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  ignoreHeaderOffset?: boolean;
};

// Header row height defined in theme.headerRow (100). We add the safe-area top inset
// so the content sits below the header regardless of device notch/statusbar.
const HEADER_ROW_HEIGHT = 100;

export default function ScreenContainer({ children, style, ignoreHeaderOffset }: Props) {
  const insets = useSafeAreaInsets();
  const paddingTop = ignoreHeaderOffset ? 0 : insets.top + HEADER_ROW_HEIGHT;

  // Do not apply a solid background here so any app-level wallpaper remains visible.
  return (
    <SafeAreaView style={[{ flex: 1, paddingTop, backgroundColor: 'transparent' }, style as any]}>
      <View style={{ flex: 1 }}>{children}</View>
    </SafeAreaView>
  );
}
