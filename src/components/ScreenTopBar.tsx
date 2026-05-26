import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { ui } from "../styles/uiStandards";

type Props = {
  title: string;
  onBack?: () => void;
  backLabel?: string;
};

export default function ScreenTopBar({
  title,
  onBack,
  backLabel = "Leave",
}: Props) {
  return (
    <View style={ui.topBar}>
      {onBack ? (
        <TouchableOpacity
          onPress={onBack}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={ui.topBarSide}
        >
          <Text style={ui.leaveText}>{backLabel}</Text>
        </TouchableOpacity>
      ) : (
        <View style={ui.topBarSide} />
      )}
      <Text style={ui.screenTitle}>{title}</Text>
      <View style={ui.topBarSide} />
    </View>
  );
}
