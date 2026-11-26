import { createHash, randomUUID } from "node:crypto";
import { createWriteStream, promises as fs } from "node:fs";
import path from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { bin, run } from "./process";
import { file, workspaceRoot } from "./store";
export type AssetKind =
  | "video"
  | "image"
  | "audio"
  | "subtitle"
  | "font"
  | "lut"
  | "template"
  | "graphic"
  | "other";
export type Asset = {
  id: string;
  name: string;
  description: string;
  folder: string;
  tags: string[];
  favorite: boolean;
  kind: AssetKind;
  duration: number;
  audio: boolean;
  ext: string;
  bytes: number;
  /** Content fingerprint for duplicate detection */
  fingerprint?: string;
  /** Project / clip / composition ids that reference this asset */
  usedBy?: string[];
  collections?: string[];
  rating?: number;
  colorLabel?: string;
  missing?: boolean;
};
async function fingerprintFile(target: string, bytes: number) {
  const hash = createHash("sha256");
  hash.update(String(bytes));
  const head = Buffer.alloc(Math.min(65536, bytes));
  const fh = await fs.open(target, "r");
  try {
    await fh.read(head, 0, head.length, 0);
    hash.update(head);
    if (bytes > 131072) {
      const tail = Buffer.alloc(65536);
      await fh.read(tail, 0, 65536, bytes - 65536);
      hash.update(tail);
    }
  } finally {
    await fh.close();
  }
  return hash.digest("hex");
}
export async function asset(id: string): Promise<Asset> {
  return JSON.parse(await fs.readFile(file("assets", id, "json"), "utf8"));
}
export async function assetList() {
  const names = await fs.readdir(path.join(workspaceRoot(), "assets"));
  return Promise.all(
    names.filter((n) => n.endsWith(".json")).map((n) => asset(n.slice(0, -5))),
  );
}
export async function importAsset(req: Request) {
  const name = decodeURIComponent(req.headers.get("x-file-name") || "asset"),
    ext = name.split(".").pop()?.toLowerCase() || "";
  if (
    ![
      "jpg",
      "jpeg",
      "png",
      "webp",
      "mp4",
      "mov",
      "mkv",
      "webm",
      "mp3",
      "m4a",
      "aac",
      "wav",
      "flac",
      "ogg",
    ].includes(ext) ||
    !req.body
  )
    throw Error("Choose a supported image, audio file or video.");
  const id = randomUUID(),
    target = file("assets", id, ext);
  let bytes = 0;
  try {
    await pipeline(
      Readable.fromWeb(req.body as never),
      new Transform({
        transform(chunk, _, cb) {
          bytes += chunk.length;
          cb(bytes > 5 * 1024 ** 3 ? Error("Asset exceeds 5 GB") : null, chunk);
        },
      }),
      createWriteStream(target, { flags: "wx" }),
      { signal: req.signal },
    );
    const info = JSON.parse(
      await run(
        bin.ffprobe,
        [
          "-protocol_whitelist",
          "file,pipe",
          "-format_whitelist",
          "mov,matroska,webm,avi,mpegts,mpeg,mp3,wav,flac,ogg,aac,image2,png_pipe,jpeg_pipe,webp_pipe",
          "-v",
          "error",
          "-show_streams",
          "-show_format",
          "-of",
          "json",
          target,
        ],
        req.signal,
      ),
    );
    const video = info.streams.some(
        (s: { codec_type: string }) => s.codec_type === "video",
      ),
      audio = info.streams.some(
        (s: { codec_type: string }) => s.codec_type === "audio",
      );
    if (!video && !audio) throw Error("No usable media stream");
    const fingerprint = await fingerprintFile(target, bytes);
    const duplicates = (await assetList()).filter(
      (row) => row.fingerprint && row.fingerprint === fingerprint,
    );
    const a: Asset = {
      id,
      name: name.slice(0, 180),
      description: "",
      folder: "",
      tags: [],
      favorite: false,
      kind: video
        ? ["jpg", "jpeg", "png", "webp"].includes(ext)
          ? "image"
          : "video"
        : "audio",
      duration: Number(info.format.duration) || 0,
      ext,
      audio,
      bytes,
      fingerprint,
      usedBy: [],
      collections: [],
    };
    await fs.writeFile(file("assets", id, "json"), JSON.stringify(a));
    return { ...a, duplicates: duplicates.map((d) => d.id) } as Asset & {
      duplicates: string[];
    };
  } catch (e) {
    await fs.rm(target, { force: true });
    throw e;
  }
}
export async function editAsset(id: string, input: Partial<Asset>) {
  const a = await asset(id);
  if (
    typeof input.folder !== "string" ||
    typeof input.description !== "string" ||
    !Array.isArray(input.tags) ||
    typeof input.favorite !== "boolean"
  )
    throw Error("Invalid asset properties");
  if (
    input.collections !== undefined &&
    (!Array.isArray(input.collections) ||
      input.collections.some((c) => typeof c !== "string" || c.length > 80))
  )
    throw Error("Invalid collections");
  if (
    input.rating !== undefined &&
    (!Number.isFinite(input.rating) || input.rating < 0 || input.rating > 5)
  )
    throw Error("Rating must be 0–5");
  if (
    input.colorLabel !== undefined &&
    (typeof input.colorLabel !== "string" ||
      (input.colorLabel && !/^#[0-9a-f]{6}$/i.test(input.colorLabel)))
  )
    throw Error("Invalid color label");
  const updated: Asset = {
    ...a,
    folder: input.folder.slice(0, 80),
    description: input.description.slice(0, 600),
    tags: input.tags
      .filter((v: unknown) => typeof v === "string")
      .slice(0, 30)
      .map((v) => v.slice(0, 60)),
    favorite: input.favorite,
    collections: (input.collections ?? a.collections ?? [])
      .filter((v): v is string => typeof v === "string")
      .slice(0, 40)
      .map((v) => v.slice(0, 80)),
    rating: input.rating ?? a.rating,
    colorLabel: input.colorLabel ?? a.colorLabel,
  };
  const temp = file("assets", randomUUID(), "tmp");
  try {
    await fs.writeFile(temp, JSON.stringify(updated));
    await fs.rename(temp, file("assets", id, "json"));
  } finally {
    await fs.rm(temp, { force: true });
  }
  return updated;
}

/** Record that an entity references an asset. Never auto-deletes. */
export async function linkAsset(id: string, ref: string) {
  if (!/^[0-9a-f-]{36}$/i.test(ref)) throw Error("Invalid asset reference");
  const a = await asset(id);
  const usedBy = [...new Set([...(a.usedBy || []), ref])].slice(0, 200);
  const updated = { ...a, usedBy };
  await fs.writeFile(file("assets", id, "json"), JSON.stringify(updated));
  return updated;
}

export async function unlinkAsset(id: string, ref: string) {
  const a = await asset(id);
  const usedBy = (a.usedBy || []).filter((r) => r !== ref);
  const updated = { ...a, usedBy };
  await fs.writeFile(file("assets", id, "json"), JSON.stringify(updated));
  return updated;
}

/** Refuse deletion when the asset is still referenced. */
export async function assertAssetDeletable(id: string) {
  const a = await asset(id);
  if ((a.usedBy || []).length)
    throw Error(
      "Asset is still used by " +
        a.usedBy!.length +
        " reference(s). Confirm unlink before deleting.",
    );
  return a;
}

export async function findDuplicates(id: string) {
  const a = await asset(id);
  if (!a.fingerprint) return [];
  return (await assetList()).filter(
    (row) => row.id !== id && row.fingerprint === a.fingerprint,
  );
}
