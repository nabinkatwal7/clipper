import { findPeaks } from "./signals";
import { breakdown, type Contribution, type Tracks } from "./scoring";
import type { Weights } from "./profiles";
import { normalizeText } from "./hype";

export type Span = { start: number; end: number };
export type TextSegment = Span & { text: string };
export type BoundaryKind = "subtitle" | "silence" | "scene" | "none";

export type Candidate = {
  id: string;
  start: number;
  end: number;
  peakAt: number;
  /** Combined score at the peak, 0..1. A ranking aid, not a prediction of audience performance. */
  score: number;
  breakdown: Contribution[];
  boundary: { start: BoundaryKind; end: BoundaryKind };
  /** transcript: sentence/subtitle aware. media: silence/scene aware. duration-only: no boundary evidence. */
  precision: "transcript" | "media" | "duration-only";
  notes: string[];
  /** Ollama-derived estimates; subjective and separate from the measured `score`. */
  ai?: {
    model: string; hook: number; payoff: number; completeness: number; clarity: number;
    category: string; reason: string; openingText?: string; kind: "ai-estimate";
  };
  metadata?: { title: string; description: string; hashtags: string[]; source: "ollama" | "template" };
  /** Display ordering only: measured score blended with the AI estimate when present. */
  rankScore?: number;
  review?: "pending" | "accepted" | "rejected";
  favorite?: boolean;
};

export type CandidateOptions = {
  interval: number;
  minDuration: number;
  maxDuration: number;
  preContext: number;
  postContext: number;
  minScore: number;
  minSpacing: number;
  count: number;
  /** Window grows outward while the score stays above edgeRatio * peak. */
  edgeRatio?: number;
  boundary: "transcript-first" | "media-first";
};

export type BoundaryEvidence = {
  segments?: TextSegment[];
  silences?: Span[];
  scenes?: number[];
};

const SENTENCE_END = /[.!?…।۔。！？]["')\]]*\s*$/u;

function around(t: number, spans: Span[]) {
  return spans.find((s) => t > s.start + 1e-6 && t < s.end - 1e-6);
}

/** Snap a raw window to real boundaries. Never invents timing; reports what it used. */
export function refineBoundaries(
  raw: Span,
  ev: BoundaryEvidence,
  o: Pick<CandidateOptions, "minDuration" | "maxDuration" | "boundary">,
  duration: number,
) {
  let { start, end } = raw;
  const kinds = { start: "none" as BoundaryKind, end: "none" as BoundaryKind };
  const notes: string[] = [];
  const segs = ev.segments ?? [];
  const useText = segs.length > 0 && o.boundary === "transcript-first";

  if (segs.length) {
    // Never cut inside a subtitle line: widen to include it when there is room, else narrow.
    const s = around(start, segs);
    if (s) {
      const widened = s.start;
      if (end - widened <= o.maxDuration) (start = widened), (kinds.start = "subtitle");
      else (start = s.end), (kinds.start = "subtitle");
    } else {
      const next = segs.find((x) => x.start >= start);
      if (next && next.start - start < 1.5) (start = next.start), (kinds.start = "subtitle");
    }
    const e = around(end, segs);
    if (e) {
      if (e.end - start <= o.maxDuration) (end = e.end), (kinds.end = "subtitle");
      else (end = e.start), (kinds.end = "subtitle");
    }
    // Unfinished sentence: extend over up to two following lines if they follow closely.
    for (let n = 0; n < 2; n++) {
      const last = [...segs].reverse().find((x) => x.end <= end + 0.01 && x.end > end - 4);
      if (!last || SENTENCE_END.test(last.text)) break;
      const next = segs.find((x) => x.start >= last.end - 0.01 && x.start - last.end < 0.8);
      if (!next || next.end - start > o.maxDuration) break;
      end = next.end;
      kinds.end = "subtitle";
      notes.push("extended to finish sentence");
    }
  }
  if (kinds.start === "none" && ev.silences?.length) {
    const hit = ev.silences.find((s) => s.end > start - 2.5 && s.end < start + 2.5) ;
    if (hit) (start = Math.min(hit.end, end - o.minDuration), (kinds.start = "silence"));
  }
  if (kinds.end === "none" && ev.silences?.length) {
    const hit = ev.silences.find((s) => s.start > end - 2.5 && s.start < end + 2.5);
    if (hit && hit.start - start >= o.minDuration) (end = hit.start + 0.2, (kinds.end = "silence"));
  }
  if (kinds.start === "none" && ev.scenes?.length) {
    const cut = nearest(ev.scenes, start, 1.5);
    if (cut !== null) (start = cut), (kinds.start = "scene");
  }
  if (kinds.end === "none" && ev.scenes?.length) {
    const cut = nearest(ev.scenes, end, 1.5);
    if (cut !== null && cut - start >= o.minDuration) (end = cut), (kinds.end = "scene");
  }
  // Trim long leading silence.
  const lead = ev.silences?.find((s) => s.start <= start + 0.05 && s.end > start + 1.5 && s.end < end - o.minDuration);
  if (lead) (start = Math.max(start, lead.end - 0.3), notes.push("trimmed leading silence"));

  start = Math.max(0, start);
  end = Math.min(duration, end);
  if (end - start > o.maxDuration) (end = start + o.maxDuration, notes.push("hard-capped at max duration; end may be mid-sentence"), (kinds.end = "none"));
  const evidence = useText || (segs.length && kinds.start !== "none") ? "transcript" : kinds.start !== "none" || kinds.end !== "none" ? "media" : "duration-only";
  if (evidence === "duration-only") notes.push("no boundary evidence available; reduced precision");
  return { start, end, kinds, precision: evidence as Candidate["precision"], notes };
}

function nearest(values: number[], at: number, tolerance: number): number | null {
  let best: number | null = null;
  for (const v of values) if (Math.abs(v - at) <= tolerance && (best === null || Math.abs(v - at) < Math.abs(best - at))) best = v;
  return best;
}

const tokens = (t: string) => new Set(normalizeText(t).split(" ").filter((w) => w.length > 2));
function similarity(a: string, b: string) {
  const x = tokens(a), y = tokens(b);
  if (x.size < 5 || y.size < 5) return 0;
  let n = 0;
  for (const w of x) if (y.has(w)) n++;
  return n / (x.size + y.size - n);
}

/**
 * Convert a combined score track into candidate windows:
 * peak detection → adaptive window → context → boundary refinement → overlap merge →
 * spacing → duplicate removal → top-N → chronological order.
 */
export function generateCandidates(
  combined: number[],
  tracks: Tracks,
  effectiveWeights: Partial<Weights>,
  evidence: BoundaryEvidence,
  o: CandidateOptions,
  duration: number,
): Candidate[] {
  const bin = (t: number) => Math.min(combined.length - 1, Math.max(0, Math.floor(t / o.interval)));
  const peaks = findPeaks(combined, o.minScore, Math.max(1, Math.round(o.minDuration / 2 / o.interval)));
  const edge = o.edgeRatio ?? 0.55;
  const draft: Candidate[] = [];
  for (const pk of peaks) {
    const peakAt = (pk.index + 0.5) * o.interval;
    let a = pk.index, b = pk.index;
    const floor = pk.value * edge;
    const maxSide = Math.floor((o.maxDuration * 0.5) / o.interval);
    while (a > 0 && combined[a - 1] >= floor && pk.index - a < maxSide) a--;
    while (b < combined.length - 1 && combined[b + 1] >= floor && b - pk.index < maxSide) b++;
    let start = a * o.interval - o.preContext;
    let end = (b + 1) * o.interval + o.postContext;
    // Enforce duration limits around the peak (more room after it: payoff matters).
    if (end - start < o.minDuration) {
      const missing = o.minDuration - (end - start);
      start -= missing * 0.4;
      end += missing * 0.6;
    }
    if (end - start > o.maxDuration) {
      const keepBefore = Math.min(peakAt - start, o.maxDuration * 0.4);
      start = peakAt - keepBefore;
      end = start + o.maxDuration;
    }
    start = Math.max(0, start);
    end = Math.min(duration, end);
    if (end - start < o.minDuration) {
      // near a file edge: shift rather than shrink
      if (start === 0) end = Math.min(duration, o.minDuration);
      else start = Math.max(0, end - o.minDuration);
    }
    const r = refineBoundaries({ start, end }, evidence, o, duration);
    if (r.end - r.start < Math.min(o.minDuration, duration) * 0.8) continue;
    const peakBin = bin(peakAt);
    draft.push({
      id: "",
      start: round(r.start),
      end: round(r.end),
      peakAt: round(peakAt),
      score: pk.value,
      breakdown: breakdown(tracks, effectiveWeights, peakBin - 1, peakBin + 2),
      boundary: r.kinds,
      precision: r.precision,
      notes: r.notes,
    });
  }
  return finalize(draft, evidence.segments ?? [], o);
}

const round = (n: number) => Math.round(n * 100) / 100;

function finalize(draft: Candidate[], segments: TextSegment[], o: CandidateOptions): Candidate[] {
  // Highest score first so the strongest candidate wins every conflict.
  const ranked = [...draft].sort((a, b) => b.score - a.score);
  const kept: Candidate[] = [];
  const text = (c: Candidate) => segments.filter((s) => s.end > c.start && s.start < c.end).map((s) => s.text).join(" ");
  for (const c of ranked) {
    const clash = kept.find((k) => {
      const overlap = Math.min(k.end, c.end) - Math.max(k.start, c.start);
      if (overlap > 0.3 * Math.min(k.end - k.start, c.end - c.start)) return true;
      const gap = Math.max(k.start, c.start) - Math.min(k.end, c.end);
      return gap < o.minSpacing;
    });
    if (clash) {
      // Merge into the stronger candidate when the union still fits; otherwise drop the weaker.
      const union = { start: Math.min(clash.start, c.start), end: Math.max(clash.end, c.end) };
      const overlaps = Math.min(clash.end, c.end) > Math.max(clash.start, c.start);
      if (overlaps && union.end - union.start <= o.maxDuration) {
        clash.start = union.start;
        clash.end = union.end;
        clash.notes.push("merged with overlapping candidate");
      }
      continue;
    }
    if (segments.length && kept.some((k) => similarity(text(k), text(c)) > 0.8)) continue;
    kept.push(c);
  }
  return kept
    .slice(0, o.count)
    .sort((a, b) => a.start - b.start)
    .map((c, i) => ({ ...c, id: "m" + (i + 1) }));
}
