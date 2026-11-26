import { promises as fs } from "node:fs";
import { bin, run } from "./process";
import { file } from "./store";
import { asset } from "./assets";

export type ProxyTarget =
  | { kind: "source"; project: string }
  | { kind: "asset"; id: string };

export function proxyPath(target: ProxyTarget) {
  if (target.kind === "source")
    return file("uploads", target.project, "proxy.mp4");
  return file("assets", target.id, "proxy.mp4");
}

export async function originalPath(target: ProxyTarget) {
  if (target.kind === "source") return file("uploads", target.project, "mp4");
  const media = await asset(target.id);
  if (media.kind !== "video") throw Error("Proxies are only for video media.");
  return file("assets", media.id, media.ext);
}

export async function proxyStatus(target: ProxyTarget) {
  const original = await originalPath(target);
  const proxy = proxyPath(target);
  const source = await fs.stat(original).catch(() => null);
  if (!source) throw Error("Original media is missing.");
  const cached = await fs.stat(proxy).catch(() => null);
  return {
    originalBytes: source.size,
    proxyBytes: cached?.size ?? 0,
    ready: !!cached && cached.mtimeMs >= source.mtimeMs,
    path: proxy,
  };
}

/** Create or refresh a low-resolution H.264 proxy. Final exports never use this file. */
export async function buildProxy(target: ProxyTarget, signal?: AbortSignal) {
  const original = await originalPath(target);
  const proxy = proxyPath(target);
  const temporary = proxy + ".tmp.mp4";
  await fs.rm(temporary, { force: true });
  try {
    await run(
      bin.ffmpeg,
      [
        "-hide_banner",
        "-y",
        "-i",
        original,
        "-an",
        "-vf",
        "scale='min(854,iw)':-2:force_original_aspect_ratio=decrease:force_divisible_by=2",
        "-c:v",
        "libx264",
        "-preset",
        process.env.FFMPEG_PRESET || "superfast",
        "-crf",
        "28",
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
        temporary,
      ],
      signal,
    );
    await fs.rename(temporary, proxy);
  } finally {
    await fs.rm(temporary, { force: true });
  }
  return proxyStatus(target);
}

export async function removeProxy(target: ProxyTarget) {
  await fs.rm(proxyPath(target), { force: true });
  return { ready: false, proxyBytes: 0 };
}

export async function resolvePreviewMedia(
  target: ProxyTarget,
  preferProxy: boolean,
) {
  if (preferProxy) {
    const status = await proxyStatus(target).catch(() => null);
    if (status?.ready) return { path: proxyPath(target), proxy: true };
  }
  return { path: await originalPath(target), proxy: false };
}
