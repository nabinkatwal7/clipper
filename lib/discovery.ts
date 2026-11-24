import { createHash, randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import { file } from "./store";
import type { Settings, Segment, Highlight } from "./types";
export function analysisWindows(
  rows: Segment[],
  duration: number,
  s: Settings,
) {
  const from = s.analysisFrom ?? 0,
    to = Math.min(duration, s.analysisTo ?? duration),
    length =
      s.analysisDepth === "fast" ? 900 : s.analysisDepth === "deep" ? 300 : 600;
  if (from >= to) throw Error("The selected range is outside this recording.");
  const overlap = Number(s.duration.split("-")[1]);
  const result: { offset: number; end: number; chunk: Segment[] }[] = [];
  for (let offset = from; offset < to; offset += length - overlap) {
    const end = Math.min(to, offset + length);
    const chunk = rows.filter((r) => r.end > offset && r.start < end);
    if (chunk.length) result.push({ offset, end, chunk });
    if (end === to) break;
  }
  return result;
}
export function passesRules(h: Highlight, rows: Segment[], s: Settings) {
  const text = rows
    .filter((r) => r.start < h.end && r.end > h.start)
    .map((r) => r.text)
    .join(" ")
    .toLocaleLowerCase();
  const words = (v?: string) =>
    (v || "")
      .split(",")
      .map((w) => w.trim().toLocaleLowerCase())
      .filter(Boolean);
  const include = words(s.includeWords);
  return (
    Boolean(text.trim()) &&
    (h.score ?? 0) >= (s.minimumScore ?? 0) &&
    (!include.length || include.some((w) => text.includes(w))) &&
    !words(s.excludeWords).some((w) => text.includes(w))
  );
}
export async function cachedText(
  id: string,
  task: string,
  inputs: unknown,
  generate: () => Promise<string>,
) {
  const key = createHash("sha256")
    .update(JSON.stringify([task, inputs]))
    .digest("hex");
  const target = file("temp", id, key + ".json");
  try {
    const hit = JSON.parse(await fs.readFile(target, "utf8"));
    if (typeof hit.text === "string") return hit.text;
  } catch {}
  const text = await generate();
  JSON.parse(text);
  const tmp = target + "." + randomUUID() + ".tmp";
  try {
    await fs.writeFile(tmp, JSON.stringify({ text }));
    await fs.rename(tmp, target);
  } finally {
    await fs.rm(tmp, { force: true });
  }
  return text;
}
export async function ollamaJson(
  model: string,
  prompt: string,
  signal: AbortSignal,
) {
  const r = await fetch(
    (process.env.OLLAMA_URL || "http://127.0.0.1:11434") + "/api/generate",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
        format: "json",
        options: { temperature: 0, num_ctx: 8192, num_predict: 1600 },
      }),
      signal: AbortSignal.any([signal, AbortSignal.timeout(240000)]),
    },
  );
  if (!r.ok)
    throw Error(
      "Ollama could not complete analysis. Check the selected local model.",
    );
  const data = await r.json();
  if (!data.done || typeof data.response !== "string")
    throw Error("Incomplete Ollama response");
  return data.response;
}
