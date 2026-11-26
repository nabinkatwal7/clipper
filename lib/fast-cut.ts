import { promises as fs } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { bin, run } from "./process";
import { file, workspaceRoot } from "./store";
import {
  cutModeHelp,
  type CutMode,
  type CutSegment,
  type CutSession,
} from "./fast-cut-types";

export {
  cutModeHelp,
  type CutMode,
  type CutSegment,
  type CutSession,
} from "./fast-cut-types";

export function validateSegment(input: unknown): CutSegment {
  const s = input as CutSegment;
  if (
    !s ||
    typeof s.id !== "string" ||
    !/^[0-9a-f-]{36}$/i.test(s.id) ||
    !Number.isFinite(s.start) ||
    !Number.isFinite(s.end) ||
    s.start < 0 ||
    s.end <= s.start ||
    s.end - s.start > 43200 ||
    typeof s.label !== "string" ||
    !s.label.trim() ||
    s.label.length > 120
  )
    throw Error("Invalid cut segment");
  if (s.color && !/^#[0-9a-f]{6}$/i.test(s.color))
    throw Error("Invalid segment color");
  if (s.notes !== undefined && (typeof s.notes !== "string" || s.notes.length > 500))
    throw Error("Notes too long");
  return {
    id: s.id,
    start: s.start,
    end: s.end,
    label: s.label.trim().slice(0, 120),
    color: s.color,
    notes: s.notes?.slice(0, 500),
  };
}

export function validateCutSession(input: unknown): CutSession {
  if (!input || typeof input !== "object") throw Error("Invalid cut session");
  const doc = input as CutSession;
  if (doc.version !== 1 || !["lossless", "accurate", "smart"].includes(doc.mode))
    throw Error("Unsupported cut session");
  if (!/^[0-9a-f-]{36}$/i.test(doc.sourceProject))
    throw Error("Invalid source project");
  if (!Array.isArray(doc.segments) || doc.segments.length > 200)
    throw Error("Use at most 200 segments");
  const ids = new Set<string>();
  const segments = doc.segments.map((row) => {
    const s = validateSegment(row);
    if (ids.has(s.id)) throw Error("Duplicate segment id");
    ids.add(s.id);
    return s;
  });
  return { version: 1, sourceProject: doc.sourceProject, mode: doc.mode, segments };
}

export function detectOverlaps(segments: CutSegment[]) {
  const sorted = [...segments].sort((a, b) => a.start - b.start);
  const overlaps: [string, string][] = [];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].start < sorted[i - 1].end)
      overlaps.push([sorted[i - 1].id, sorted[i].id]);
  }
  return overlaps;
}

async function nearestKeyframe(source: string, time: number, signal: AbortSignal) {
  const out = await run(
    bin.ffprobe,
    [
      "-v",
      "error",
      "-select_streams",
      "v:0",
      "-show_frames",
      "-show_entries",
      "frame=pkt_pts_time,key_frame",
      "-read_intervals",
      `${Math.max(0, time - 2)}%+4`,
      "-of",
      "csv=p=0",
      source,
    ],
    signal,
  ).catch(() => "");
  let best = time,
    dist = Infinity;
  for (const line of out.split(/\r?\n/)) {
    const [pts, key] = line.split(",");
    if (key !== "1") continue;
    const t = Number(pts);
    if (!Number.isFinite(t)) continue;
    const d = Math.abs(t - time);
    if (d < dist) {
      dist = d;
      best = t;
    }
  }
  return best;
}

export async function buildCutArgs(
  source: string,
  segment: CutSegment,
  mode: CutMode,
  output: string,
  signal: AbortSignal,
): Promise<string[]> {
  const duration = segment.end - segment.start;
  if (mode === "accurate") {
    return [
      "-y",
      "-ss",
      String(segment.start),
      "-t",
      String(duration),
      "-i",
      source,
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "18",
      "-c:a",
      "aac",
      "-b:a",
      "160k",
      "-movflags",
      "+faststart",
      output,
    ];
  }
  let start = segment.start;
  if (mode === "lossless" || mode === "smart") {
    const key = await nearestKeyframe(source, segment.start, signal);
    if (mode === "lossless") start = key;
    else if (Math.abs(key - segment.start) > 0.15) {
      // Smart: far from keyframe → accurate re-encode
      return buildCutArgs(source, segment, "accurate", output, signal);
    } else start = key;
  }
  return [
    "-y",
    "-ss",
    String(start),
    "-t",
    String(Math.max(0.04, segment.end - start)),
    "-i",
    source,
    "-c",
    "copy",
    "-avoid_negative_ts",
    "make_zero",
    "-movflags",
    "+faststart",
    output,
  ];
}

export async function exportSegments(
  projectId: string,
  session: CutSession,
  signal: AbortSignal,
) {
  const doc = validateCutSession(session);
  const overlaps = detectOverlaps(doc.segments);
  if (overlaps.length)
    throw Error(
      "Resolve overlapping segments before export (" +
        overlaps.length +
        " overlap(s))",
    );
  const source = file("uploads", projectId, "mp4");
  await fs.access(source);
  const dir = path.join(workspaceRoot(), "exports", "fast-cuts", projectId);
  await fs.mkdir(dir, { recursive: true });
  const results: { id: string; path: string; mode: CutMode; label: string }[] =
    [];
  for (const segment of doc.segments) {
    const out = path.join(dir, segment.id + ".mp4");
    const tmp = out + "." + randomUUID() + ".tmp.mp4";
    const args = await buildCutArgs(
      source,
      segment,
      doc.mode,
      tmp,
      signal,
    );
    try {
      await run(bin.ffmpeg, args, signal);
      await fs.rename(tmp, out);
      results.push({
        id: segment.id,
        path: out,
        mode: doc.mode,
        label: segment.label,
      });
    } finally {
      await fs.rm(tmp, { force: true });
    }
  }
  return {
    mode: doc.mode,
    help: cutModeHelp(doc.mode),
    results,
  };
}
