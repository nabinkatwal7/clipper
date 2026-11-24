import { promises as fs } from "node:fs";
import { randomUUID } from "node:crypto";
import { file } from "./store";
import { bin, run } from "./process";
import type { Project } from "./types";
export function coordinates(raw: unknown) {
  const v = raw as { x: number; y: number };
  if (
    !v ||
    ![v.x, v.y].every(
      (n) => typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 1,
    )
  )
    throw Error("Vision model returned an invalid crop position.");
  return { x: v.x, y: v.y };
}
export async function suggestCrop(
  p: Project,
  at: number,
  model: string,
  signal: AbortSignal,
) {
  if (
    !Number.isFinite(at) ||
    at < 0 ||
    at >= p.duration ||
    typeof model !== "string" ||
    !model ||
    model.length > 160
  )
    throw Error("Choose an available frame and vision model.");
  const url = process.env.OLLAMA_URL || "http://127.0.0.1:11434";
  const post = (endpoint: string, body: object) =>
    fetch(url + endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.any([signal, AbortSignal.timeout(180000)]),
    });
  const info = await post("/api/show", { model });
  if (!info.ok || !(await info.json()).capabilities?.includes("vision"))
    throw Error("The selected installed model must support image input.");
  const image = file("temp", randomUUID(), "jpg");
  try {
    await run(
      bin.ffmpeg,
      [
        "-v",
        "error",
        "-protocol_whitelist",
        "file,pipe",
        "-ss",
        String(at),
        "-i",
        file("uploads", p.id, "mp4"),
        "-frames:v",
        "1",
        "-vf",
        "scale=640:360:force_original_aspect_ratio=decrease",
        "-q:v",
        "4",
        image,
      ],
      signal,
    );
    const r = await post("/api/generate", {
      model,
      stream: false,
      prompt:
        "Inspect this single source frame. Return normalized focal point coordinates x and y for the main subject, measured from the upper left, for an editor positioning a vertical crop. Return only coordinates.",
      images: [(await fs.readFile(image)).toString("base64")],
      format: {
        type: "object",
        properties: {
          x: { type: "number", minimum: 0, maximum: 1 },
          y: { type: "number", minimum: 0, maximum: 1 },
        },
        required: ["x", "y"],
      },
      options: { temperature: 0, num_predict: 128 },
    });
    if (!r.ok) throw Error("Vision inference failed.");
    const data = await r.json();
    if (!data.done) throw Error("Incomplete vision result");
    return coordinates(JSON.parse(data.response));
  } finally {
    await fs.rm(image, { force: true });
  }
}
