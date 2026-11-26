import { existsSync } from "node:fs";
import { diagnostics } from "./diagnostics";
import { bin } from "./process";

export type Capability = {
  id: string;
  label: string;
  available: boolean;
  detail: string;
};

/** Detect local tooling and engine capabilities for feature gating. */
export async function capabilities(signal?: AbortSignal): Promise<{
  generatedAt: string;
  items: Capability[];
  raw: Awaited<ReturnType<typeof diagnostics>>;
}> {
  const abort = signal ?? AbortSignal.timeout(15000);
  const raw = await diagnostics(abort);
  const ffmpegOk = existsSync(bin.ffmpeg);
  const ffprobeOk = existsSync(bin.ffprobe);
  const items: Capability[] = [
    {
      id: "ffmpeg",
      label: "FFmpeg",
      available: ffmpegOk,
      detail: ffmpegOk
        ? `${raw.encoders.length} known encoder(s)`
        : "binary missing",
    },
    {
      id: "ffprobe",
      label: "FFprobe",
      available: ffprobeOk,
      detail: ffprobeOk ? "available" : "binary missing",
    },
    {
      id: "ollama",
      label: "Ollama",
      available: (raw.models || []).length > 0,
      detail:
        (raw.models || []).length > 0
          ? `${raw.models.length} model(s)`
          : "no models or unreachable",
    },
    {
      id: "hardware-encode",
      label: "Hardware H.264",
      available: raw.encoders.some((e) =>
        /nvenc|qsv|amf|videotoolbox/i.test(e),
      ),
      detail:
        raw.encoders
          .filter((e) => /nvenc|qsv|amf|videotoolbox/i.test(e))
          .join(", ") || "software only",
    },
    {
      id: "libass",
      label: "ASS subtitles",
      available: raw.filters.includes("subtitles"),
      detail: raw.filters.includes("subtitles")
        ? "subtitles filter present"
        : "subtitles filter missing",
    },
    {
      id: "composition",
      label: "Multi-track composition",
      available: true,
      detail: "JSON composition v1 + project sequences",
    },
    {
      id: "templates",
      label: "Editing templates",
      available: true,
      detail: "JSON + ZIP packs",
    },
    {
      id: "xfade",
      label: "Transitions (xfade)",
      available: raw.filters.includes("xfade"),
      detail: raw.filters.includes("xfade") ? "available" : "missing",
    },
  ];
  return { generatedAt: new Date().toISOString(), items, raw };
}
