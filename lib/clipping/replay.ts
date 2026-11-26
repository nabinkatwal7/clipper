/**
 * Replay heatmap import. Only data the user supplies, or that yt-dlp reports in its public
 * metadata (`heatmap`), is used. Nothing is scraped from undocumented endpoints.
 */
export type ReplayPoint = { start: number; end: number; value: number };

export function parseReplayHeatmap(input: unknown, duration: number): ReplayPoint[] {
  const doc = input && typeof input === "object" && !Array.isArray(input) ? (input as { heatmap?: unknown }).heatmap : input;
  if (!Array.isArray(doc) || !doc.length) throw Error("Heatmap must be a non-empty array.");
  if (doc.length > 20_000) throw Error("Heatmap has too many points.");
  let points: ReplayPoint[];
  if (doc.every((x) => typeof x === "number")) {
    const step = duration / doc.length;
    points = (doc as number[]).map((value, i) => ({ start: i * step, end: (i + 1) * step, value }));
  } else {
    points = doc.map((row: Record<string, unknown>) => {
      const start = Number(row.start_time ?? row.start);
      const end = Number(row.end_time ?? row.end);
      const value = Number(row.value ?? row.intensity);
      if (![start, end, value].every(Number.isFinite) || end <= start || start < 0)
        throw Error("Each heatmap point needs start, end and value.");
      return { start, end, value };
    });
  }
  if (points.some((p) => !Number.isFinite(p.value) || p.value < 0)) throw Error("Heatmap values must be non-negative numbers.");
  return points;
}

/** Overlap-weighted resample onto interval bins. Bins with no coverage stay 0 and are reported. */
export function replayTimeline(points: ReplayPoint[], duration: number, interval: number) {
  const bins = Math.max(1, Math.ceil(duration / interval));
  const sum = new Array<number>(bins).fill(0);
  const weight = new Array<number>(bins).fill(0);
  for (const p of points) {
    const a = Math.max(0, Math.floor(p.start / interval));
    const b = Math.min(bins - 1, Math.floor((p.end - 1e-9) / interval));
    for (let i = a; i <= b; i++) {
      const o = Math.min(p.end, (i + 1) * interval) - Math.max(p.start, i * interval);
      if (o > 0) {
        sum[i] += p.value * o;
        weight[i] += o;
      }
    }
  }
  const values = sum.map((s, i) => (weight[i] ? s / weight[i] : 0));
  const covered = weight.filter((w) => w > 0).length / bins;
  return { values, coverage: covered };
}

/** Local peaks on the raw heatmap, for display and correlation. */
export function replayPeaks(values: number[], minHeight = 0.6): number[] {
  const max = Math.max(0, ...values) || 1;
  const out: number[] = [];
  for (let i = 1; i < values.length - 1; i++)
    if (values[i] / max >= minHeight && values[i] > values[i - 1] && values[i] >= values[i + 1]) out.push(i);
  return out;
}
