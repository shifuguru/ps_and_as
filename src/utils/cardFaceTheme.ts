export type CardFaceColors = {
  faceBg: string;
  faceBorder: string;
  label: string;
  redSuit: string;
  blackSuit: string;
  joker: string;
  flashBgFrom: string;
  flashBgTo: string;
  flashBorderFrom: string;
  flashBorderTo: string;
  flashLabelFrom: string;
  flashLabelTo: string;
  flashRedSuitTo: string;
  flashBlackSuitTo: string;
  disabledWash: string;
};

export function getCardFaceColors(
  darkMode: boolean,
  disabled = false,
): CardFaceColors {
  if (!darkMode) {
    return {
      faceBg: "#f5f4ef",
      faceBorder: "rgba(0,0,0,0.1)",
      label: disabled ? "#7a7a7a" : "#1a1a1a",
      redSuit: disabled ? "#9a8080" : "#b71c1c",
      blackSuit: disabled ? "#7a7a7a" : "#1a1a1a",
      joker: disabled ? "#7a7a7a" : "#1a1a1a",
      flashBgFrom: "#f5f4ef",
      flashBgTo: "#ffffff",
      flashBorderFrom: "rgba(0,0,0,0.12)",
      flashBorderTo: "rgba(212,175,55,0.85)",
      flashLabelFrom: "#1a1a1a",
      flashLabelTo: "#111111",
      flashRedSuitTo: "#8b0000",
      flashBlackSuitTo: "#333333",
      disabledWash: "rgba(168, 166, 158, 0.38)",
    };
  }

  return {
    faceBg: "#1c1c1e",
    faceBorder: "rgba(255,255,255,0.14)",
    label: disabled ? "#6b6b6b" : "#ececec",
    redSuit: disabled ? "#8f5555" : "#ef5350",
    blackSuit: disabled ? "#6b6b6b" : "#f5f5f5",
    joker: disabled ? "#6b6b6b" : "#ffd54f",
    flashBgFrom: "#1c1c1e",
    flashBgTo: "#2a2a2e",
    flashBorderFrom: "rgba(255,255,255,0.12)",
    flashBorderTo: "rgba(212,175,55,0.85)",
    flashLabelFrom: "#ececec",
    flashLabelTo: "#ffffff",
    flashRedSuitTo: "#ff8a80",
    flashBlackSuitTo: "#ffffff",
    disabledWash: "rgba(0, 0, 0, 0.42)",
  };
}

export function suitColorForCard(
  colors: CardFaceColors,
  suit: string,
  disabled: boolean,
): string {
  if (suit === "hearts" || suit === "diamonds") return colors.redSuit;
  if (suit === "joker") return colors.joker;
  return colors.blackSuit;
}
