/**
 * Query-enabled viewport diagnostics overlay.
 * Read-only: it does not modify shell or environment geometry.
 */
import React, { useEffect, useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  APP_HEIGHT_VAR,
  APP_SHELL_HEIGHT_VAR,
  APP_SHELL_TOP_VAR,
  WEB_FELT_LAYER_ID,
  isMobileWeb,
} from "../utils/webViewport";
import { isStandaloneWebApp } from "../utils/safariChrome";
import {
  getAppHeightWriteLog,
  isViewportDebugEnabled,
  subscribeAppHeightWrites,
  type AppHeightWriteLog,
} from "./viewportDebug";

declare const window: any;
declare const document: any;
declare const navigator: any;
declare function getComputedStyle(element: any): any;

export type ViewportDiagnostics = {
  capturedAt: string;
  mode: "pwa-standalone" | "browser";
  standalone: boolean;
  mobileWeb: boolean;
  metrics: Record<string, number | string | null>;
  lastAppHeightWrite: AppHeightWriteLog | null;
  appHeightWrites: AppHeightWriteLog[];
  note: string;
};

function measureCssLength(value: string): number | null {
  const probe = document.createElement("div");
  probe.style.position = "fixed";
  probe.style.visibility = "hidden";
  probe.style.pointerEvents = "none";
  probe.style.height = value;
  document.body.appendChild(probe);
  const height = parseFloat(getComputedStyle(probe).height);
  document.body.removeChild(probe);
  return Number.isFinite(height) ? Math.round(height) : null;
}

function boxHeight(id: string): number | null {
  const element = document.getElementById(id);
  return element
    ? Math.round(element.getBoundingClientRect().height)
    : null;
}

function cssVar(name: string): string | null {
  const inline = document.documentElement.style.getPropertyValue(name).trim();
  return (
    inline ||
    getComputedStyle(document.documentElement).getPropertyValue(name).trim() ||
    null
  );
}

export function captureViewportDiagnostics(): ViewportDiagnostics {
  const vv = window.visualViewport;
  const standalone = isStandaloneWebApp();
  const writes = getAppHeightWriteLog();

  return {
    capturedAt: new Date().toISOString(),
    mode: standalone ? "pwa-standalone" : "browser",
    standalone,
    mobileWeb: isMobileWeb(),
    metrics: {
      "window.innerHeight": Math.round(window.innerHeight),
      "window.outerHeight": Math.round(window.outerHeight),
      "window.visualViewport.height": vv ? Math.round(vv.height) : null,
      "window.visualViewport.offsetTop": vv ? Math.round(vv.offsetTop) : null,
      "document.documentElement.clientHeight": Math.round(
        document.documentElement.clientHeight,
      ),
      "document.body.clientHeight": Math.round(document.body.clientHeight),
      "computed 100vh": measureCssLength("100vh"),
      "computed 100dvh": measureCssLength("100dvh"),
      "computed 100svh": measureCssLength("100svh"),
      "computed 100lvh": measureCssLength("100lvh"),
      "env(safe-area-inset-top)": measureCssLength(
        "env(safe-area-inset-top, 0px)",
      ),
      "env(safe-area-inset-bottom)": measureCssLength(
        "env(safe-area-inset-bottom, 0px)",
      ),
      "#root height": boxHeight("root"),
      "application shell --app-height": cssVar(APP_HEIGHT_VAR),
      "application shell --app-shell-h": cssVar(APP_SHELL_HEIGHT_VAR),
      "application shell --app-shell-top": cssVar(APP_SHELL_TOP_VAR),
      "RN App View shell.height":
        window.__PS_RN_SHELL_HEIGHT__ == null
          ? null
          : Math.round(window.__PS_RN_SHELL_HEIGHT__),
      "environment layer #ps-felt-layer height": boxHeight(WEB_FELT_LAYER_ID),
      "screen.height": Math.round(window.screen.height),
      "screen.availHeight": Math.round(window.screen.availHeight),
    },
    lastAppHeightWrite: writes.length ? writes[writes.length - 1] : null,
    appHeightWrites: writes,
    note:
      "App.tsx also sets View height=shell.height from useWebShellLayout→readWebShellHeight. The early index.html script may write --app-height before this diagnostic bundle loads.",
  };
}

function formatDiagnostics(diagnostics: ViewportDiagnostics): string {
  const lines = [
    "PS & AS viewport diagnostics",
    `Captured: ${diagnostics.capturedAt}`,
    `Mode: ${diagnostics.mode}`,
    `Standalone: ${diagnostics.standalone}`,
    "",
    "Metrics",
    ...Object.entries(diagnostics.metrics).map(
      ([key, value]) => `${key}: ${value == null ? "—" : value}`,
    ),
    "",
    "Last --app-height write",
    diagnostics.lastAppHeightWrite
      ? JSON.stringify(diagnostics.lastAppHeightWrite, null, 2)
      : "None captured",
    "",
    "All --app-height writes",
    JSON.stringify(diagnostics.appHeightWrites, null, 2),
    "",
    `Note: ${diagnostics.note}`,
  ];
  return lines.join("\n");
}

async function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}

export default function ViewportDebugOverlay() {
  const [snapshot, setSnapshot] = useState<ViewportDiagnostics | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [copyState, setCopyState] = useState("Copy Diagnostics");

  useEffect(() => {
    if (Platform.OS !== "web" || !isViewportDebugEnabled()) return;

    const refresh = () => setSnapshot(captureViewportDiagnostics());
    refresh();

    window.addEventListener("resize", refresh);
    window.addEventListener("orientationchange", refresh);
    window.visualViewport?.addEventListener("resize", refresh);
    window.visualViewport?.addEventListener("scroll", refresh);
    const interval = window.setInterval(refresh, 1000);
    const unsubscribe = subscribeAppHeightWrites(refresh);

    window.__PS_VIEWPORT_DUMP__ = () => {
      const diagnostics = captureViewportDiagnostics();
      console.table(diagnostics.metrics);
      console.log("[viewport diagnostics]", diagnostics);
      return diagnostics;
    };

    return () => {
      window.removeEventListener("resize", refresh);
      window.removeEventListener("orientationchange", refresh);
      window.visualViewport?.removeEventListener("resize", refresh);
      window.visualViewport?.removeEventListener("scroll", refresh);
      window.clearInterval(interval);
      unsubscribe();
      delete window.__PS_VIEWPORT_DUMP__;
    };
  }, []);

  if (!snapshot) return null;

  const copyDiagnostics = async () => {
    try {
      const current = captureViewportDiagnostics();
      await copyText(formatDiagnostics(current));
      setCopyState("Copied");
      window.setTimeout(() => setCopyState("Copy Diagnostics"), 1500);
    } catch (error) {
      console.error("[viewport diagnostics] copy failed", error);
      setCopyState("Copy failed");
    }
  };

  return (
    <View pointerEvents="box-none" style={styles.host}>
      <View style={styles.toolbar}>
        <Pressable onPress={() => setCollapsed((value) => !value)}>
          <Text style={styles.headerText}>
            viewport debug {collapsed ? "[+]" : "[−]"} |{" "}
            {snapshot.standalone ? "PWA" : "Safari"}
          </Text>
        </Pressable>
        <Pressable onPress={copyDiagnostics} style={styles.copyButton}>
          <Text style={styles.copyText}>{copyState}</Text>
        </Pressable>
      </View>
      {!collapsed ? (
        <ScrollView style={styles.body}>
          {Object.entries(snapshot.metrics).map(([key, value]) => (
            <Text key={key} style={styles.row}>
              <Text style={styles.key}>{key}</Text>
              {"  "}
              <Text style={styles.value}>
                {value == null ? "—" : String(value)}
              </Text>
            </Text>
          ))}
          {snapshot.lastAppHeightWrite ? (
            <Text style={styles.caller}>
              last --app-height write:{" "}
              {snapshot.lastAppHeightWrite.heightPx}px via{" "}
              {snapshot.lastAppHeightWrite.caller}
              {"\n"}chosenBy={snapshot.lastAppHeightWrite.calc.chosenBy}
            </Text>
          ) : null}
          <Text style={styles.hint}>
            console: window.__PS_VIEWPORT_DUMP__()
          </Text>
        </ScrollView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: "fixed" as unknown as "absolute",
    top: 4,
    left: 4,
    right: 4,
    zIndex: 99999,
    maxHeight: "48%",
    maxWidth: 420,
  } as object,
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    backgroundColor: "rgba(0,0,0,0.82)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  headerText: {
    color: "#7dffb3",
    fontSize: 10,
    fontFamily: Platform.OS === "web" ? "ui-monospace, monospace" : undefined,
    fontWeight: "700",
  },
  copyButton: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.38)",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  copyText: {
    color: "#ffffff",
    fontSize: 9,
    fontWeight: "700",
  },
  body: {
    marginTop: 4,
    backgroundColor: "rgba(0,0,0,0.78)",
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
  },
  row: {
    color: "#e8e8e8",
    fontSize: 9,
    lineHeight: 12,
    fontFamily: Platform.OS === "web" ? "ui-monospace, monospace" : undefined,
  },
  key: { color: "#9ecbff" },
  value: { color: "#fff6a8", fontWeight: "700" },
  caller: {
    marginTop: 6,
    color: "#ffb07a",
    fontSize: 9,
    lineHeight: 12,
    fontFamily: Platform.OS === "web" ? "ui-monospace, monospace" : undefined,
  },
  hint: {
    marginTop: 4,
    color: "#888888",
    fontSize: 8,
  },
});
