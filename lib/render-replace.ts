import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { uuid } from "./id";
import { bin, run } from "./process";
import { file, workspaceRoot } from "./store";
import { compose } from "./composite-render";
import { dimensions } from "./captions";
import type { Composition } from "./composition";
import type { Settings } from "./types";
import { validateComposition } from "./composition";

export type RenderReplaceRecord = {
  version: 1;
  id: string;
  projectId: string;
  clipId: string;
  createdAt: string;
  fingerprint: string;
  intermediateAsset: string;
  originalComposition: Composition;
  active: boolean;
};

function recordPath(projectId: string, clipId: string) {
  return path.join(
    workspaceRoot(),
    "render-replace",
    projectId,
    clipId + ".json",
  );
}

export function compositionFingerprint(c: Composition | undefined) {
  return createHash("sha256")
    .update(JSON.stringify(c || { version: 1, tracks: [] }))
    .digest("hex")
    .slice(0, 24);
}

export async function readRenderReplace(projectId: string, clipId: string) {
  try {
    const raw = JSON.parse(
      await fs.readFile(recordPath(projectId, clipId), "utf8"),
    ) as RenderReplaceRecord;
    if (raw.version !== 1) return null;
    return raw;
  } catch {
    return null;
  }
}

async function writeRecord(rec: RenderReplaceRecord) {
  const target = recordPath(rec.projectId, rec.clipId);
  await fs.mkdir(path.dirname(target), { recursive: true });
  const tmp = target + "." + uuid() + ".tmp";
  try {
    await fs.writeFile(tmp, JSON.stringify(rec, null, 2));
    await fs.rename(tmp, target);
  } finally {
    await fs.rm(tmp, { force: true });
  }
}

/**
 * Bake the current composition into an intermediate video asset and swap the
 * editable composition for a single replacement track. Original is preserved.
 */
export async function renderAndReplace(
  projectId: string,
  clipId: string,
  settings: Settings,
  length: number,
  signal: AbortSignal,
): Promise<{ settings: Settings; record: RenderReplaceRecord }> {
  const composition = settings.composition
    ? validateComposition(settings.composition)
    : undefined;
  if (!composition?.tracks.length)
    throw Error("Nothing to render — add composition layers first.");
  const existing = await readRenderReplace(projectId, clipId);
  if (existing?.active)
    throw Error("Restore the previous render-and-replace before baking again.");

  const [w, h] = dimensions(settings);
  const duration = Math.max(0.5, Math.min(600, length));
  const fingerprint = compositionFingerprint(composition);
  const assetId = uuid();
  await fs.mkdir(path.join(workspaceRoot(), "assets"), { recursive: true });
  const out = file("assets", assetId, "mp4");
  const tmp = out + "." + uuid() + ".tmp.mp4";

  const comp = await compose(
    composition,
    w,
    h,
    duration,
    false,
    "anull",
    false,
  );

  const filter = [
    `color=c=black:s=${w}x${h}:d=${duration},fps=30,format=yuv420p[base]`,
    ...comp.graph,
    `[${comp.video}]format=yuv420p[out]`,
  ].join(";");

  try {
    await run(
      bin.ffmpeg,
      [
        "-y",
        "-protocol_whitelist",
        "file,pipe",
        ...comp.inputs,
        "-filter_complex",
        filter,
        "-map",
        "[out]",
        "-an",
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "18",
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
        "-t",
        String(duration),
        tmp,
      ],
      signal,
    );
    await fs.rename(tmp, out);
  } finally {
    await fs.rm(tmp, { force: true });
  }

  const meta = {
    id: assetId,
    name: "Render replace " + clipId.slice(0, 8),
    description: "Intermediate render-and-replace asset",
    folder: "render-replace",
    tags: ["render-replace", "intermediate"],
    favorite: false,
    kind: "video" as const,
    duration,
    audio: false,
    ext: "mp4",
    bytes: (await fs.stat(out)).size,
    usedBy: [clipId],
  };
  await fs.writeFile(file("assets", assetId, "json"), JSON.stringify(meta));

  const replacement: Composition = {
    version: 1,
    tracks: [
      {
        id: uuid(),
        name: "Rendered replace",
        asset: assetId,
        type: "video",
        at: 0,
        length: duration,
        slip: 0,
        x: 0.5,
        y: 0.5,
        size: 1,
        opacity: 1,
        volume: 1,
        visible: true,
        muted: true,
        locked: true,
        solo: false,
        loop: false,
        fade: 0,
        keys: {},
      },
    ],
  };

  const record: RenderReplaceRecord = {
    version: 1,
    id: uuid(),
    projectId,
    clipId,
    createdAt: new Date().toISOString(),
    fingerprint,
    intermediateAsset: assetId,
    originalComposition: composition,
    active: true,
  };
  await writeRecord(record);

  return {
    settings: { ...settings, composition: replacement },
    record,
  };
}

export async function restoreRenderReplace(
  projectId: string,
  clipId: string,
  settings: Settings,
): Promise<{ settings: Settings; record: RenderReplaceRecord | null }> {
  const record = await readRenderReplace(projectId, clipId);
  if (!record?.active) throw Error("No active render-and-replace to restore.");
  record.active = false;
  await writeRecord(record);
  return {
    settings: {
      ...settings,
      composition: validateComposition(record.originalComposition),
    },
    record,
  };
}

/** True when the live composition fingerprint no longer matches the bake. */
export function isRenderReplaceStale(
  record: RenderReplaceRecord | null,
  composition: Composition | undefined,
) {
  if (!record?.active) return false;
  return record.fingerprint !== compositionFingerprint(composition);
}
