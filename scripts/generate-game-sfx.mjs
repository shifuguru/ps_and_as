/**
 * Generate lightweight PCM WAV SFX for card play / turn cues.
 * These are procedural placeholders — paper/felt flavored, not final assets.
 * Run: node scripts/generate-game-sfx.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "..", "assets", "sounds");

const SAMPLE_RATE = 22050;

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function writeWav(filename, samples) {
  const numSamples = samples.length;
  const dataSize = numSamples * 2;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(1, 22); // mono
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);
  for (let i = 0; i < numSamples; i += 1) {
    const s = clamp(Math.round(samples[i] * 32767), -32768, 32767);
    buffer.writeInt16LE(s, 44 + i * 2);
  }
  const outPath = path.join(OUT, filename);
  fs.writeFileSync(outPath, buffer);
  console.log(`wrote ${filename} (${(buffer.length / 1024).toFixed(1)} KB)`);
}

function env(durationSec, fn) {
  const n = Math.floor(SAMPLE_RATE * durationSec);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i += 1) {
    const t = i / SAMPLE_RATE;
    out[i] = fn(t, i / n);
  }
  return out;
}

function mix(...parts) {
  const len = Math.max(...parts.map((p) => p.length));
  const out = new Float32Array(len);
  for (const p of parts) {
    for (let i = 0; i < p.length; i += 1) out[i] += p[i];
  }
  let peak = 0;
  for (let i = 0; i < len; i += 1) peak = Math.max(peak, Math.abs(out[i]));
  if (peak > 1) {
    for (let i = 0; i < len; i += 1) out[i] /= peak;
  }
  return out;
}

/** Soft low body — felt/thud, not a pure beep. */
function thud(duration, gain, freq = 95) {
  return env(duration, (t) => {
    const e = Math.exp(-t / (duration * 0.28));
    // Slight pitch drop + noise grit so it reads as contact, not a tone.
    const f = freq * (1 - t * 1.8);
    const body = Math.sin(2 * Math.PI * f * t);
    const grit = (Math.random() * 2 - 1) * 0.35;
    return (body * 0.75 + grit * 0.25) * gain * e;
  });
}

/** Band-limited-ish paper noise (high-passed random). */
function paperNoise(duration, gain, decay = 0.03) {
  let prev = 0;
  return env(duration, (t) => {
    const white = Math.random() * 2 - 1;
    // Simple high-pass / crackle
    const hp = white - prev;
    prev = white * 0.85;
    const e = Math.exp(-t / decay);
    return hp * gain * e;
  });
}

/** Short air flutter for cards leaving the hand / traveling. */
function flutterWhoosh(duration, gain) {
  return env(duration, (t, p) => {
    const sweep = 1800 - p * 1100;
    const vibr = Math.sin(2 * Math.PI * 28 * t) * 0.15;
    const noise = Math.random() * 2 - 1;
    const tone = Math.sin(2 * Math.PI * sweep * t) * 0.12;
    const shape = Math.sin(Math.PI * Math.min(1, p * 1.15)) ** 1.4;
    return (noise * 0.7 + tone + vibr * noise) * gain * shape;
  });
}

// Soft paper tap — card select (avoid high sine “beep”)
writeWav(
  "card_select.wav",
  mix(paperNoise(0.04, 0.28, 0.01), thud(0.05, 0.1, 140)),
);

// Single card throw / travel toward the pile — hard attack so it reads at throw,
// not as a late whoosh that gets mistaken for card_land.
writeWav(
  "card_play.wav",
  mix(
    paperNoise(0.035, 0.32, 0.01),
    thud(0.06, 0.2, 125),
    flutterWhoosh(0.12, 0.16),
  ),
);

// Multiple cards together — staggered flutters with an immediate attack
writeWav(
  "card_play_multi.wav",
  mix(
    paperNoise(0.04, 0.28, 0.012),
    thud(0.07, 0.18, 115),
    flutterWhoosh(0.14, 0.16),
    (() => {
      const a = paperNoise(0.06, 0.14, 0.016);
      const b = paperNoise(0.06, 0.12, 0.018);
      const out = new Float32Array(Math.floor(SAMPLE_RATE * 0.18));
      const delay = Math.floor(SAMPLE_RATE * 0.035);
      for (let i = 0; i < a.length; i += 1) out[i] += a[i];
      for (let i = 0; i < b.length; i += 1) out[i + delay] += b[i];
      return out;
    })(),
  ),
);

// Soft land / drop onto the pile
writeWav(
  "card_land.wav",
  mix(thud(0.1, 0.22, 85), paperNoise(0.055, 0.14, 0.016)),
);

// Pass — soft descending air cue (still tonal, but quieter + noisier)
writeWav(
  "pass.wav",
  mix(
    paperNoise(0.1, 0.08, 0.05),
    env(0.16, (t, p) => {
      const f = 340 - p * 120;
      const e = Math.exp(-t / 0.07);
      return Math.sin(2 * Math.PI * f * t) * 0.09 * e;
    }),
  ),
);

// Local turn start — soft double felt tap (no pitched chime / IM beep).
writeWav(
  "turn_start.wav",
  (() => {
    const n = Math.floor(SAMPLE_RATE * 0.18);
    const out = new Float32Array(n);
    const tap = (atSec, gain) => {
      const start = Math.floor(SAMPLE_RATE * atSec);
      // Broadband contact only — avoid sine “ding” partials.
      const paper = paperNoise(0.05, gain, 0.012);
      const body = thud(0.055, gain * 0.55, 90);
      for (let i = 0; i < paper.length && start + i < n; i += 1) {
        out[start + i] += paper[i];
      }
      for (let i = 0; i < body.length && start + i < n; i += 1) {
        out[start + i] += body[i] * 0.65;
      }
    };
    tap(0.0, 0.28);
    tap(0.05, 0.18);
    return mix(out);
  })(),
);

// Deal flap
writeWav(
  "card_deal.wav",
  mix(flutterWhoosh(0.07, 0.16), paperNoise(0.05, 0.14, 0.012)),
);

// Trick / pile clear — scrape + soft gather
writeWav(
  "pile_clear.wav",
  mix(
    flutterWhoosh(0.18, 0.14),
    paperNoise(0.14, 0.16, 0.05),
    thud(0.16, 0.12, 70),
  ),
);

// Keep menu click usable — short tick, not a beep
writeWav(
  "button_click.wav",
  mix(paperNoise(0.025, 0.2, 0.006), thud(0.03, 0.08, 220)),
);

console.log("game SFX generation complete");
