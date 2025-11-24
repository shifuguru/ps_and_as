import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Image, TouchableOpacity, Alert, TextInput } from "react-native";
import { DEFAULT_WALLPAPER, getWallpaperUri, getWallpaperSource, setWallpaperUri, resetWallpaper, getWallpaperTint, setWallpaperTint, FELT_GREY_ASSET_MARKER } from "../services/wallpaper";
import { styles as theme } from "../styles/theme";
import Header from "../components/Header";

export default function Settings({ onWallpaperChange, onBack }: { onWallpaperChange?: () => void; onBack?: () => void }) {
  const [currentUri, setCurrentUri] = useState<string | null>(null);
  const [currentTint, setCurrentTint] = useState<string | null>(null);
  const [hexInput, setHexInput] = useState<string>("");
  const [previewSource, setPreviewSource] = useState<any>(null);
  const [feltSelected, setFeltSelected] = useState<boolean>(false);

  useEffect(() => {
    (async () => {
      const u = await getWallpaperUri();
      const t = await getWallpaperTint();
      setCurrentTint(t);
      const src = await getWallpaperSource();
      setPreviewSource(src);
      // If no stored uri or the special asset marker is present, treat as felt selected
      if (!u || u === FELT_GREY_ASSET_MARKER) {
        setFeltSelected(true);
        setCurrentUri(null);
      } else {
        setFeltSelected(false);
        setCurrentUri(u);
      }
    })();
  }, []);

  const pickFromDevice = async () => {
    try {
      // dynamic require to avoid bundling image-picker when it's not present
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const ImagePicker = require("expo-image-picker");
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm || perm.status !== "granted") {
        Alert.alert("Permission required", "Access to your photos is required to choose a wallpaper. Please enable Photos access in Settings.");
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
      if (!res || res.cancelled) return;
      const uri = res.uri || (res.assets && res.assets[0] && res.assets[0].uri) || null;
      if (!uri) return;
      await setWallpaperUri(uri as string);
      setCurrentUri(uri as string);
      setFeltSelected(false);
      const src = await getWallpaperSource();
      setPreviewSource(src);
      onWallpaperChange && onWallpaperChange();
    } catch (e) {
      console.warn("Image picker not available or failed:", e);
      Alert.alert("Choose Image", "Enable photo library access in device settings.");
    }
  };

  const handleRevert = async () => {
    await resetWallpaper();
    setCurrentUri(null);
    setCurrentTint(null);
    setFeltSelected(true);
    const src = await getWallpaperSource();
    setPreviewSource(src);
    onWallpaperChange && onWallpaperChange();
  };

  const effectivePreview = previewSource || (currentUri ? { uri: currentUri } : DEFAULT_WALLPAPER);

  // Normalize tint into a color string the platform reliably understands.
  // Prefer 8-digit hex (with alpha). If user provided a 6-digit hex like '#rrggbb'
  // append '99' for semi-transparency. Otherwise fall back to the raw value.
  const overlayColor = (() => {
    if (!currentTint) return null;
    const s = currentTint.trim();
    if (/^#[0-9a-fA-F]{6}$/.test(s)) return s + "99"; // '#rrggbb' -> '#rrggbb99'
    if (/^#[0-9a-fA-F]{8}$/.test(s)) return s; // already has alpha
    return s;
  })();

  const applyFelt = async () => {
    // Use bundled felt asset marker so service can resolve the require
    // Use default (null) to indicate felt texture — service resolves this to the bundled felt image
    await setWallpaperUri(null);
    setCurrentUri(null);
    setFeltSelected(true);
    const src = await getWallpaperSource();
    setPreviewSource(src);
    onWallpaperChange && onWallpaperChange();
  };

  const applyTint = async (hex: string | null) => {
    await setWallpaperTint(hex);
    setCurrentTint(hex);
    setFeltSelected(true);
    onWallpaperChange && onWallpaperChange();
  };

  const presetColors = ["#0f5d2f", "#2f7b9e", "#7b3b2f", "#6a3b8b", "#222222", "#5a8a3d"];

  return (
    <View style={[theme.container, { padding: 20 }]}>
      <Text style={theme.title}>Settings</Text>
      <Text style={{ color: '#ddd', marginTop: 8 }}>App Wallpaper</Text>
      <Header title="Settings" onBack={onBack} />

      <View style={{ marginTop: 12, alignItems: 'center' }}>
        <View style={{ width: 300, height: 180, borderRadius: 8, overflow: 'hidden', backgroundColor: '#111', position: 'relative' }}>
          <Image source={effectivePreview} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
          {/* Overlay felt color when felt is selected (either default or user chose felt) */}
          {feltSelected && overlayColor ? (
            <View
              style={{
                ...StyleSheet.absoluteFillObject,
                backgroundColor: overlayColor,
                // ensure overlay sits above the native image layer on all platforms
                zIndex: 2,
              }}
              pointerEvents="none"
            />
          ) : null}
        </View>
      </View>

      <View style={{ marginTop: 16 }}>
        <TouchableOpacity style={theme.menuButton} onPress={pickFromDevice}>
          <Text style={theme.menuButtonText}>Choose from device</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[theme.menuButton, { marginTop: 8 }]} onPress={applyFelt}>
          <Text style={theme.menuButtonText}>Use felt wallpaper</Text>
        </TouchableOpacity>
        <View style={{ marginTop: 12 }}>
          <Text style={{ color: '#ddd', marginBottom: 8 }}>Felt color</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {presetColors.map((c) => (
              <TouchableOpacity key={c} onPress={() => applyTint(c)} style={{ width: 40, height: 40, backgroundColor: c, marginRight: 8, marginBottom: 8, borderRadius: 4, borderWidth: currentTint === c ? 2 : 0, borderColor: '#fff' }} />
            ))}
          </View>
          <View style={{ flexDirection: 'row', marginTop: 8, alignItems: 'center' }}>
            <TextInput placeholder="#rrggbb" value={hexInput} onChangeText={setHexInput} style={{ flex: 1, height: 40, backgroundColor: '#222', color: '#fff', paddingHorizontal: 8, borderRadius: 6 }} />
            <TouchableOpacity style={[theme.menuButton, { marginLeft: 8 }]} onPress={() => { const v = hexInput.trim(); if (v) applyTint(v); }}>
              <Text style={theme.menuButtonText}>Apply</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={[theme.menuButton, { marginTop: 8 }]} onPress={() => applyTint(null)}>
            <Text style={theme.menuButtonText}>Reset felt color</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={[theme.menuButton, { marginTop: 8 }]} onPress={handleRevert}>
          <Text style={theme.menuButtonText}>Revert to default</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
