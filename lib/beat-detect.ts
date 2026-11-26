import { promises as fs } from "node:fs";
import { randomUUID } from "node:crypto";
import { bin, run } from "./process";
import { file } from "./store";

export type BeatMarker = {
  time: number;
  strength: number;
};

/** Estimate beats from mono PCM using onset energy peaks. */
export function detectBeats(
  samples: Float32Array,
  sampleRate: number,
  duration: number,
): { bpm: number; confidence: number; beats: BeatMarker[] } {
  if (!samples.length || sampleRate < 8000 || duration <= 0)
    return { bpm: 0, confidence: 0, beats: [] };

  const hop = Math.max(1, Math.floor(sampleRate / 100)); // 10 ms
  const window = hop * 4;
  const energies: number[] = [];
  for (let i = 0; i + window < samples.length; i += hop) {
    let sum = 0;
    for (let j = 0; j < window; j++) {
      const v = samples[i + j] || 0;
      sum += v * v;
    }
    energies.push(sum / window);
  }
  if (energies.length < 8) return { bpm: 0, confidence: 0, beats: [] };

  const flux: number[] = [0];
  for (let i = 1; i < energies.length; i++)
    flux.push(Math.max(0, energies[i] - energies[i - 1]));

  const mean = flux.reduce((a, b) => a + b, 0) / flux.length;
  const threshold = mean * 1.6;
  const raw: BeatMarker[] = [];
  for (let i = 1; i < flux.length - 1; i++) {
    if (flux[i] >= threshold && flux[i] >= flux[i - 1] && flux[i] >= flux[i + 1]) {
      const time = (i * hop) / sampleRate;
      if (time > duration) break;
      if (!raw.length || time - raw.at(-1)!.time >= 0.18)
        raw.push({
          time: Math.round(time * 1000) / 1000,
          strength: Math.min(1, flux[i] / (mean * 4 || 1)),
        });
    }
  }

  // Prefer intervals in 60–180 BPM.
  const intervals: number[] = [];
  for (let i = 1; i < raw.length; i++) {
    const dt = raw[i].time - raw[i - 1].time;
    if (dt >= 60 / 180 && dt <= 60 / 60) intervals.push(dt);
  }
  if (!intervals.length)
    return { bpm: 0, confidence: 0, beats: raw.slice(0, 240) };

  intervals.sort((a, b) => a - b);
  const median = intervals[Math.floor(intervals.length / 2)];
  const bpm = Math.round((60 / median) * 10) / 10;
  const consistent = intervals.filter(
    (dt) => Math.abs(dt - median) / median < 0.12,
  ).length;
  const confidence = Math.min(1, consistent / Math.max(1, intervals.length));
  return { bpm, confidence, beats: raw.slice(0, 240) };
}

export async function analyzeProjectBeats(
  project: string,
  signal?: AbortSignal,
) {
  const source = file("uploads", project, "mp4");
  const id = randomUUID();
  const pcm = file("temp", id, "f32le");
  try {
    await run(
      bin.ffmpeg,
      [
        "-hide_banner",
        "-y",
        "-i",
        source,
        "-ac",
        "1",
        "-ar",
        "22050",
        "-f",
        "f32le",
        pcm,
      ],
      signal,
    );
    const buf = await fs.readFile(pcm);
    const samples = new Float32Array(
      buf.buffer,
      buf.byteOffset,
      Math.floor(buf.byteLength / 4),
    );
    const duration = samples.length / 22050;
    return detectBeats(samples, 22050, duration);
  } finally {
    await fs.rm(pcm, { force: true });
  }
}

export function snapToBeats(
  time: number,
  beats: BeatMarker[],
  threshold = 0.12,
) {
  let best = time,
    delta = threshold;
  for (const beat of beats) {
    const d = Math.abs(beat.time - time);
    if (d < delta) {
      delta = d;
      best = beat.time;
    }
  }
  return best;
}
