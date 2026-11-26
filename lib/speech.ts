import { promises as fs } from "node:fs";
import path from "node:path";
import { file } from "./store";
import { bin, run } from "./process";
import type { Project, Segment } from "./types";

export async function speechConfig() {
  const folder = path.resolve("tools", "whisper");
  const model =
    process.env.CLIPPER_SPEECH_MODEL || path.join(folder, "ggml-base.bin");
  if (!(await fs.stat(model).catch(() => null))?.isFile()) return null;
  if (process.env.CLIPPER_SPEECH_BIN)
    return { command: process.env.CLIPPER_SPEECH_BIN, model };
  const executable =
    process.platform === "win32" ? "whisper-cli.exe" : "whisper-cli";
  const runtime = path.join(folder, "runtime");
  const files = await fs.readdir(runtime, { recursive: true }).catch(() => []);
  const match = files.find((name) => path.basename(name) === executable);
  return match ? { command: path.join(runtime, match), model } : null;
}

export function speechSegments(
  input: unknown,
  offset: number,
  duration: number,
): Segment[] {
  if (
    !input ||
    typeof input !== "object" ||
    !("transcription" in input) ||
    !Array.isArray(input.transcription)
  )
    throw Error("The local speech engine returned an invalid transcript.");
  return input.transcription.flatMap((row) => {
    const start = row?.offsets?.from,
      end = row?.offsets?.to;
    const text = typeof row?.text === "string" ? row.text.trim() : "";
    if (
      !text ||
      /^\[[^\]]*\]$/.test(text) ||
      !Number.isFinite(start) ||
      !Number.isFinite(end)
    )
      return [];
    const from = offset + Math.max(0, start / 1000);
    const to = Math.min(duration, offset + end / 1000);
    return to > from ? [{ start: from, end: to, text, words: [] }] : [];
  });
}

export async function recognizeSpeech(
  project: Project,
  config: NonNullable<Awaited<ReturnType<typeof speechConfig>>>,
  signal: AbortSignal,
  progress: (seconds: number) => void,
) {
  const rows: Segment[] = [];
  const wav = file("temp", project.id, "speech.wav");
  const json = file("temp", project.id, "speech.json");
  const language = process.env.CLIPPER_SPEECH_LANGUAGE || "auto";
  if (!/^(auto|[a-z]{2,3})$/.test(language))
    throw Error("Invalid CLIPPER_SPEECH_LANGUAGE.");
  try {
    for (let offset = 0; offset < project.duration; offset += 600) {
      signal.throwIfAborted();
      const length = Math.min(600, project.duration - offset);
      await run(
        bin.ffmpeg,
        [
          "-y",
          "-v",
          "error",
          "-protocol_whitelist",
          "file,pipe",
          "-ss",
          String(offset),
          "-i",
          file("uploads", project.id, "mp4"),
          "-t",
          String(length),
          "-map",
          "0:a:0",
          "-ac",
          "1",
          "-ar",
          "16000",
          "-c:a",
          "pcm_s16le",
          wav,
        ],
        signal,
      );
      await run(
        config.command,
        [
          "-m",
          config.model,
          "-f",
          wav,
          "-l",
          language,
          "-ng",
          "-t",
          "4",
          "-oj",
          "-of",
          json.slice(0, -5),
          "-pp",
        ],
        signal,
        (line) => {
          const value = line.match(/progress\s*=\s*(\d+)%/i)?.[1];
          if (value)
            progress(offset + (Math.min(100, Number(value)) / 100) * length);
        },
      );
      rows.push(
        ...speechSegments(
          JSON.parse(await fs.readFile(json, "utf8")),
          offset,
          offset + length,
        ),
      );
      await fs.rm(json, { force: true });
      progress(offset + length);
    }
    if (!rows.length) return false;
    await fs.writeFile(json, JSON.stringify(rows));
    await fs.rename(json, file("transcripts", project.id, "json"));
    return true;
  } finally {
    await Promise.allSettled(
      [wav, json].map((target) => fs.rm(target, { force: true })),
    );
  }
}
