export type SpeedPoint = { time: number; rate: number };

export type SpeedSegment = { start: number; end: number; rate: number };

const round = (n: number) => Math.round(n * 1000) / 1000;

export function validateSpeedCurve(points: SpeedPoint[], length: number) {
  if (!Array.isArray(points) || points.length > 32)
    throw Error("Use at most 32 speed points.");
  if (!points.length) return [] as SpeedPoint[];
  let previous = -1;
  for (const point of points) {
    if (
      !point ||
      !Number.isFinite(point.time) ||
      !Number.isFinite(point.rate) ||
      point.time < 0 ||
      point.time > length ||
      point.time <= previous ||
      point.rate < 0.5 ||
      point.rate > 4
    )
      throw Error("Invalid speed curve point.");
    previous = point.time;
  }
  return points.map((point) => ({
    time: round(point.time),
    rate: round(point.rate),
  }));
}

export function sampleRate(
  points: SpeedPoint[] | undefined,
  time: number,
  fallback = 1,
) {
  if (!points?.length) return fallback;
  if (time <= points[0].time) return points[0].rate;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i],
      b = points[i + 1];
    if (time <= b.time) {
      const t = (time - a.time) / Math.max(0.0001, b.time - a.time);
      return a.rate + (b.rate - a.rate) * t;
    }
  }
  return points.at(-1)!.rate;
}

/** Piecewise-constant segments between control points for reliable FFmpeg remapping. */
export function speedSegments(
  points: SpeedPoint[] | undefined,
  length: number,
  fallback = 1,
): SpeedSegment[] {
  const curve = validateSpeedCurve(points || [], length);
  if (!curve.length)
    return [{ start: 0, end: length, rate: fallback }];
  const anchors = [...curve];
  if (anchors[0].time > 0)
    anchors.unshift({ time: 0, rate: anchors[0].rate });
  if (anchors.at(-1)!.time < length)
    anchors.push({ time: length, rate: anchors.at(-1)!.rate });
  const segments: SpeedSegment[] = [];
  for (let i = 0; i < anchors.length - 1; i++) {
    const start = anchors[i].time,
      end = anchors[i + 1].time;
    if (end - start < 0.04) continue;
    segments.push({
      start,
      end,
      rate: round((anchors[i].rate + anchors[i + 1].rate) / 2),
    });
  }
  return segments.length
    ? segments
    : [{ start: 0, end: length, rate: fallback }];
}

export function outputDuration(
  points: SpeedPoint[] | undefined,
  length: number,
  fallback = 1,
) {
  return speedSegments(points, length, fallback).reduce(
    (sum, segment) => sum + (segment.end - segment.start) / segment.rate,
    0,
  );
}

export function sourceToOutput(
  points: SpeedPoint[] | undefined,
  sourceTime: number,
  length: number,
  fallback = 1,
) {
  let output = 0;
  for (const segment of speedSegments(points, length, fallback)) {
    if (sourceTime <= segment.start) break;
    const span = Math.min(sourceTime, segment.end) - segment.start;
    output += span / segment.rate;
    if (sourceTime <= segment.end) break;
  }
  return output;
}

export function atempoChain(rate: number) {
  const filters: string[] = [];
  let remaining = rate;
  while (remaining > 2) {
    filters.push("atempo=2");
    remaining /= 2;
  }
  while (remaining < 0.5) {
    filters.push("atempo=0.5");
    remaining /= 0.5;
  }
  filters.push(`atempo=${round(remaining)}`);
  return filters.join(",");
}

/** Remap a composed stream whose timeline matches the source clip length. */
export function speedRemapFilters(
  video: string,
  audio: string | null,
  points: SpeedPoint[] | undefined,
  length: number,
  fallback = 1,
) {
  const segments = speedSegments(points, length, fallback);
  if (segments.length === 1 && Math.abs(segments[0].rate - 1) < 0.001) {
    return {
      graph: [] as string[],
      video,
      audio,
      duration: length,
    };
  }
  const graph: string[] = [];
  const videoParts: string[] = [];
  const audioParts: string[] = [];
  segments.forEach((segment, index) => {
    const label = `spd${index}`;
    graph.push(
      `[${video}]trim=${segment.start}:${segment.end},setpts=PTS-STARTPTS,setpts=PTS/${segment.rate}[${label}v]`,
    );
    videoParts.push(`[${label}v]`);
    if (audio) {
      graph.push(
        `[${audio}]atrim=${segment.start}:${segment.end},asetpts=PTS-STARTPTS,${atempoChain(segment.rate)}[${label}a]`,
      );
      audioParts.push(`[${label}a]`);
    }
  });
  graph.push(
    videoParts.join("") + `concat=n=${videoParts.length}:v=1:a=0[speedv]`,
  );
  if (audio && audioParts.length)
    graph.push(
      audioParts.join("") + `concat=n=${audioParts.length}:v=0:a=1[speeda]`,
    );
  return {
    graph,
    video: "speedv",
    audio: audio ? "speeda" : null,
    duration: outputDuration(points, length, fallback),
  };
}

export const speedPresets: {
  id: string;
  label: string;
  build: (length: number) => SpeedPoint[];
}[] = [
  {
    id: "montage",
    label: "Montage",
    build: (length) => [
      { time: 0, rate: 1.6 },
      { time: length * 0.5, rate: 2.2 },
      { time: length, rate: 1.4 },
    ],
  },
  {
    id: "dramatic",
    label: "Dramatic slow motion",
    build: (length) => [
      { time: 0, rate: 1 },
      { time: length * 0.35, rate: 0.55 },
      { time: length * 0.7, rate: 0.7 },
      { time: length, rate: 1 },
    ],
  },
  {
    id: "cinematic",
    label: "Cinematic ramp",
    build: (length) => [
      { time: 0, rate: 0.85 },
      { time: length * 0.45, rate: 1.15 },
      { time: length, rate: 1 },
    ],
  },
];
