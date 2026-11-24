import { defaults, type Settings, type Highlight } from "./types";
import ipaddr from "ipaddr.js";
export function publicAddress(address: string) {
  try {
    let a = ipaddr.parse(address);
    if (a.kind() === "ipv6" && (a as ipaddr.IPv6).isIPv4MappedAddress())
      a = (a as ipaddr.IPv6).toIPv4Address();
    return a.range() === "unicast";
  } catch {
    return false;
  }
}
export function validId(id: unknown): asserts id is string {
  if (typeof id !== "string" || !/^[0-9a-f-]{36}$/.test(id))
    throw new Error("Invalid project or clip ID");
}
export function settings(input: unknown): Settings {
  const s = {
    ...defaults,
    ...(typeof input === "object" && input ? input : {}),
  } as Settings;
  const choices: Record<string, unknown[]> = {
    duration: ["15-30", "30-60", "60-90"],
    count: [0, 5, 10, 20],
    ratio: ["9:16", "1:1", "4:5", "16:9"],
    resolution: ["720", "1080"],
    style: ["minimal", "bold", "highlight"],
    layout: ["center", "blur", "crop", "facecam", "original"],
    captionPosition: ["bottom", "middle", "top"],
    mode: ["ai", "manual", "split"],
  };
  for (const [k, v] of Object.entries(choices))
    if (!v.includes(s[k as keyof Settings])) throw new Error(`Invalid ${k}`);
  for (const [k, min, max] of [
    ["crop", 0, 100],
    ["fontSize", 20, 120],
    ["manualStart", 0, 43200],
    ["manualEnd", 0, 43200],
  ] as const)
    if (!Number.isFinite(s[k]) || s[k] < min || s[k] > max)
      throw new Error(`Invalid ${k}`);
  if (typeof s.captions !== "boolean")
    throw new Error("Invalid caption setting");
  if (s.model && !/^[a-zA-Z0-9_.:/-]{1,100}$/.test(s.model))
    throw Error("Invalid model name");
  for (const [value, max] of [
    [s.category, 60],
    [s.instructions, 1200],
  ] as const)
    if (
      value !== undefined &&
      (typeof value !== "string" || value.length > max)
    )
      throw Error("Invalid clipping preferences");
  if (
    s.font &&
    !["Arial", "Verdana", "Georgia", "Tahoma", "Courier New"].includes(s.font)
  )
    throw Error("Invalid font");
  if (s.captionAnimation && !["none", "fade"].includes(s.captionAnimation))
    throw Error("Invalid caption animation");
  if (
    s.captionBackground !== undefined &&
    typeof s.captionBackground !== "boolean"
  )
    throw Error("Invalid caption background");
  if (s.captionColor && !/^#[a-fA-F0-9]{6}$/.test(s.captionColor))
    throw Error("Invalid caption color");
  for (const [value, max] of [
    [s.outline, 8],
    [s.shadow, 8],
    [s.volume, 2],
  ] as const)
    if (
      value !== undefined &&
      (!Number.isFinite(value) || value < 0 || value > max)
    )
      throw Error("Invalid render setting");
  for (const [value, min, max] of [
    [s.scale, 1, 2],
    [s.rotation, -180, 180],
    [s.opacity, 0, 1],
    [s.offsetY, 0, 100],
  ] as const)
    if (
      value !== undefined &&
      (!Number.isFinite(value) || value < min || value > max)
    )
      throw Error("Invalid transform setting");
  if (
    s.overlayText !== undefined &&
    (typeof s.overlayText !== "string" || s.overlayText.length > 100)
  )
    throw Error("Overlay text exceeds 100 characters");
  if (
    s.overlayY !== undefined &&
    (!Number.isFinite(s.overlayY) || s.overlayY < 8 || s.overlayY > 90)
  )
    throw Error("Invalid overlay position");
  return s;
}
export function validateHighlights(
  value: unknown,
  duration: number,
  s: Settings,
): Highlight[] {
  if (!Array.isArray(value))
    throw new Error("Ollama returned no highlight array");
  const [min, max] = s.duration.split("-").map(Number);
  const result: Highlight[] = [];
  for (const h of value) {
    if (!h || typeof h !== "object") continue;
    const { start, end, title, reason, score } = h;
    if (
      !Number.isFinite(start) ||
      !Number.isFinite(end) ||
      start < 0 ||
      end > duration ||
      end - start < min ||
      end - start > max ||
      typeof title !== "string" ||
      !title.trim() ||
      typeof reason !== "string" ||
      !reason.trim() ||
      !Number.isFinite(score) ||
      score < 0 ||
      score > 100
    )
      continue;
    result.push({
      start,
      end,
      title: title.slice(0, 160),
      reason: reason.slice(0, 1000),
      score,
      ...(typeof h.postCaption === "string" && h.postCaption.trim()
        ? { postCaption: h.postCaption.trim().slice(0, 2200) }
        : {}),
    });
  }
  const accepted: Highlight[] = [];
  for (const h of result.sort((a, b) => (b.score ?? 0) - (a.score ?? 0))) {
    const duplicate = accepted.some(
      (x) =>
        Math.max(0, Math.min(x.end, h.end) - Math.max(x.start, h.start)) /
          Math.min(x.end - x.start, h.end - h.start) >
        0.5,
    );
    if (!duplicate) accepted.push(h);
  }
  return accepted.sort((a, b) => a.start - b.start);
}
