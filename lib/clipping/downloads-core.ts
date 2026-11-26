import { createHash } from "node:crypto";
import { z } from "zod";
import { selectDownload, type VideoInfo } from "../ingestion";

/**
 * Pure logic for the download manager. Capabilities are read from what yt-dlp actually reports
 * for a URL; nothing is assumed per platform.
 */
export const LANG = /^[a-zA-Z0-9_-]{2,30}$/;

export const RequestSchema = z.object({
  url: z.string().trim().url().max(2000),
  mode: z.enum(["video", "audio", "subtitles"]).default("video"),
  /** Lightweight analysis quality by default; raise it when you need a higher-quality original. */
  maxHeight: z.number().int().min(144).max(2160).default(720),
  subtitleLangs: z.array(z.string().regex(LANG)).max(10).default([]),
  includeAutoSubs: z.boolean().default(false),
  /** Partial download in seconds, where the source supports sections. */
  section: z.object({ start: z.number().min(0).max(86400), end: z.number().min(1).max(86400) }).refine((s) => s.end > s.start, "end must be after start").optional(),
});
export type DownloadRequest = z.infer<typeof RequestSchema>;

const TRACKING = /^(utm_.*|si|feature|pp|fbclid|gclid|igshid|ref|ref_src)$/i;

/** Canonical form used for caching and duplicate detection. */
export function canonicalUrl(raw: string): string {
  const u = new URL(raw);
  const host = u.hostname.replace(/^(www|m)\./, "");
  if (host === "youtu.be") return `https://www.youtube.com/watch?v=${u.pathname.slice(1).split("/")[0]}`;
  if (host === "youtube.com") {
    const v = u.searchParams.get("v") ?? u.pathname.match(/^\/(?:shorts|live|embed)\/([\w-]{6,})/)?.[1];
    if (v) return `https://www.youtube.com/watch?v=${v}`;
  }
  if (host === "twitch.tv") {
    const id = u.pathname.match(/^\/videos\/(\d+)/)?.[1];
    if (id) return `https://www.twitch.tv/videos/${id}`;
  }
  u.hash = "";
  for (const k of [...u.searchParams.keys()]) if (TRACKING.test(k)) u.searchParams.delete(k);
  u.searchParams.sort();
  u.hostname = u.hostname.toLowerCase();
  return u.href;
}

export function cacheKey(req: DownloadRequest): string {
  return createHash("sha256")
    .update(JSON.stringify([canonicalUrl(req.url), req.mode, req.mode === "video" ? req.maxHeight : null, [...req.subtitleLangs].sort(), req.includeAutoSubs, req.section ?? null]))
    .digest("hex")
    .slice(0, 32);
}

type Fmt = NonNullable<VideoInfo["formats"]>[number] & { abr?: number; language?: string; format_note?: string; ext?: string; fps?: number };
export type Info = VideoInfo & {
  uploader?: string; channel?: string; webpage_url?: string; thumbnail?: string; upload_date?: string; language?: string;
  chapters?: { title: string; start_time: number; end_time: number }[]; automatic_captions?: Record<string, { ext: string }[]>;
  availability?: string; extractor_key?: string; heatmap?: unknown[]; formats?: Fmt[];
};

const SAFE_THUMB = /^https:\/\/(?:[a-z0-9-]+\.)*(?:ytimg\.com|jtvnw\.net|kickcdn\.com|twimg\.com|vimeocdn\.com)\//i;

export type Inspection = {
  title: string;
  creator: string;
  platform: string;
  url: string;
  thumbnail?: string;
  duration: number;
  uploadDate?: string;
  sourceLanguage?: string;
  availability: string;
  live: boolean;
  chapters: { title: string; start: number; end: number }[];
  resolutions: { height: number; estimatedBytes?: number }[];
  audioTracks: { formatId: string; language?: string; codec?: string; bitrateKbps?: number }[];
  subtitleTracks: { lang: string; kind: "manual" | "automatic" }[];
  /** Detected from the reported metadata, not assumed. */
  capabilities: { video: boolean; audioOnly: boolean; subtitles: boolean; sections: boolean; resumable: boolean; liveChat: boolean; replayHeatmap: boolean };
  notes: string[];
};

export function describeInfo(info: Info, url: string): Inspection {
  const formats = info.formats ?? [];
  const dur = Number(info.duration) || 0;
  const est = (f: Fmt) => f.filesize || f.filesize_approx || (dur && f.tbr ? Math.round(dur * f.tbr * 125) : undefined);
  const byHeight = new Map<number, number | undefined>();
  for (const f of formats) if (f.height && f.vcodec !== "none") {
    const prev = byHeight.get(f.height);
    const e = est(f);
    byHeight.set(f.height, prev === undefined ? e : e === undefined ? prev : Math.max(prev, e));
  }
  const subs = Object.keys(info.subtitles ?? {}).filter((k) => LANG.test(k) && k !== "live_chat");
  const autos = Object.keys(info.automatic_captions ?? {}).filter((k) => LANG.test(k) && !subs.includes(k));
  const live = !!info.is_live || ["is_live", "is_upcoming"].includes(info.live_status ?? "");
  const protocols = new Set(formats.map((f) => f.protocol ?? ""));
  const notes: string[] = [];
  if (live) notes.push("Live or upcoming: only completed recordings can be downloaded.");
  if (!formats.length) notes.push("No downloadable formats were reported for this URL.");
  const caps = {
    video: formats.some((f) => f.vcodec !== "none"),
    audioOnly: formats.some((f) => f.vcodec === "none" && f.acodec !== "none") || formats.some((f) => f.acodec !== "none"),
    subtitles: subs.length + autos.length > 0,
    // Sections need the duration and a seekable (HTTP or fragmented) protocol.
    sections: dur > 0 && formats.some((f) => /^(https?|m3u8_native|http_dash_segments)$/.test(f.protocol ?? "")),
    // yt-dlp resumes plain HTTP downloads from .part files and fragmented ones from fragment state.
    resumable: [...protocols].some((p) => /^(https?|m3u8_native|http_dash_segments)$/.test(p)),
    liveChat: Object.keys(info.subtitles ?? {}).includes("live_chat"),
    replayHeatmap: Array.isArray(info.heatmap) && info.heatmap.length > 0,
  };
  return {
    title: info.title || new URL(url).hostname,
    creator: info.channel || info.uploader || "",
    platform: info.extractor_key || new URL(url).hostname,
    url: info.webpage_url || url,
    thumbnail: info.thumbnail && SAFE_THUMB.test(info.thumbnail) ? info.thumbnail : undefined,
    duration: dur,
    uploadDate: /^\d{8}$/.test(info.upload_date ?? "") ? `${info.upload_date!.slice(0, 4)}-${info.upload_date!.slice(4, 6)}-${info.upload_date!.slice(6)}` : undefined,
    sourceLanguage: info.language && LANG.test(info.language) ? info.language : undefined,
    availability: info.availability || "unknown",
    live,
    chapters: (info.chapters ?? []).slice(0, 200).map((c) => ({ title: String(c.title).slice(0, 120), start: c.start_time, end: c.end_time })),
    resolutions: [...byHeight].sort((a, b) => a[0] - b[0]).map(([height, estimatedBytes]) => ({ height, estimatedBytes })),
    audioTracks: (formats as Fmt[]).filter((f) => f.vcodec === "none" && f.acodec !== "none" && /^[\w.-]+$/.test(f.format_id)).slice(-8).map((f) => ({ formatId: f.format_id, language: f.language, codec: f.acodec, bitrateKbps: f.abr ? Math.round(f.abr) : undefined })),
    subtitleTracks: [...subs.map((lang) => ({ lang, kind: "manual" as const })), ...autos.slice(0, 20).map((lang) => ({ lang, kind: "automatic" as const }))],
    capabilities: caps,
    notes,
  };
}

/** Estimated bytes for a request, or undefined when the source reports nothing usable. */
export function estimateBytes(info: Info, req: DownloadRequest, limitBytes: number): number | undefined {
  if (req.mode === "subtitles") return 2 * 1024 * 1024;
  const dur = Number(info.duration) || 0;
  const fraction = req.section && dur ? Math.min(1, (req.section.end - req.section.start) / dur) : 1;
  if (req.mode === "audio") {
    const a = (info.formats ?? []).filter((f) => f.vcodec === "none" && f.acodec !== "none").at(-1);
    const b = a && (a.filesize || a.filesize_approx || (dur && a.tbr ? dur * a.tbr * 125 : undefined));
    return b ? Math.round(b * fraction) : undefined;
  }
  try {
    const sel = selectDownload(info, limitBytes, req.maxHeight);
    return sel.estimatedBytes ? Math.round(sel.estimatedBytes * fraction) : undefined;
  } catch {
    return undefined;
  }
}

export type DiskCheck = { ok: boolean; neededBytes: number; message?: string };
const GB = 1024 ** 3;

/** Refuse before downloading when the drive cannot hold the file plus working space. */
export function storageCheck(freeBytes: number | null, estimated: number | undefined): DiskCheck {
  // Merging video and audio needs roughly the file size again; keep a floor for unknown sizes.
  const needed = estimated ? Math.ceil(estimated * 2.2 + 0.5 * GB) : 2 * GB;
  if (freeBytes === null) return { ok: true, neededBytes: needed, message: "Free disk space could not be measured." };
  if (freeBytes < needed)
    return { ok: false, neededBytes: needed, message: `Not enough free disk space: about ${(needed / GB).toFixed(1)} GB needed, ${(freeBytes / GB).toFixed(1)} GB free. Free some space (Settings → Storage) and retry.` };
  return { ok: true, neededBytes: needed };
}

export const PARTIAL = /(\.part|\.ytdl|\.tmp|\.temp|-Frag\d+|\.f\d+\.[a-z0-9]+(\.part)?)$/i;
export const isPartial = (name: string) => PARTIAL.test(name);

export type Progress = { downloaded: number; total: number; speed?: number; eta?: number; file?: string };

export function parseProgressLine(line: string): Progress | null {
  if (!line.startsWith("CLIPPER_PROGRESS:")) return null;
  try {
    const d = JSON.parse(line.slice("CLIPPER_PROGRESS:".length));
    return {
      downloaded: Number(d.downloaded_bytes) || 0,
      total: Number(d.total_bytes || d.total_bytes_estimate) || 0,
      speed: d.speed > 0 ? Number(d.speed) : undefined,
      eta: Number.isFinite(d.eta) ? Number(d.eta) : undefined,
      file: typeof d.filename === "string" ? d.filename : undefined,
    };
  } catch {
    return null;
  }
}

const SAFE_FORMAT = /^[\w.+-]+$/;

/**
 * yt-dlp arguments for one request. Every value that reaches the command line is validated;
 * the URL follows `--` so it can never be read as an option. Partial files are kept (`--continue`)
 * so a retry resumes.
 */
export function buildArgs(o: {
  req: DownloadRequest;
  info: Info;
  outTemplate: string;
  proxy: string;
  ffmpeg?: string;
  limitBytes: number;
}): { args: string[]; format?: string; height?: number } {
  const { req, info, outTemplate, proxy, ffmpeg, limitBytes } = o;
  const common = [
    "--ignore-config", "--no-plugin-dirs", "--no-playlist", "--newline", "--continue",
    "--socket-timeout", "30", "--retries", "3", "--fragment-retries", "3", "--proxy", proxy,
    ...(ffmpeg ? ["--ffmpeg-location", ffmpeg] : []),
    "--progress", "--progress-template", "download:CLIPPER_PROGRESS:%(progress)j",
    "--max-filesize", `${Math.max(1, Math.floor(limitBytes / 1048576))}M`,
  ];
  if (req.mode === "subtitles") {
    const langs = req.subtitleLangs.length ? req.subtitleLangs : Object.keys(info.subtitles ?? {}).filter((l) => LANG.test(l) && l !== "live_chat").slice(0, 5);
    if (!langs.length && !req.includeAutoSubs) throw Error("This source has no manual subtitle tracks. Tick 'include automatic subtitles' or choose a language explicitly.");
    return {
      args: [...common, "--skip-download", "--write-subs", ...(req.includeAutoSubs ? ["--write-auto-subs"] : []), "--sub-langs", (langs.length ? langs : ["en.*"]).join(","), "--sub-format", "vtt", "-o", outTemplate, "--", req.url],
    };
  }
  const section = req.section ? ["--download-sections", `*${Math.floor(req.section.start)}-${Math.ceil(req.section.end)}`] : [];
  if (req.mode === "audio") {
    const audio = ((info.formats ?? []) as Fmt[]).filter((f) => f.vcodec === "none" && f.acodec !== "none" && SAFE_FORMAT.test(f.format_id) && /^(https?|m3u8_native|http_dash_segments)$/.test(f.protocol ?? "")).at(-1);
    if (!audio) throw Error("No audio-only stream was reported for this source.");
    return { args: [...common, ...section, "-f", audio.format_id, "-x", "--audio-format", "m4a", "-o", outTemplate, "--", req.url], format: audio.format_id };
  }
  const sel = selectDownload(info, limitBytes, req.maxHeight);
  if (!SAFE_FORMAT.test(sel.format)) throw Error("Unsupported format selection.");
  return {
    args: [...common, ...section, "--concurrent-fragments", "4", "--hls-prefer-native", "--compat-options", "no-direct-merge", "--no-live-from-start", "-f", sel.format, "--merge-output-format", "mp4", "--remux-video", "mp4", "-o", outTemplate, "--", req.url],
    format: sel.format,
    height: sel.height,
  };
}
