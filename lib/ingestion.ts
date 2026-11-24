import { promises as fs } from "node:fs";

export type VideoFormat = {
  format_id: string;
  protocol?: string;
  height?: number;
  vcodec?: string;
  acodec?: string;
  filesize?: number;
  filesize_approx?: number;
  tbr?: number;
};
export type VideoInfo = {
  title?: string;
  duration?: number;
  is_live?: boolean;
  live_status?: string;
  formats?: VideoFormat[];
};
const safeProtocol = /^(https?|m3u8_native|http_dash_segments)$/;
function estimatedBytes(format: VideoFormat, duration: number | undefined) {
  return (
    format.filesize ||
    format.filesize_approx ||
    (duration && format.tbr ? duration * format.tbr * 125 : undefined)
  );
}

// yt-dlp orders formats from worst to best. Reserve muxing overhead and account
// for BOTH streams, rather than allowing each to consume the full project limit.
export function selectDownload(
  info: VideoInfo,
  limit: number,
  maxHeight = 720,
) {
  const formats = (info.formats || []).filter(
    (f) =>
      safeProtocol.test(f.protocol || "") &&
      /^[\w.-]+$/.test(f.format_id) &&
      (!f.height || f.height <= maxHeight),
  );
  const videos = formats.filter((f) => f.vcodec !== "none").reverse();
  const audio = formats
    .filter((f) => f.vcodec === "none" && f.acodec !== "none")
    .reverse();
  let unknownSizeFallback: ReturnType<typeof choice> | undefined;
  function choice(
    video: VideoFormat,
    sound: VideoFormat | undefined,
    estimated: number | undefined,
  ) {
    return {
      format: video.format_id + (sound ? "+" + sound.format_id : ""),
      height: video.height,
      estimatedBytes: estimated,
    };
  }
  for (const video of videos) {
    const candidates = video.acodec === "none" ? audio : [undefined];
    for (const sound of candidates) {
      const videoSize = estimatedBytes(video, info.duration),
        audioSize = sound ? estimatedBytes(sound, info.duration) : 0;
      const estimated =
        videoSize !== undefined && audioSize !== undefined
          ? videoSize + audioSize
          : undefined;
      if ((videoSize || 0) + (audioSize || 0) > limit * 0.96) continue;
      if (estimated === undefined) {
        unknownSizeFallback ??= choice(video, sound, estimated);
        continue;
      }
      return choice(video, sound, estimated);
    }
  }
  if (unknownSizeFallback) return unknownSizeFallback;
  throw Error(
    `No supported video format fits the ${Math.round(limit / 1024 / 1024)} MB import limit. Try a shorter recording, upload a smaller file, or increase MAX_UPLOAD_MB in .env.local and restart the server.`,
  );
}

export async function requireDownloadedFile(
  target: string,
  limit: number,
  diagnostics: string,
) {
  const stat = await fs.stat(target).catch(() => null);
  if (!stat || stat.size === 0) {
    const sizeLimit =
      /max.filesize|larger than|file is larger|aborting|size.*limit/i.test(
        diagnostics,
      );
    throw Error(
      sizeLimit
        ? `Download stopped at the ${Math.round(limit / 1024 / 1024)} MB import limit; no complete video was created. Try a smaller recording or increase MAX_UPLOAD_MB in .env.local and restart the server.`
        : `The downloader did not produce a complete video. ${diagnostics.trim().slice(-1400) || "The video may be unavailable, restricted, or skipped by the provider."}`,
    );
  }
  if (stat.size > limit)
    throw Error(
      `The imported video exceeds the ${Math.round(limit / 1024 / 1024)} MB limit. Increase MAX_UPLOAD_MB or use a smaller recording.`,
    );
}
