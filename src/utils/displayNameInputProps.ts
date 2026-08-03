import { Platform, type TextInputProps } from "react-native";

type WebIgnoreProps = {
  name?: string;
  id?: string;
  "data-1p-ignore"?: boolean;
  "data-lpignore"?: string;
  "data-bwignore"?: string;
  "data-form-type"?: string;
};

/**
 * Keep display-name fields from being treated as username/password by
 * iOS Keychain, Chrome, 1Password, LastPass, Bitwarden, etc.
 */
export function getDisplayNameInputProps(
  fieldId = "ps-and-as-display-name",
): Partial<TextInputProps> & WebIgnoreProps {
  return {
    autoCapitalize: "words",
    autoCorrect: false,
    spellCheck: false,
    textContentType: Platform.OS === "ios" ? "nickname" : "none",
    autoComplete: Platform.OS === "web" ? "nickname" : "off",
    importantForAutofill: "no",
    passwordRules: Platform.OS === "ios" ? "" : undefined,
    keyboardType: Platform.OS === "ios" ? "ascii-capable" : "default",
    ...(Platform.OS === "web"
      ? {
          name: fieldId,
          id: fieldId,
          autoComplete: "nickname",
          "data-1p-ignore": true,
          "data-lpignore": "true",
          "data-bwignore": "true",
          "data-form-type": "other",
        }
      : null),
  };
}
