import { promises as fs } from "node:fs";
import { bin, run } from "../process";
import type { Span } from "./candidates";

/** Source is analysed in fixed chunks; each finished chunk is persisted so work can resume. */
export const CHUNK_SECONDS = 1800;

export type AudioChunk = { rmsDb: number[]; peakDb: number[]; silences: Span[] };
export type VisualChunk = { motion: number[]; cuts: number[] };

const num = (s: string) => (/inf/i.test(s) ? -120 : Math.max(-120, Number(s)));

/** Parse ametadata/silencedetect output lines. Exported for tests. */
export function parseAudioLines(lines: Iterable<string>, chunkStart: number, bins: number): AudioChunk {
  const rmsDb = new Array<number>(bins).fill(-120);
  const peakDb = new Array<number>(bins).fill(-120);
  const silences: Span[] = [];
  let frame = 0;
  let open: number | null = null;
  for (const line of lines) {
    const f = line.match(/^frame:\s*(\d+)/);
    if (f) frame = Number(f[1]);
    const r = line.match(/Overall\.RMS_level=(\S+)/);
    if (r && frame < bins) rmsDb[frame] = num(r[1]);
    const k = line.match(/Overall\.Peak_level=(\S+)/);
    if (k && frame < bins) peakDb[frame] = num(k[1]);
    const ss = line.match(/silence_start:\s*(-?[\d.]+)/);
    if (ss) open = chunkStart + Math.max(0, Number(ss[1]));
    const se = line.match(/silence_end:\s*(-?[\d.]+)/);
    if (se && open !== null) {
      silences.push({ start: open, end: chunkStart + Number(se[1]) });
      open = null;
    }
  }
  return { rmsDb, peakDb, silences };
}

export async function analyzeAudioChunk(
  source: string,
  start: number,
  length: number,
  interval: number,
  signal: AbortSignal,
): Promise<AudioChunk> {
  const bins = Math.ceil(length / interval);
  const rate = 16000;
  const lines: string[] = [];
  const keep = /^frame:|Overall\.(RMS|Peak)_level|silence_(start|end)/;
  await run(
    bin.ffmpeg,
    [
      "-hide_banner", "-nostdin", "-threads", "1",
      "-protocol_whitelist", "file,pipe",
      "-ss", String(start), "-t", String(length), "-i", source,
      "-vn", "-sn", "-dn",
      "-af",
      `aresample=${rate},aformat=channel_layouts=mono,asetnsamples=n=${rate * interval}:p=0,` +
        `astats=metadata=1:reset=1:measure_perchannel=none:measure_overall=RMS_level+Peak_level,` +
        `ametadata=print:file=-,silencedetect=n=-40dB:d=0.4`,
      "-f", "null", "-",
    ],
    signal,
    (line) => {
      if (keep.test(line)) lines.push(line);
    },
    6 * 60 * 60 * 1000,
    1_000_000, // stdout is parsed live; do not retain it
  );
  return parseAudioLines(lines, start, bins);
}

/** Parse metadata=print scene-score output. Exported for tests. */
export function parseSceneLines(lines: Iterable<string>, chunkStart: number, bins: number, interval: number, cutThreshold = 0.3): VisualChunk {
  const sum = new Array<number>(bins).fill(0);
  const count = new Array<number>(bins).fill(0);
  const cuts: number[] = [];
  let t = 0;
  for (const line of lines) {
    const m = line.match(/pts_time:\s*([\d.]+)/);
    if (m) t = Number(m[1]);
    const s = line.match(/lavfi\.scene_score=([\d.]+)/);
    if (!s) continue;
    const score = Number(s[1]);
    const i = Math.min(bins - 1, Math.floor(t / interval));
    sum[i] += score;
    count[i]++;
    if (score >= cutThreshold && cuts.length < 50_000) cuts.push(chunkStart + t);
  }
  return { motion: sum.map((v, i) => (count[i] ? v / count[i] : 0)), cuts };
}

/**
 * Downscaled, 2 fps visual-change measurement. `scene_score` is the frame-difference measure
 * FFmpeg uses for scene detection; its running mean is used as a motion-intensity estimate.
 */
export async function analyzeVisualChunk(
  source: string,
  start: number,
  length: number,
  interval: number,
  signal: AbortSignal,
): Promise<VisualChunk> {
  const bins = Math.ceil(length / interval);
  const lines: string[] = [];
  await run(
    bin.ffmpeg,
    [
      "-hide_banner", "-nostdin", "-threads", "2",
      "-protocol_whitelist", "file,pipe",
      "-ss", String(start), "-t", String(length), "-i", source,
      "-an", "-sn", "-dn",
      "-vf", "fps=2,scale=160:-2:flags=fast_bilinear,select='gte(scene,0)',metadata=print:key=lavfi.scene_score:file=-",
      "-f", "null", "-",
    ],
    signal,
    (line) => {
      if (/^frame:|scene_score/.test(line)) lines.push(line);
    },
    6 * 60 * 60 * 1000,
    1_000_000,
  );
  return parseSceneLines(lines, start, bins, interval);
}

export async function readJson<T>(path: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(path, "utf8")) as T;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw e;
  }
}

export async function writeJsonAtomic(path: string, value: unknown) {
  const tmp = path + ".tmp";
  await fs.writeFile(tmp, JSON.stringify(value));
  await fs.rename(tmp, path);
}
