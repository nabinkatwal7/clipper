import { stat } from "node:fs/promises";
import { bin, run } from "./process";
export type ExportCheck = {
  duration: number;
  width: number;
  height: number;
  fps: number;
  audio: boolean;
  bytes: number;
  peakDb?: number;
  meanDb?: number;
  warnings: string[];
};
export async function verifyRender(
  target: string,
  width: number,
  height: number,
  expected: number,
  expectAudio: boolean | undefined,
  signal: AbortSignal,
): Promise<ExportCheck> {
  const info = JSON.parse(
    await run(
      bin.ffprobe,
      ["-v", "error", "-show_streams", "-show_format", "-of", "json", target],
      signal,
    ),
  );
  const video = info.streams.find(
    (s: { codec_type: string }) => s.codec_type === "video",
  );
  const audio = info.streams.some(
    (s: { codec_type: string }) => s.codec_type === "audio",
  );
  const duration = Number(info.format.duration);
  const [n, d] = String(video?.avg_frame_rate).split("/").map(Number);
  const fps = n / d;
  const bytes = (await stat(target)).size;
  if (
    !bytes ||
    !video ||
    video.width !== width ||
    video.height !== height ||
    !Number.isFinite(fps) ||
    fps <= 0 ||
    !Number.isFinite(duration) ||
    Math.abs(duration - expected) > Math.max(0.35, 2 / fps) ||
    (expectAudio === true && !audio)
  )
    throw Error(
      "Export validation failed. Check source streams and trim boundaries, then render this clip again.",
    );
  let black = false,
    freeze = false,
    peakDb: number | undefined,
    meanDb: number | undefined;
  await run(
    bin.ffmpeg,
    [
      "-nostdin",
      "-v",
      "info",
      "-xerror",
      "-threads",
      "2",
      "-i",
      target,
      "-vf",
      "scale=160:-2,blackdetect=d=1.2:pix_th=0.08,freezedetect=n=-50dB:d=2",
      "-af",
      "volumedetect",
      "-f",
      "null",
      "-",
    ],
    signal,
    (line) => {
      black ||= line.includes("black_start:");
      freeze ||= line.includes("freeze_start:");
      const m = line.match(/(max|mean)_volume:\s*(-?[\d.]+) dB/);
      if (m) {
        if (m[1] === "max") peakDb = +m[2];
        else meanDb = +m[2];
      }
    },
  );
  const warnings: string[] = [];
  if (black)
    warnings.push(
      "A dark interval was detected. Review the cut for an unintended blank frame.",
    );
  if (freeze)
    warnings.push(
      "A still interval was detected. Check whether this hold is intentional.",
    );
  if (audio && peakDb === 0)
    warnings.push(
      "Audio reaches digital full scale. Check peaks before publishing.",
    );
  return {
    duration,
    width,
    height,
    fps,
    audio,
    bytes,
    peakDb,
    meanDb,
    warnings,
  };
}
