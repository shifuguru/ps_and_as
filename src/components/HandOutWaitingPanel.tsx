/**
 * Fills the local hand zone after the player is out mid-round:
 * waiting entertainment + optional AdSense display banner (web).
 */
import React, { useEffect, useId, useMemo, useState } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { useAppTheme } from "../context/ThemeContext";
import { canLoadPersonalizedAds } from "../services/ads/adsConsent";
import { areForcedAdsRemovedSync } from "../services/ads/adsEntitlement";
import {
  getAdsClientId,
  isAdsPlaceholderMode,
} from "../services/ads/webH5Ads";

const WAITING_LINES = [
  "You’re out — soak up the rest of the round.",
  "Watch the table. Roles are still up for grabs.",
  "Asshole isn’t decided until the last card lands.",
  "Next round’s trades depend on this finish order.",
  "Sip the vibes. Your hand’s done; the drama isn’t.",
  "Scout who’s holding what for next deal.",
];

function getBannerSlotId(): string | null {
  if (Platform.OS !== "web") return null;
  try {
    const fromWindow = (
      globalThis as { __PS_AND_AS_ADSENSE_BANNER_SLOT__?: string }
    ).__PS_AND_AS_ADSENSE_BANNER_SLOT__;
    if (typeof fromWindow === "string" && fromWindow.trim()) {
      return fromWindow.trim();
    }
  } catch {
    // ignore
  }
  const fromEnv = process.env.EXPO_PUBLIC_ADSENSE_BANNER_SLOT?.trim();
  return fromEnv || null;
}

function canShowHandOutBanner(): boolean {
  if (Platform.OS !== "web" || !canLoadPersonalizedAds() || areForcedAdsRemovedSync()) {
    return false;
  }
  if (isAdsPlaceholderMode()) return true;
  return !!getAdsClientId() && !!getBannerSlotId();
}

function isHandOutPlaceholderBanner(): boolean {
  return Platform.OS === "web" && isAdsPlaceholderMode();
}

type Props = {
  /** Same height budget as the card fan zone. */
  height: number;
};

export default function HandOutWaitingPanel({ height }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const reactId = useId().replace(/:/g, "");
  const hostDomId = `ps-hand-out-ad-${reactId}`;
  const [lineIndex, setLineIndex] = useState(0);
  const [showAd, setShowAd] = useState(false);
  const [placeholderBanner, setPlaceholderBanner] = useState(false);

  useEffect(() => {
    const id = setInterval(() => {
      setLineIndex((i) => (i + 1) % WAITING_LINES.length);
    }, 5500);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    setShowAd(canShowHandOutBanner());
    setPlaceholderBanner(isHandOutPlaceholderBanner());
  }, []);

  useEffect(() => {
    if (!showAd || placeholderBanner || Platform.OS !== "web") return;
    const client = getAdsClientId();
    const slot = getBannerSlotId();
    const doc = (globalThis as { document?: Document }).document;
    if (!client || !slot || !doc) return;

    let cancelled = false;
    const timer = setTimeout(() => {
      if (cancelled) return;
      const container = doc.getElementById(hostDomId);
      if (!container) return;
      if (container.getAttribute("data-ps-ad-pushed") === "1") return;
      try {
        container.innerHTML = "";
        const ins = doc.createElement("ins");
        ins.className = "adsbygoogle";
        ins.style.display = "block";
        ins.style.width = "100%";
        ins.style.minHeight = "90px";
        ins.setAttribute("data-ad-client", client);
        ins.setAttribute("data-ad-slot", slot);
        ins.setAttribute("data-ad-format", "horizontal");
        ins.setAttribute("data-full-width-responsive", "true");
        container.appendChild(ins);
        const w = globalThis as { adsbygoogle?: unknown[] };
        w.adsbygoogle = w.adsbygoogle || [];
        w.adsbygoogle.push({});
        container.setAttribute("data-ps-ad-pushed", "1");
      } catch {
        // Entertainment line still shows.
      }
    }, 100);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [showAd, placeholderBanner, hostDomId]);

  return (
    <View
      style={[styles.wrap, { height }]}
      accessibilityLabel="You're out. Waiting for other players."
    >
      <Text style={styles.eyebrow}>Out this round</Text>
      <Text style={styles.line} numberOfLines={2}>
        {WAITING_LINES[lineIndex]}
      </Text>
      {showAd && placeholderBanner ? (
        <View style={styles.placeholderBanner} accessibilityLabel="Ad preview placeholder">
          <Text style={styles.placeholderBadge}>AD PREVIEW</Text>
          <Text style={styles.placeholderTitle}>Sample banner (320×50)</Text>
          <Text style={styles.placeholderHint}>
            Placeholder — real banner after AdSense approval
          </Text>
        </View>
      ) : showAd ? (
        // RN-web honors `id` / nativeID so AdSense can mount into this node.
        <View
          nativeID={hostDomId}
          {...({ id: hostDomId } as Record<string, string>)}
          style={styles.adHost}
        />
      ) : (
        <View style={styles.fillHint}>
          <Text style={styles.fillHintText}>
            Hang tight while the table finishes.
          </Text>
        </View>
      )}
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useAppTheme>["colors"]) {
  return StyleSheet.create({
    wrap: {
      width: "100%",
      paddingHorizontal: 14,
      paddingTop: 8,
      paddingBottom: 4,
      justifyContent: "flex-start",
      gap: 6,
    },
    eyebrow: {
      color: colors.textTertiary,
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 0.8,
      textTransform: "uppercase",
    },
    line: {
      color: colors.textSecondary,
      fontSize: 14,
      fontWeight: "600",
      lineHeight: 19,
      minHeight: 38,
    },
    adHost: {
      flex: 1,
      width: "100%",
      minHeight: 90,
      maxHeight: 120,
      borderRadius: 10,
      overflow: "hidden",
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.panelBorder,
    },
    placeholderBanner: {
      flex: 1,
      minHeight: 90,
      maxHeight: 120,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      justifyContent: "center",
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.panelBorder,
      borderStyle: "dashed",
      gap: 2,
    },
    placeholderBadge: {
      color: colors.textTertiary,
      fontSize: 9,
      fontWeight: "800",
      letterSpacing: 0.8,
      textTransform: "uppercase",
    },
    placeholderTitle: {
      color: colors.textSecondary,
      fontSize: 13,
      fontWeight: "700",
    },
    placeholderHint: {
      color: colors.textTertiary,
      fontSize: 11,
      fontWeight: "600",
      lineHeight: 14,
    },
    fillHint: {
      flex: 1,
      minHeight: 72,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 12,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.panelBorder,
    },
    fillHintText: {
      color: colors.textTertiary,
      fontSize: 13,
      fontWeight: "600",
      textAlign: "center",
    },
  });
}
