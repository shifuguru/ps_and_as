import React from "react";
import { View, StyleSheet } from "react-native";
import Svg, { Path, Circle, Rect, Line } from "react-native-svg";
import { GOLD } from "../styles/themeColors";

type IconName =
  | "plus"
  | "globe"
  | "multiplayer"
  | "shuffle"
  | "person"
  | "trophy"
  | "gear"
  | "ellipsis"
  | "list"
  | "palette";

type Props = {
  name: IconName;
  size?: number;
  color?: string;
};

export default function MenuIcon({ name, size = 20, color = GOLD }: Props) {
  const s = size;
  const c = color;
  const sw = 1.8;

  switch (name) {
    case "plus":
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <Line x1="12" y1="5" x2="12" y2="19" stroke={c} strokeWidth={sw} strokeLinecap="round" />
          <Line x1="5" y1="12" x2="19" y2="12" stroke={c} strokeWidth={sw} strokeLinecap="round" />
        </Svg>
      );
    case "globe":
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <Circle cx="12" cy="12" r="9" stroke={c} strokeWidth={sw} />
          <Path d="M3 12h18" stroke={c} strokeWidth={sw} />
          <Path d="M12 3c2.5 2.5 4 5.5 4 9s-1.5 6.5-4 9" stroke={c} strokeWidth={sw} />
          <Path d="M12 3c-2.5 2.5-4 5.5-4 9s1.5 6.5 4 9" stroke={c} strokeWidth={sw} />
        </Svg>
      );
    case "multiplayer":
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <Circle cx="12" cy="11" r="6.5" stroke={c} strokeWidth={sw} />
          <Path d="M5.5 11h13" stroke={c} strokeWidth={sw} strokeLinecap="round" />
          <Path
            d="M12 4.5c1.8 1.8 2.8 3.9 2.8 6.5s-1 4.7-2.8 6.5"
            stroke={c}
            strokeWidth={sw}
            strokeLinecap="round"
          />
          <Path
            d="M12 4.5c-1.8 1.8-2.8 3.9-2.8 6.5s1 4.7 2.8 6.5"
            stroke={c}
            strokeWidth={sw}
            strokeLinecap="round"
          />
          <Circle cx="5" cy="18" r="1.4" fill={c} />
          <Circle cx="12" cy="20" r="1.4" fill={c} />
          <Circle cx="19" cy="18" r="1.4" fill={c} />
          <Path
            d="M8.2 16.8L10.4 14.8M15.8 16.8l-2.2-2"
            stroke={c}
            strokeWidth={sw * 0.85}
            strokeLinecap="round"
          />
        </Svg>
      );
    case "shuffle":
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <Path d="M16 3h5v5" stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M4 20L21 3" stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M21 16v5h-5" stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M15 15l6 6" stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M4 4l5 5" stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    case "person":
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <Circle cx="12" cy="8" r="4" stroke={c} strokeWidth={sw} />
          <Path d="M4 21c0-4 4-7 8-7s8 3 8 7" stroke={c} strokeWidth={sw} strokeLinecap="round" />
        </Svg>
      );
    case "trophy":
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <Path d="M8 21h8" stroke={c} strokeWidth={sw} strokeLinecap="round" />
          <Path d="M12 17v4" stroke={c} strokeWidth={sw} strokeLinecap="round" />
          <Path d="M7 4h10v6a5 5 0 01-10 0V4z" stroke={c} strokeWidth={sw} strokeLinejoin="round" />
          <Path d="M7 7H4a1 1 0 00-1 1v1a4 4 0 004 4" stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M17 7h3a1 1 0 011 1v1a4 4 0 01-4 4" stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    case "gear":
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <Circle cx="12" cy="12" r="3" stroke={c} strokeWidth={sw} />
          <Path
            d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09a1.65 1.65 0 00-1.08-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 004.68 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06A1.65 1.65 0 0019.32 9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z"
            stroke={c}
            strokeWidth={sw}
            strokeLinejoin="round"
          />
        </Svg>
      );
    case "ellipsis":
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <Circle cx="5" cy="12" r="1.5" fill={c} />
          <Circle cx="12" cy="12" r="1.5" fill={c} />
          <Circle cx="19" cy="12" r="1.5" fill={c} />
        </Svg>
      );
    case "list":
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <Line x1="8" y1="6" x2="21" y2="6" stroke={c} strokeWidth={sw} strokeLinecap="round" />
          <Line x1="8" y1="12" x2="21" y2="12" stroke={c} strokeWidth={sw} strokeLinecap="round" />
          <Line x1="8" y1="18" x2="21" y2="18" stroke={c} strokeWidth={sw} strokeLinecap="round" />
          <Circle cx="4" cy="6" r="1.2" fill={c} />
          <Circle cx="4" cy="12" r="1.2" fill={c} />
          <Circle cx="4" cy="18" r="1.2" fill={c} />
        </Svg>
      );
    case "palette":
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <Path
            d="M12 3a9 9 0 00-1.2 17.9c.6.1 1.1-.4 1.1-1v-1.2c0-.5.3-1 .8-1.2.8-.3 1.3-1.1 1.3-2 0-1.2-1-2.2-2.2-2.2H11c-2.2 0-4-1.8-4-4 0-3.3 2.7-6 6-6z"
            stroke={c}
            strokeWidth={sw}
            strokeLinejoin="round"
          />
          <Circle cx="8.5" cy="10" r="1" fill={c} />
          <Circle cx="12" cy="8" r="1" fill={c} />
          <Circle cx="15.5" cy="10" r="1" fill={c} />
          <Circle cx="10" cy="13.5" r="1" fill={c} />
        </Svg>
      );
    default:
      return <View style={{ width: s, height: s }} />;
  }
}
