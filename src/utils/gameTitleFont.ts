import { Platform, type TextStyle } from "react-native";

/** iOS system face used for the game title before bundling. */
export const IOS_GAME_TITLE_FONT = "Snell Roundhand";

/** Bundled roundhand-style script for Android and web (Snell Roundhand is iOS-only). */
export const BUNDLED_GAME_TITLE_FONT = "PinyonScript_400Regular";

export function gameTitleFontFamily(): string {
  return Platform.OS === "ios" ? IOS_GAME_TITLE_FONT : BUNDLED_GAME_TITLE_FONT;
}

/** Match the original MainMenu title styling on iOS. */
export function gameTitleFaceStyle(): Pick<TextStyle, "fontFamily" | "fontStyle"> {
  return Platform.OS === "ios"
    ? { fontFamily: IOS_GAME_TITLE_FONT, fontStyle: "italic" }
    : { fontFamily: BUNDLED_GAME_TITLE_FONT };
}
