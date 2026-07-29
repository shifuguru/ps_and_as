/**
 * Colour engine safe-zone audit
 * Tests every preset + a sweep of custom hues for semantic text contrast.
 *
 * Run:  node --input-type=module < scripts/colour-audit.mjs
 * OR:   node scripts/colour-audit.mjs
 */

// ─── pure JS port of the required colour-theory functions ──────────────────

function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  if (h.length !== 6) return null;
  return {
    r: parseInt(h.slice(0,2), 16),
    g: parseInt(h.slice(2,4), 16),
    b: parseInt(h.slice(4,6), 16),
  };
}

function rgbToHex({r,g,b}) {
  const x = v => clamp(Math.round(v),0,255).toString(16).padStart(2,'0');
  return `#${x(r)}${x(g)}${x(b)}`;
}

function rgbToHsl({r,g,b}) {
  const rn=r/255, gn=g/255, bn=b/255;
  const max=Math.max(rn,gn,bn), min=Math.min(rn,gn,bn), d=max-min;
  let h=0, s=0;
  const l=(max+min)/2;
  if (d) {
    s = d / (1 - Math.abs(2*l - 1));
    if      (max===rn) h = ((gn-bn)/d) % 6;
    else if (max===gn) h = (bn-rn)/d + 2;
    else               h = (rn-gn)/d + 4;
    h *= 60; if (h < 0) h += 360;
  }
  return {h, s:s*100, l:l*100};
}

function hslToRgb({h,s,l}) {
  const sn=clamp(s,0,100)/100, ln=clamp(l,0,100)/100;
  const c=(1-Math.abs(2*ln-1))*sn, x=c*(1-Math.abs(((h/60)%2)-1)), m=ln-c/2;
  let rn=0,gn=0,bn=0;
  if      (h< 60) [rn,gn,bn]=[c,x,0];
  else if (h<120) [rn,gn,bn]=[x,c,0];
  else if (h<180) [rn,gn,bn]=[0,c,x];
  else if (h<240) [rn,gn,bn]=[0,x,c];
  else if (h<300) [rn,gn,bn]=[x,0,c];
  else             [rn,gn,bn]=[c,0,x];
  return {r:(rn+m)*255, g:(gn+m)*255, b:(bn+m)*255};
}

function hslToHex(h,s,l) { return rgbToHex(hslToRgb({h,s,l})); }

function mixRgb(base,ov,a) {
  return {r:base.r*(1-a)+ov.r*a, g:base.g*(1-a)+ov.g*a, b:base.b*(1-a)+ov.b*a};
}

function hexToRgba(hex, alpha) {
  const rgb = hexToRgb(hex);
  if (!rgb) return `rgba(0,0,0,${alpha})`;
  return `rgba(${Math.round(rgb.r)},${Math.round(rgb.g)},${Math.round(rgb.b)},${alpha})`;
}

function relativeLuminance(hex) {
  const rgb = hexToRgb(hex); if (!rgb) return 0;
  const ch = v => { const n=v/255; return n<=0.03928?n/12.92:((n+0.055)/1.055)**2.4; };
  return 0.2126*ch(rgb.r) + 0.7152*ch(rgb.g) + 0.0722*ch(rgb.b);
}

function contrastRatio(hexA, hexB) {
  const la = relativeLuminance(hexA), lb = relativeLuminance(hexB);
  const lighter = Math.max(la,lb), darker = Math.min(la,lb);
  return (lighter + 0.05) / (darker + 0.05);
}

// Composite rgba() string over a solid background hex, return composited hex.
function compositeOnBg(rgbaStr, bgHex) {
  // Parse rgba string
  const m = rgbaStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (!m) return rgbaStr; // already a hex, use as-is (no alpha)
  const fg = {r:+m[1], g:+m[2], b:+m[3]};
  const alpha = m[4] !== undefined ? +m[4] : 1;
  const bg = hexToRgb(bgHex) || {r:255,g:255,b:255};
  return rgbToHex(mixRgb(bg, fg, alpha));
}

// ─── replicate feltPalette colour generation ──────────────────────────────

const DEFAULT_HUE = rgbToHsl(hexToRgb('#0f5132')).h; // 145°

function derivePalette(feltHex) {
  const felt = hexToRgb(feltHex);
  const parsed = rgbToHsl(felt);
  const feltHue = parsed.s < 0.5 ? DEFAULT_HUE : parsed.h;
  const feltSat = parsed.s;
  const feltLight = parsed.l;

  const accentSat = clamp(feltSat * 0.72, 22, 68);
  const complementDim = hslToHex(feltHue, clamp(feltSat*0.85,28,72), clamp(feltLight+14,28,42));
  const complement    = hslToHex(feltHue, accentSat,                  clamp(feltLight+32,46,58));
  const complementBright = hslToHex(feltHue, clamp(accentSat*0.82,18,55), clamp(feltLight+54,68,82));
  return {feltHue, complement, complementBright, complementDim};
}

function shellNeutral(mode, feltHue) {
  return hslToRgb({h:feltHue, s:mode==='dark'?6:12, l:mode==='dark'?97:7});
}

// Glass surface background approximations for contrast testing.
// Real glass = frostRgb * opacity over felt. For audit: use simplified composites.
function glassBackground(mode, feltHue) {
  if (mode === 'dark') {
    // Dark glass: dark frost composited. Use ~l=10 tinted.
    return hslToHex(feltHue, 20, 9);
  } else {
    // Light glass: ~l=92 ivory tinted by hue at low opacity over a mid-grey felt.
    return hslToHex(feltHue, 8, 91);
  }
}

function buildAccent(mode, palette) {
  return mode === 'dark' ? palette.complementBright : palette.complement;
}

// ─── test harness ─────────────────────────────────────────────────────────

// WCAG thresholds
const PASS_NORMAL   = 4.5; // AA normal text
const PASS_LARGE    = 3.0; // AA large text (18pt+)
const PASS_ACCENT   = 3.0; // accent used as meaningful text (eyebrows ~11pt bold)
const WARN_TERTIARY = 2.5; // tertiary/de-emphasised — should be intentionally lower but not invisible

const PRESETS = [
  '#0f5132', // Casino Green (default)
  '#6b1c23', // Baccarat Red
  '#1e3a5f', // Tournament Blue
  '#2a2a2a', // Charcoal
  '#4a2352', // Royal Purple
  '#5a8a3d', // Olive Green
];

// Custom sweep: full 360° hue spectrum, moderate saturation/lightness (typical picker output)
const CUSTOM_SWEEP = [];
for (let h = 0; h < 360; h += 15) {
  // Dark saturated (typical custom pick)
  CUSTOM_SWEEP.push(hslToHex(h, 60, 24));
  // Light saturated (edge case)
  CUSTOM_SWEEP.push(hslToHex(h, 55, 60));
  // Very dark near-black
  CUSTOM_SWEEP.push(hslToHex(h, 40, 12));
  // Near-white
  CUSTOM_SWEEP.push(hslToHex(h, 20, 85));
}

// Add near-achromatic edge cases
CUSTOM_SWEEP.push('#111111', '#222222', '#444444', '#888888', '#cccccc', '#eeeeee');
// Saturated reds, yellows (yellow can be problematic for contrast)
CUSTOM_SWEEP.push('#cc0000', '#ff6600', '#ffcc00', '#00cc44', '#0044cc', '#8800cc');

const ALL_FELTS = [...PRESETS, ...CUSTOM_SWEEP];

const failures = [];
const warnings = [];

for (const feltHex of ALL_FELTS) {
  const palette = derivePalette(feltHex);

  for (const mode of ['light', 'dark']) {
    const inkRgb = shellNeutral(mode, palette.feltHue);
    const inkHex = rgbToHex(inkRgb);
    const bg = glassBackground(mode, palette.feltHue);
    const accent = buildAccent(mode, palette);
    const isDark = mode === 'dark';

    // textPrimary contrast (solid)
    const primaryContrast = contrastRatio(inkHex, bg);
    if (primaryContrast < PASS_NORMAL) {
      failures.push({ feltHex, mode, role:'textPrimary', color:inkHex, bg, contrast:primaryContrast.toFixed(2) });
    }

    // textSecondary (composited)
    const secAlpha = isDark ? 0.88 : 0.78;
    const secComp = compositeOnBg(hexToRgba(inkHex, secAlpha), bg);
    const secContrast = contrastRatio(secComp, bg);
    if (secContrast < PASS_NORMAL) {
      failures.push({ feltHex, mode, role:'textSecondary', color:secComp, bg, contrast:secContrast.toFixed(2) });
    }

    // textTertiary (composited — intentionally lower, but still warn if below threshold)
    const terAlpha = isDark ? 0.62 : 0.60;
    const terComp = compositeOnBg(hexToRgba(inkHex, terAlpha), bg);
    const terContrast = contrastRatio(terComp, bg);
    if (terContrast < WARN_TERTIARY) {
      warnings.push({ feltHex, mode, role:'textTertiary', color:terComp, bg, contrast:terContrast.toFixed(2), note:'Below 2.5 — may be invisible' });
    }

    // accent used as text (eyebrows, XP labels, etc.)
    const accentContrast = contrastRatio(accent, bg);
    if (accentContrast < PASS_ACCENT) {
      failures.push({ feltHex, mode, role:'accent(gold)/text', color:accent, bg, contrast:accentContrast.toFixed(2) });
    }
  }
}

console.log('=== COLOUR ENGINE SAFE-ZONE AUDIT ===');
console.log(`Felts tested: ${ALL_FELTS.length} (6 presets + ${CUSTOM_SWEEP.length} custom sweep)`);
console.log(`Modes: light + dark  →  ${ALL_FELTS.length * 2} total combinations`);
console.log('');

if (failures.length === 0) {
  console.log('✅ NO CONTRAST FAILURES (primary, secondary, accent)');
} else {
  console.log(`❌ ${failures.length} CONTRAST FAILURES:`);
  for (const f of failures) {
    console.log(`  [${f.mode.padEnd(5)} ${f.role.padEnd(22)}] felt=${f.feltHex}  color=${f.color}  bg=${f.bg}  CR=${f.contrast}`);
  }
}
console.log('');

if (warnings.length === 0) {
  console.log('✅ NO TERTIARY LEGIBILITY WARNINGS');
} else {
  console.log(`⚠️  ${warnings.length} TERTIARY WARNINGS (intentionally lower, but may be invisible):`);
  // Only print the first 20 to avoid clutter
  for (const w of warnings.slice(0,20)) {
    console.log(`  [${w.mode.padEnd(5)} ${w.role.padEnd(22)}] felt=${w.feltHex}  color=${w.color}  bg=${w.bg}  CR=${w.contrast}`);
  }
  if (warnings.length > 20) console.log(`  ... and ${warnings.length - 20} more`);
}

// ─── accent text vs decorative distinction analysis ───────────────────────
console.log('\n=== ACCENT TEXT vs DECORATIVE ANALYSIS ===');
console.log('accent (colors.gold) used as TEXT in: panelEyebrow, btnGoldText, actionPrimaryText,');
console.log('  leaveText, modalTitle, careerXp, goalSub accent, badge text on gold bg (textOnGold).');
console.log('accent used as DECORATIVE in: gold ring fills, swatch borders, seat badge bg, etc.');
console.log('');

// Check accent on gold bg (textOnGold = #FFFFFF always)
console.log('textOnGold (#ffffff) contrast against accent (gold bg):');
for (const feltHex of PRESETS) {
  for (const mode of ['light','dark']) {
    const palette = derivePalette(feltHex);
    const accent = buildAccent(mode, palette);
    const cr = contrastRatio('#ffffff', accent).toFixed(2);
    const flag = cr < 4.5 ? '❌' : '✅';
    const {l: aL} = rgbToHsl(hexToRgb(accent));
    console.log(`  ${flag} [${mode}] ${feltHex}: accent=${accent} L=${aL.toFixed(0)}  white-on-accent CR=${cr}`);
  }
}

// ─── worst-case summary ────────────────────────────────────────────────────
console.log('\n=== WORST-CASE CONTRAST SUMMARY (presets) ===');
for (const feltHex of PRESETS) {
  for (const mode of ['light','dark']) {
    const palette = derivePalette(feltHex);
    const inkHex = rgbToHex(shellNeutral(mode, palette.feltHue));
    const bg = glassBackground(mode, palette.feltHue);
    const accent = buildAccent(mode, palette);
    const terAlpha = mode === 'dark' ? 0.62 : 0.60;
    const terComp = compositeOnBg(hexToRgba(inkHex, terAlpha), bg);
    console.log(`  [${mode.padEnd(5)}] ${feltHex}: primary CR=${contrastRatio(inkHex,bg).toFixed(1)}  tertiary CR=${contrastRatio(terComp,bg).toFixed(1)}  accent CR=${contrastRatio(accent,bg).toFixed(1)}`);
  }
}
