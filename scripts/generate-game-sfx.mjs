/**
 * Generate lightweight PCM WAV SFX for card play / turn cues.
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

function tone(freq, duration, gain, attack = 0.004, release = 0.04) {
  return env(duration, (t, p) => {
    const a = t < attack ? t / attack : 1;
    const r = p > 1 - release / duration ? (1 - p) / (release / duration) : 1;
    return Math.sin(2 * Math.PI * freq * t) * gain * a * r;
  });
}

function noiseBurst(duration, gain, decay = 0.035) {
  return env(duration, (t) => {
    const e = Math.exp(-t / decay);
    return (Math.random() * 2 - 1) * gain * e;
  });
}

// Soft paper tap — card select
writeWav(
  "card_select.wav",
  mix(noiseBurst(0.045, 0.22, 0.012), tone(920, 0.04, 0.08, 0.001, 0.03)),
);

// Single card play / drop onto table
writeWav(
  "card_play.wav",
  mix(
    noiseBurst(0.09, 0.32, 0.02),
    tone(180, 0.1, 0.22, 0.002, 0.07),
    tone(360, 0.07, 0.1, 0.002, 0.05),
  ),
);

// Multiple cards played together
writeWav(
  "card_play_multi.wav",
  mix(
    noiseBurst(0.12, 0.28, 0.025),
    tone(160, 0.12, 0.2, 0.002, 0.08),
    (() => {
      const a = tone(220, 0.08, 0.12, 0.002, 0.05);
      const b = tone(280, 0.08, 0.1, 0.002, 0.05);
      const out = new Float32Array(Math.floor(SAMPLE_RATE * 0.16));
      const delay = Math.floor(SAMPLE_RATE * 0.035);
      for (let i = 0; i < a.length; i += 1) out[i] += a[i];
      for (let i = 0; i < b.length; i += 1) out[i + delay] += b[i];
      return out;
    })(),
  ),
);

// Pass — soft descending cue
writeWav(
  "pass.wav",
  mix(tone(420, 0.12, 0.14, 0.005, 0.08), tone(280, 0.14, 0.12, 0.02, 0.09)),
);

// Local turn start — distinctive rising two-tone
writeWav(
  "turn_start.wav",
  mix(
    tone(523.25, 0.12, 0.18, 0.004, 0.06), // C5
    (() => {
      const n = Math.floor(SAMPLE_RATE * 0.22);
      const out = new Float32Array(n);
      const delay = Math.floor(SAMPLE_RATE * 0.08);
      const second = tone(659.25, 0.14, 0.2, 0.004, 0.08); // E5
      for (let i = 0; i < second.length; i += 1) out[i + delay] += second[i];
      return out;
    })(),
  ),
);

// Deal flap
writeWav(
  "card_deal.wav",
  mix(noiseBurst(0.055, 0.18, 0.015), tone(640, 0.045, 0.07, 0.001, 0.03)),
);

// Trick / pile clear
writeWav(
  "pile_clear.wav",
  mix(
    noiseBurst(0.14, 0.2, 0.04),
    tone(240, 0.16, 0.1, 0.01, 0.1),
    tone(160, 0.18, 0.08, 0.02, 0.12),
  ),
);

// Keep menu click usable
writeWav(
  "button_click.wav",
  mix(noiseBurst(0.03, 0.15, 0.008), tone(1100, 0.03, 0.1, 0.001, 0.02)),
);

console.log("game SFX generation complete");
