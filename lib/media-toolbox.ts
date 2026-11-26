import { promises as fs } from "node:fs";
import path from "node:path";
import { uuid } from "./id";
import { bin, run } from "./process";
import { file, workspaceRoot } from "./store";

export type ConvertProfile = {
  container: "mp4" | "mkv" | "webm" | "mp3" | "wav" | "aac";
  videoCodec?: "copy" | "libx264" | "libvpx-vp9";
  audioCodec?: "copy" | "aac" | "libmp3lame" | "pcm_s16le" | "libopus";
  crf?: number;
  scale?: string;
  fps?: number;
  stripAudio?: boolean;
  stripVideo?: boolean;
};

export type ConvertJob = {
  id: string;
  projectId: string;
  profile: ConvertProfile;
  output: string;
};

const COMPAT: Record<
  ConvertProfile["container"],
  { video?: ConvertProfile["videoCodec"][]; audio?: ConvertProfile["audioCodec"][] }
> = {
  mp4: { video: ["copy", "libx264"], audio: ["copy", "aac"] },
  mkv: {
    video: ["copy", "libx264", "libvpx-vp9"],
    audio: ["copy", "aac", "libopus", "libmp3lame"],
  },
  webm: { video: ["libvpx-vp9"], audio: ["libopus"] },
  mp3: { audio: ["libmp3lame"] },
  wav: { audio: ["pcm_s16le"] },
  aac: { audio: ["aac"] },
};

export function validateProfile(input: unknown): ConvertProfile {
  if (!input || typeof input !== "object") throw Error("Invalid convert profile");
  const p = input as ConvertProfile;
  if (!COMPAT[p.container]) throw Error("Unsupported container");
  const allowed = COMPAT[p.container];
  if (p.videoCodec && allowed.video && !allowed.video.includes(p.videoCodec))
    throw Error("Video codec incompatible with container");
  if (p.audioCodec && allowed.audio && !allowed.audio.includes(p.audioCodec))
    throw Error("Audio codec incompatible with container");
  if (p.crf !== undefined && (!Number.isFinite(p.crf) || p.crf < 0 || p.crf > 51))
    throw Error("CRF must be 0–51");
  if (p.fps !== undefined && (!Number.isFinite(p.fps) || p.fps < 1 || p.fps > 120))
    throw Error("Invalid frame rate");
  if (p.scale !== undefined && !/^\d{2,5}:-?[12]?$|^\d{2,5}x\d{2,5}$/.test(p.scale))
    throw Error("Invalid scale (use 1280:-2 or 1280x720)");
  if (["mp3", "wav", "aac"].includes(p.container) && !p.stripVideo)
    p.stripVideo = true;
  return p;
}

export function buildConvertArgs(
  source: string,
  output: string,
  profile: ConvertProfile,
): string[] {
  const p = validateProfile(profile);
  const args = ["-y", "-i", source];
  if (p.stripVideo) args.push("-vn");
  if (p.stripAudio) args.push("-an");
  if (p.scale && !p.stripVideo)
    args.push("-vf", p.scale.includes("x") ? `scale=${p.scale}` : `scale=${p.scale}`);
  if (p.fps && !p.stripVideo) args.push("-r", String(p.fps));
  if (!p.stripVideo) {
    args.push(
      "-c:v",
      p.videoCodec || (p.container === "webm" ? "libvpx-vp9" : "libx264"),
    );
    if ((p.videoCodec || "libx264") !== "copy" && p.crf !== undefined)
      args.push("-crf", String(p.crf));
  }
  if (!p.stripAudio) {
    args.push(
      "-c:a",
      p.audioCodec ||
        (p.container === "mp3"
          ? "libmp3lame"
          : p.container === "wav"
            ? "pcm_s16le"
            : p.container === "webm"
              ? "libopus"
              : "aac"),
    );
  }
  if (p.container === "mp4") args.push("-movflags", "+faststart");
  args.push(output);
  return args;
}

export async function convertProjectMedia(
  projectId: string,
  profile: ConvertProfile,
  signal: AbortSignal,
) {
  const p = validateProfile(profile);
  const source = file("uploads", projectId, "mp4");
  await fs.access(source);
  const dir = path.join(workspaceRoot(), "exports", "toolbox", projectId);
  await fs.mkdir(dir, { recursive: true });
  const id = uuid();
  const output = path.join(dir, `${id}.${p.container === "aac" ? "m4a" : p.container}`);
  const tmp = output + ".tmp";
  const args = buildConvertArgs(source, tmp, p);
  try {
    await run(bin.ffmpeg, args, signal);
    await fs.rename(tmp, output);
  } finally {
    await fs.rm(tmp, { force: true });
  }
  const stat = await fs.stat(output);
  return {
    id,
    path: output,
    bytes: stat.size,
    container: p.container,
    profile: p,
  };
}

/** Extract a single elementary stream into exports/toolbox. */
export async function extractTrack(
  projectId: string,
  kind: "audio" | "video",
  signal?: AbortSignal,
) {
  if (kind !== "audio" && kind !== "video")
    throw Error("Extract kind must be audio or video");
  const source = file("uploads", projectId, "mp4");
  await fs.access(source);
  const dir = path.join(workspaceRoot(), "exports", "toolbox", projectId);
  await fs.mkdir(dir, { recursive: true });
  const id = uuid();
  const output =
    kind === "audio"
      ? path.join(dir, `${id}-audio.m4a`)
      : path.join(dir, `${id}-video.mp4`);
  const tmp = output + ".tmp";
  const args =
    kind === "audio"
      ? ["-y", "-i", source, "-vn", "-c:a", "aac", "-b:a", "192k", tmp]
      : ["-y", "-i", source, "-an", "-c:v", "copy", tmp];
  try {
    await run(bin.ffmpeg, args, signal);
    await fs.rename(tmp, output);
  } finally {
    await fs.rm(tmp, { force: true });
  }
  const stat = await fs.stat(output);
  return { id, kind, path: output, bytes: stat.size };
}

/** Convert multiple projects sequentially (max 8). Continues after per-item failures. */
export async function batchConvert(
  projectIds: string[],
  profile: ConvertProfile,
  signal?: AbortSignal,
) {
  const ids = [...new Set(projectIds)].slice(0, 8);
  if (!ids.length) throw Error("Select at least one project");
  const p = validateProfile(profile);
  const results: {
    projectId: string;
    ok: boolean;
    error?: string;
    output?: Awaited<ReturnType<typeof convertProjectMedia>>;
  }[] = [];
  for (const projectId of ids) {
    signal?.throwIfAborted();
    try {
      const output = await convertProjectMedia(projectId, p, signal || new AbortController().signal);
      results.push({ projectId, ok: true, output });
    } catch (e) {
      results.push({
        projectId,
        ok: false,
        error: e instanceof Error ? e.message : "Convert failed",
      });
    }
  }
  return {
    profile: p,
    total: results.length,
    ok: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results,
  };
}

export async function inspectMediaReport(
  projectId: string,
  signal: AbortSignal,
) {
  const source = file("uploads", projectId, "mp4");
  const raw = await run(
    bin.ffprobe,
    [
      "-v",
      "error",
      "-show_format",
      "-show_streams",
      "-show_chapters",
      "-of",
      "json",
      source,
    ],
    signal,
  );
  const info = JSON.parse(raw);
  const video = (info.streams || []).find(
    (s: { codec_type: string }) => s.codec_type === "video",
  );
  const audio = (info.streams || []).filter(
    (s: { codec_type: string }) => s.codec_type === "audio",
  );
  const subs = (info.streams || []).filter(
    (s: { codec_type: string }) => s.codec_type === "subtitle",
  );
  return {
    container: info.format?.format_name,
    duration: Number(info.format?.duration) || 0,
    size: Number(info.format?.size) || 0,
    bitrate: Number(info.format?.bit_rate) || 0,
    video: video
      ? {
          codec: video.codec_name,
          width: video.width,
          height: video.height,
          fps: video.avg_frame_rate,
          pixFmt: video.pix_fmt,
          colorSpace: video.color_space,
          colorTransfer: video.color_transfer,
          colorPrimaries: video.color_primaries,
        }
      : null,
    audio: audio.map((a: { codec_name: string; channels: number; sample_rate: string }) => ({
      codec: a.codec_name,
      channels: a.channels,
      sampleRate: a.sample_rate,
    })),
    subtitles: subs.length,
    chapters: (info.chapters || []).length,
    raw: info,
  };
}
