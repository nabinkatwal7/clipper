import { SIGNAL_IDS, DEFAULT_WEIGHTS, type SignalId, type Weights } from "./profiles";
import { mean, smooth } from "./signals";

/** Tracks are already normalised to 0..1 relative to the recording itself. */
export type Tracks = Partial<Record<SignalId, number[]>>;

export type Contribution = {
  signal: SignalId;
  /** Weight after redistribution among available signals. */
  weight: number;
  /** Mean normalised signal value near the moment (0..1). */
  value: number;
  /** weight * value */
  contribution: number;
};

export type Combined = {
  combined: number[];
  effectiveWeights: Partial<Weights>;
  used: SignalId[];
  /** Signals with no data at all. */
  missing: SignalId[];
  /** Signals present but constant (no information), excluded from the mix. */
  uninformative: SignalId[];
};

/**
 * Weighted combination with weight redistribution: missing or flat signals are dropped and
 * the remaining weights are renormalised to sum to 1.
 */
export function combine(
  tracks: Tracks,
  weights: Weights = DEFAULT_WEIGHTS,
  smoothRadius = 2,
  length = Math.max(0, ...SIGNAL_IDS.map((s) => tracks[s]?.length ?? 0)),
): Combined {
  const used: SignalId[] = [];
  const missing: SignalId[] = [];
  const uninformative: SignalId[] = [];
  for (const s of SIGNAL_IDS) {
    const t = tracks[s];
    if (!t || !t.length) missing.push(s);
    else if (weights[s] <= 0) continue;
    else if (Math.max(...t) <= 0) uninformative.push(s);
    else used.push(s);
  }
  const total = used.reduce((a, s) => a + weights[s], 0);
  const effectiveWeights: Partial<Weights> = {};
  for (const s of used) effectiveWeights[s] = total ? weights[s] / total : 0;
  const raw = new Array<number>(length).fill(0);
  for (const s of used) {
    const t = tracks[s]!;
    const w = effectiveWeights[s]!;
    for (let i = 0; i < length; i++) raw[i] += w * (t[i] ?? 0);
  }
  return { combined: smooth(raw, smoothRadius), effectiveWeights, used, missing, uninformative };
}

/** Per-signal evidence for a moment: where did its score come from? */
export function breakdown(
  tracks: Tracks,
  effectiveWeights: Partial<Weights>,
  from: number,
  to: number,
): Contribution[] {
  const out: Contribution[] = [];
  for (const s of SIGNAL_IDS) {
    const w = effectiveWeights[s];
    const t = tracks[s];
    if (!w || !t) continue;
    const value = mean(t, from, to);
    out.push({ signal: s, weight: w, value, contribution: w * value });
  }
  return out.sort((a, b) => b.contribution - a.contribution);
}
