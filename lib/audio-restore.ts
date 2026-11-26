import { promises as fs } from "node:fs";
import path from "node:path";
import { uuid } from "./id";
import { bin, run } from "./process";
import { file, workspaceRoot } from "./store";

export type RestoreOp =
  | { op: "highpass"; hz: number }
  | { op: "lowpass"; hz: number }
  | { op: "notch"; hz: number; q?: number }
  | { op: "deesser"; freq?: number; intensity?: number }
  | { op: "compress"; threshold?: number; ratio?: number }
  | { op: "normalize"; targetDb?: number }
  | { op: "noise-gate"; threshold?: number }
  | { op: "equalizer"; f: number; width?: number; gain: number };

export type RestorePlan = {
  version: 1;
  ops: RestoreOp[];
};

export function validateRestorePlan(input: unknown): RestorePlan {
  if (!input || typeof input !== "object") throw Error("Invalid restore plan");
  const plan = input as RestorePlan;
  if (plan.version !== 1 || !Array.isArray(plan.ops) || plan.ops.length > 16)
    throw Error("Unsupported restore plan");
  const ops: RestoreOp[] = [];
  for (const row of plan.ops) {
    if (!row || typeof row !== "object" || !("op" in row))
      throw Error("Invalid restore operation");
    switch (row.op) {
      case "highpass":
      case "lowpass":
        if (!Number.isFinite(row.hz) || row.hz < 20 || row.hz > 20000)
          throw Error("Filter frequency must be 20–20000 Hz");
        ops.push({ op: row.op, hz: row.hz });
        break;
      case "notch":
        if (!Number.isFinite(row.hz) || row.hz < 20 || row.hz > 20000)
          throw Error("Notch frequency invalid");
        ops.push({
          op: "notch",
          hz: row.hz,
          q: Number.isFinite(row.q) ? Math.min(100, Math.max(0.5, row.q!)) : 30,
        });
        break;
      case "deesser":
        ops.push({
          op: "deesser",
          freq: Number.isFinite(row.freq) ? row.freq : 6000,
          intensity: Number.isFinite(row.intensity)
            ? Math.min(1, Math.max(0, row.intensity!))
            : 0.5,
        });
        break;
      case "compress":
        ops.push({
          op: "compress",
          threshold: Number.isFinite(row.threshold) ? row.threshold : 0.125,
          ratio: Number.isFinite(row.ratio) ? row.ratio : 4,
        });
        break;
      case "normalize":
        ops.push({
          op: "normalize",
          targetDb: Number.isFinite(row.targetDb) ? row.targetDb : -16,
        });
        break;
      case "noise-gate":
        ops.push({
          op: "noise-gate",
          threshold: Number.isFinite(row.threshold) ? row.threshold : 0.02,
        });
        break;
      case "equalizer":
        if (
          !Number.isFinite(row.f) ||
          !Number.isFinite(row.gain) ||
          row.f < 20 ||
          row.f > 20000 ||
          row.gain < -24 ||
          row.gain > 24
        )
          throw Error("Invalid EQ band");
        ops.push({
          op: "equalizer",
          f: row.f,
          width: Number.isFinite(row.width) ? row.width : 2,
          gain: row.gain,
        });
        break;
      default:
        throw Error("Unsupported restore operation");
    }
  }
  if (!ops.length) throw Error("Add at least one restoration operation");
  return { version: 1, ops };
}

export function restoreFilters(plan: RestorePlan): string[] {
  const p = validateRestorePlan(plan);
  const filters: string[] = [];
  for (const op of p.ops) {
    switch (op.op) {
      case "highpass":
        filters.push(`highpass=f=${op.hz}`);
        break;
      case "lowpass":
        filters.push(`lowpass=f=${op.hz}`);
        break;
      case "notch":
        filters.push(`bandreject=f=${op.hz}:width_type=q:width=${op.q || 30}`);
        break;
      case "deesser":
        filters.push(
          `equalizer=f=${op.freq || 6000}:t=h:width=2000:g=${-12 * (op.intensity || 0.5)}`,
        );
        break;
      case "compress":
        filters.push(
          `acompressor=threshold=${op.threshold ?? 0.125}:ratio=${op.ratio ?? 4}:attack=20:release=250`,
        );
        break;
      case "normalize":
        filters.push(`loudnorm=I=${op.targetDb ?? -16}:TP=-1.5:LRA=11`);
        break;
      case "noise-gate":
        filters.push(
          `agate=threshold=${op.threshold ?? 0.02}:ratio=2:attack=10:release=100`,
        );
        break;
      case "equalizer":
        filters.push(
          `equalizer=f=${op.f}:t=h:width=${op.width ?? 2}:g=${op.gain}`,
        );
        break;
    }
  }
  return filters;
}

/**
 * Apply restoration filters to project source audio and write a new WAV asset.
 * Clearly a conventional attempt — not guaranteed recovery.
 */
/** FFmpeg spectrogram still for the first window of the source. */
export async function spectrogramPng(
  projectId: string,
  signal: AbortSignal,
) {
  const source = file("uploads", projectId, "mp4");
  await fs.access(source);
  const cache = path.join(
    workspaceRoot(),
    "temp",
    projectId + ".spectrogram.png",
  );
  const tmp = cache + "." + uuid() + ".tmp.png";
  try {
    await run(
      bin.ffmpeg,
      [
        "-y",
        "-t",
        "45",
        "-i",
        source,
        "-lavfi",
        "showspectrumpic=s=640x220:mode=combined:color=intensity:scale=log",
        "-frames:v",
        "1",
        tmp,
      ],
      signal,
    );
    await fs.rename(tmp, cache);
  } finally {
    await fs.rm(tmp, { force: true });
  }
  return cache;
}

export async function applyRestore(
  projectId: string,
  plan: RestorePlan,
  signal: AbortSignal,
) {
  const filters = restoreFilters(plan);
  const source = file("uploads", projectId, "mp4");
  await fs.access(source);
  const id = uuid();
  const dir = path.join(workspaceRoot(), "assets");
  await fs.mkdir(dir, { recursive: true });
  const out = file("assets", id, "wav");
  const tmp = out + "." + uuid() + ".tmp.wav";
  try {
    await run(
      bin.ffmpeg,
      [
        "-y",
        "-i",
        source,
        "-vn",
        "-af",
        filters.join(","),
        "-c:a",
        "pcm_s16le",
        tmp,
      ],
      signal,
    );
    await fs.rename(tmp, out);
  } finally {
    await fs.rm(tmp, { force: true });
  }
  const stat = await fs.stat(out);
  const meta = {
    id,
    name: "Restored audio",
    description:
      "Conventional restoration attempt — not guaranteed recovery. Ops: " +
      plan.ops.map((o) => o.op).join(", "),
    folder: "audio-restore",
    tags: ["restoration", "audio"],
    favorite: false,
    kind: "audio" as const,
    duration: 0,
    audio: true,
    ext: "wav",
    bytes: stat.size,
    usedBy: [] as string[],
  };
  await fs.writeFile(file("assets", id, "json"), JSON.stringify(meta));
  return { asset: meta, filters };
}
