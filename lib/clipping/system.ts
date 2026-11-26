import os from "node:os";
import { statfs } from "node:fs/promises";
import { bin, run } from "../process";

/** Measured system state only. Anything that cannot be measured is returned as null. */
export type Cpu = { logicalCores: number; model: string; usagePercent: number | null; sampleMs: number };

const totals = () => {
  let idle = 0, total = 0;
  for (const c of os.cpus()) {
    idle += c.times.idle;
    total += c.times.user + c.times.nice + c.times.sys + c.times.idle + c.times.irq;
  }
  return { idle, total, at: Date.now() };
};

/** CPU busy share over a short sampling window, computed from OS counters. */
export async function cpuUsage(windowMs = 400): Promise<Cpu> {
  const a = totals();
  await new Promise((r) => setTimeout(r, windowMs));
  const b = totals();
  const dt = b.total - a.total;
  return {
    logicalCores: os.cpus().length,
    model: os.cpus()[0]?.model.trim() ?? "unknown",
    usagePercent: dt > 0 ? Math.round((1 - (b.idle - a.idle) / dt) * 1000) / 10 : null,
    sampleMs: b.at - a.at,
  };
}

export async function ollamaLoaded(signal?: AbortSignal) {
  try {
    const r = await fetch((process.env.OLLAMA_URL || "http://127.0.0.1:11434") + "/api/ps", { signal: AbortSignal.any([...(signal ? [signal] : []), AbortSignal.timeout(3000)]) });
    if (!r.ok) throw Error();
    const d = await r.json();
    return { reachable: true as const, loaded: (d.models ?? []).map((m: { name: string; size: number; size_vram?: number }) => ({ name: m.name, sizeMb: Math.round(m.size / 1048576), vramMb: Math.round((m.size_vram ?? 0) / 1048576) })) };
  } catch {
    return { reachable: false as const, loaded: [] as { name: string; sizeMb: number; vramMb: number }[] };
  }
}

export type EncoderCheck = { encoder: string; listed: boolean; verified: boolean; detail: string };
const ENCODERS = ["libx264", "h264_qsv", "h264_nvenc", "h264_amf"] as const;
let encoderCache: { at: number; value: EncoderCheck[] } | null = null;

/**
 * "Listed" means FFmpeg was built with the encoder. "Verified" means a real one-frame encode
 * succeeded on this machine just now. Hardware encoders are often listed but unusable.
 */
export async function encoderChecks(signal?: AbortSignal, maxAgeMs = 10 * 60_000): Promise<EncoderCheck[]> {
  if (encoderCache && Date.now() - encoderCache.at < maxAgeMs) return encoderCache.value;
  const listing = await run(bin.ffmpeg, ["-hide_banner", "-encoders"], signal, undefined, 20_000).catch(() => "");
  const out: EncoderCheck[] = [];
  for (const encoder of ENCODERS) {
    const listed = new RegExp(`\\b${encoder}\\b`).test(listing);
    if (!listed) { out.push({ encoder, listed, verified: false, detail: "not in this FFmpeg build" }); continue; }
    try {
      await run(bin.ffmpeg, ["-v", "error", "-f", "lavfi", "-i", "testsrc2=s=256x144:r=10:d=0.5", "-frames:v", "5", "-c:v", encoder, "-pix_fmt", "yuv420p", "-f", "null", "-"], signal, undefined, 15_000);
      out.push({ encoder, listed, verified: true, detail: "test encode succeeded" });
    } catch (e) {
      out.push({ encoder, listed, verified: false, detail: (e instanceof Error ? e.message : String(e)).split("\n").slice(-2).join(" ").slice(0, 160) });
    }
  }
  encoderCache = { at: Date.now(), value: out };
  return out;
}

export async function diskFree(dir: string) {
  const s = await statfs(dir).catch(() => null);
  return s ? { freeBytes: s.bavail * s.bsize, totalBytes: s.blocks * s.bsize } : null;
}

export async function systemSnapshot(dir: string, signal?: AbortSignal) {
  const [cpu, ollama, disk] = await Promise.all([cpuUsage(), ollamaLoaded(signal), diskFree(dir)]);
  const total = os.totalmem(), free = os.freemem();
  return {
    at: new Date().toISOString(),
    cpu,
    memory: { totalMb: Math.round(total / 1048576), freeMb: Math.round(free / 1048576), usedPercent: Math.round((1 - free / total) * 1000) / 10, appRssMb: Math.round(process.memoryUsage().rss / 1048576) },
    disk,
    ollama,
  };
}

// ---- hardware profiles
export type ProfileId = "eco" | "balanced" | "performance";
export type HardwareProfile = {
  id: ProfileId;
  label: string;
  /** Analysis interval in seconds (larger = less CPU). */
  analysisInterval: 1 | 2 | 5;
  /** Which Ollama model class to prefer. */
  model: "light" | "main" | "user";
  aiDefault: boolean;
  previewHeight: number;
  heavyJobs: 1;
  proxyMedia: boolean;
  note: string;
};

export const HARDWARE_PROFILES: HardwareProfile[] = [
  { id: "eco", label: "Eco", analysisInterval: 2, model: "light", aiDefault: false, previewHeight: 360, heavyJobs: 1, proxyMedia: true, note: "No-AI clipping by default, optional small model, minimal sampling." },
  { id: "balanced", label: "Balanced", analysisInterval: 1, model: "main", aiDefault: true, previewHeight: 480, heavyJobs: 1, proxyMedia: true, note: "Main small model where memory permits, one heavy job at a time." },
  { id: "performance", label: "Performance", analysisInterval: 1, model: "user", aiDefault: true, previewHeight: 720, heavyJobs: 1, proxyMedia: false, note: "Your chosen models and higher preview quality. Not recommended below 12 GB RAM." },
];

/** Never recommends Performance automatically. */
export function recommendProfile(totalMb: number): ProfileId {
  return totalMb < 6000 ? "eco" : "balanced";
}

export function profileById(id: string | undefined): HardwareProfile {
  return HARDWARE_PROFILES.find((p) => p.id === id) ?? HARDWARE_PROFILES[0];
}

/** Performance on a small machine needs an explicit acknowledgement. */
export function canSelect(id: ProfileId, totalMb: number, acknowledged: boolean) {
  return id !== "performance" || totalMb >= 12000 || acknowledged;
}
