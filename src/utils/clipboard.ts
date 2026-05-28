import { Platform } from "react-native";
import * as ExpoClipboard from "expo-clipboard";

export async function copyToClipboard(text: string): Promise<boolean> {
  const trimmed = text.trim();
  if (!trimmed) return false;

  try {
    if (Platform.OS === "web") {
      const nav = globalThis as typeof globalThis & {
        navigator?: { clipboard?: { writeText: (value: string) => Promise<void> } };
      };
      if (nav.navigator?.clipboard?.writeText) {
        await nav.navigator.clipboard.writeText(trimmed);
        return true;
      }
      const doc = globalThis as typeof globalThis & {
        document?: {
          createElement: (tag: string) => {
            value: string;
            style: { position: string; opacity: string };
            select: () => void;
          };
          body: {
            appendChild: (el: unknown) => void;
            removeChild: (el: unknown) => void;
          };
          execCommand: (command: string) => boolean;
        };
      };
      if (doc.document) {
        const el = doc.document.createElement("textarea");
        el.value = trimmed;
        el.style.position = "fixed";
        el.style.opacity = "0";
        doc.document.body.appendChild(el);
        el.select();
        doc.document.execCommand("copy");
        doc.document.body.removeChild(el);
        return true;
      }
    }
    await ExpoClipboard.setStringAsync(trimmed);
    return true;
  } catch {
    return false;
  }
}
