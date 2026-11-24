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
