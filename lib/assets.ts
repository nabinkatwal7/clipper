import { promises as fs, createWriteStream } from "node:fs";
import { randomUUID } from "node:crypto";
import { pipeline } from "node:stream/promises";
import { Readable, Transform } from "node:stream";
import path from "node:path";
import { bin, run } from "./process";
import { file, root } from "./store";
export type Asset = {
  id: string;
  name: string;
  description: string;
  folder: string;
  tags: string[];
  favorite: boolean;
  kind: "video" | "image" | "audio";
  duration: number;
  audio: boolean;
  ext: string;
  bytes: number;
};
export async function asset(id: string): Promise<Asset> {
  return JSON.parse(await fs.readFile(file("assets", id, "json"), "utf8"));
}
export async function assetList() {
  const names = await fs.readdir(path.join(root, "assets"));
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
    };
    await fs.writeFile(file("assets", id, "json"), JSON.stringify(a));
    return a;
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
  const updated = {
    ...a,
    folder: input.folder.slice(0, 80),
    description: input.description.slice(0, 600),
    tags: input.tags
      .filter((v: unknown) => typeof v === "string")
      .slice(0, 30)
      .map((v) => v.slice(0, 60)),
    favorite: input.favorite,
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
