/** Pure signal-processing helpers. No I/O. All outputs are derived from measured input. */

export function median(values: number[]): number {
  const v = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!v.length) return 0;
  const m = v.length >> 1;
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

/**
 * Baseline-relative normalisation to 0..1.
 * Uses the recording's own median and MAD, so a naturally loud stream does not
 * score high everywhere. A flat signal returns all zeros (no information).
 */
export function robustScale(values: ArrayLike<number>): number[] {
  const v = Array.from(values, (x) => (Number.isFinite(x) ? x : 0));
  if (!v.length) return [];
  const med = median(v);
  let spread = median(v.map((x) => Math.abs(x - med))) * 1.4826;
  if (spread < 1e-9) {
    // Mostly-constant signal: fall back to standard deviation so rare bursts still register.
    const mean = v.reduce((a, b) => a + b, 0) / v.length;
    spread = Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / v.length);
  }
  if (spread < 1e-9) return v.map(() => 0);
  return v.map((x) => {
    const z = (x - med) / spread;
    return 1 / (1 + Math.exp(-(z - 2) * 0.9)); // ~0.14 at baseline, 0.5 at +2σ, 0.94 at +5σ
  });
}

/** Centered moving average. Radius 0 returns a copy. */
export function smooth(values: number[], radius: number): number[] {
  if (radius <= 0) return values.slice();
  const out = new Array<number>(values.length);
  let sum = 0;
  let lo = 0;
  let hi = -1;
  for (let i = 0; i < values.length; i++) {
    const nlo = Math.max(0, i - radius);
    const nhi = Math.min(values.length - 1, i + radius);
    while (hi < nhi) sum += values[++hi];
    while (lo < nlo) sum -= values[lo++];
    out[i] = sum / (hi - lo + 1);
  }
  return out;
}

export type Peak = { index: number; value: number };

/** Local maxima above minHeight, thinned so peaks are at least minDistance bins apart. */
export function findPeaks(
  values: number[],
  minHeight: number,
  minDistance: number,
): Peak[] {
  const raw: Peak[] = [];
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    let j = i;
    while (j + 1 < values.length && values[j + 1] === v) j++;
    const left = i === 0 ? -Infinity : values[i - 1];
    const right = j + 1 < values.length ? values[j + 1] : -Infinity;
    if (v >= minHeight && v > left && v > right)
      raw.push({ index: Math.floor((i + j) / 2), value: v });
    i = j; // one index per plateau
  }
  raw.sort((a, b) => b.value - a.value);
  const kept: Peak[] = [];
  for (const p of raw)
    if (kept.every((k) => Math.abs(k.index - p.index) >= minDistance)) kept.push(p);
  return kept.sort((a, b) => a.index - b.index);
}

/** Positive change versus the trailing median — "sudden increase" detector. */
export function suddenRise(values: number[], lookback = 5): number[] {
  return values.map((x, i) =>
    i === 0 ? 0 : Math.max(0, x - median(values.slice(Math.max(0, i - lookback), i))),
  );
}

/** Resample interval-binned values onto a new length by overlap-weighted mean. */
export function resample(values: number[], length: number): number[] {
  if (!values.length || length <= 0) return [];
  const out = new Array<number>(length).fill(0);
  const ratio = values.length / length;
  for (let i = 0; i < length; i++) {
    const a = i * ratio;
    const b = (i + 1) * ratio;
    let acc = 0;
    let w = 0;
    for (let k = Math.floor(a); k < Math.min(values.length, Math.ceil(b)); k++) {
      const overlap = Math.min(b, k + 1) - Math.max(a, k);
      if (overlap > 0) {
        acc += values[k] * overlap;
        w += overlap;
      }
    }
    out[i] = w ? acc / w : 0;
  }
  return out;
}

export function mean(values: number[], from = 0, to = values.length): number {
  const a = Math.max(0, Math.floor(from));
  const b = Math.min(values.length, Math.ceil(to));
  if (b <= a) return 0;
  let s = 0;
  for (let i = a; i < b; i++) s += values[i];
  return s / (b - a);
}
