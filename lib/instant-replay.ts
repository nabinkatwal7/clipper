import { promises as fs } from "node:fs";
import { uuid } from "./id";
import { asset, type Asset } from "./assets";
import { bin, run } from "./process";
import { file } from "./store";

/** Bounded replay buffer lengths from the Recording Studio brief. */
export const REPLAY_SECONDS = [15, 30, 60, 90, 180, 300] as const;
export type ReplaySeconds = (typeof REPLAY_SECONDS)[number];

export function validateReplaySeconds(input: unknown): ReplaySeconds {
  const n = Number(input);
  if (!REPLAY_SECONDS.includes(n as ReplaySeconds))
    throw Error("Choose a replay length of 15–300 seconds (supported steps only).");
  return n as ReplaySeconds;
}

/** Inclusive media window around a bookmark, clamped to [0, duration]. */
export function bookmarkWindow(
  at: number,
  before: number,
  after: number,
  mediaDuration: number,
): { start: number; end: number } {
  if (
    !Number.isFinite(at) ||
    !Number.isFinite(before) ||
    !Number.isFinite(after) ||
    !Number.isFinite(mediaDuration) ||
    at < 0 ||
    before < 0 ||
    after < 0 ||
    mediaDuration < 0
  )
    throw Error("Invalid bookmark window");
  const start = Math.max(0, at - before);
  const end = Math.min(mediaDuration, Math.max(start + 0.25, at + after));
  if (end - start > 300) throw Error("Replay window cannot exceed 5 minutes");
  return { start: Math.round(start * 1000) / 1000, end: Math.round(end * 1000) / 1000 };
}

/**
 * Stream-copy a time range from an existing asset into a new video asset.
 * Not frame-accurate when keyframes are sparse — same honesty as fast lossless cuts.
 */
export async function cutAssetReplay(
  assetId: string,
  start: number,
  end: number,
  signal?: AbortSignal,
): Promise<Asset> {
  const source = await asset(assetId);
  if (source.kind !== "video") throw Error("Replay extract needs a video asset");
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start)
    throw Error("Invalid extract range");
  if (end - start > 300) throw Error("Replay extract limited to 5 minutes");
  if (start < 0 || (source.duration && end > source.duration + 1))
    throw Error("Extract range outside media");

  const id = uuid();
  const outExt = source.ext === "webm" ? "webm" : "mp4";
  const target = file("assets", id, outExt);
  const input = file("assets", source.id, source.ext);
  try {
    await run(
      bin.ffmpeg,
      [
        "-y",
        "-ss",
        String(start),
        "-i",
        input,
        "-t",
        String(Math.max(0.25, end - start)),
        "-c",
        "copy",
        "-avoid_negative_ts",
        "make_zero",
        target,
      ],
      signal,
    );
    const stat = await fs.stat(target);
    const a: Asset = {
      id,
      name: `Replay · ${source.name}`.slice(0, 180),
      description: `Extract ${start.toFixed(1)}–${end.toFixed(1)}s from ${source.id}`,
      folder: source.folder || "",
      tags: [...new Set([...(source.tags || []), "replay"])],
      favorite: false,
      kind: "video",
      duration: end - start,
      ext: outExt,
      audio: source.audio,
      bytes: stat.size,
      usedBy: [],
      collections: source.collections || [],
    };
    await fs.writeFile(file("assets", id, "json"), JSON.stringify(a));
    return a;
  } catch (e) {
    await fs.rm(target, { force: true });
    throw e;
  }
}
