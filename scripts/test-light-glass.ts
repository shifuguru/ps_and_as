import assert from "node:assert/strict";

require.extensions[".webp"] = (module) => { module.exports = "felt"; };
const { hexToRgb, hslToHex, mixRgb, relativeLuminance, rgbToHex } =
  require("../src/utils/colorTheory") as typeof import("../src/utils/colorTheory");
const { buildAppTheme } =
  require("../src/styles/feltPalette") as typeof import("../src/styles/feltPalette");

function composite(color: string, background: string): string {
  const match = color.match(/^rgba\(\s*(\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\s*\)$/);
  if (!match) return color;
  const base = hexToRgb(background);
  assert.ok(base);
  return rgbToHex(mixRgb(base, { r: +match[1], g: +match[2], b: +match[3] }, +match[4]));
}

function contrast(a: string, b: string): number {
  const aLum = relativeLuminance(a);
  const bLum = relativeLuminance(b);
  return (Math.max(aLum, bLum) + 0.05) / (Math.min(aLum, bLum) + 0.05);
}

for (let hue = 0; hue < 360; hue += 15) {
  for (const lightness of [12, 24, 60, 85]) {
    const felt = hslToHex(hue, 60, lightness);
    const light = buildAppTheme(felt, "light", "auto");
    const dark = buildAppTheme(felt, "dark", "auto");
    for (const key of ["chrome", "panel", "modal"] as const) {
      const preset = light.blur[key];
      assert.equal(preset.intensity, dark.blur[key].intensity);
      assert.ok(preset.webOpacity <= 0.78);
      assert.ok(preset.scrimOpacity <= 0.78);
      for (const background of ["#000000", "#ffffff"]) {
        const glass = composite(`rgba(${light.frostRgb}, ${preset.webOpacity})`, background);
        for (const text of [light.textPrimary, light.textSecondary, light.textTertiary, light.accent]) {
          const ratio = contrast(composite(text, glass), glass);
          assert.ok(ratio >= 4.5, `${key}: ${text} on ${glass}: ${ratio.toFixed(2)}`);
        }
      }
    }
    for (const fill of [light.inputBg, light.btnSecondaryBg, light.actionTrackBg, light.actionSecondaryBg, light.leaveButtonBg]) {
      for (const background of ["#000000", "#ffffff"]) {
        const surface = composite(fill, background);
        const ratio = contrast(light.textPrimary, surface);
        assert.ok(ratio >= 4.5, `${light.textPrimary} on ${surface}: ${ratio.toFixed(2)}`);
      }
    }
  }
}

console.log("test-light-glass: opacity, blur strength and contrast passed");
