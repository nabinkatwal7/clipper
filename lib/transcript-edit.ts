import type { Segment } from "./types";

export type TimeRange = { start: number; end: number };

export type TranscriptCutState = {
  version: 1;
  /** Contiguous source ranges still in the rough cut (composition time order). */
  keep: TimeRange[];
  /** Ranges removed from the rough cut (non-destructive). */
  removed: TimeRange[];
  /** Caption text overrides that do not change audio/video. */
  captionOverrides: { start: number; text: string }[];
};

export function emptyCutState(duration: number): TranscriptCutState {
  if (!Number.isFinite(duration) || duration <= 0)
    return { version: 1, keep: [], removed: [], captionOverrides: [] };
  return {
    version: 1,
    keep: [{ start: 0, end: duration }],
    removed: [],
    captionOverrides: [],
  };
}

export function validateRange(r: TimeRange) {
  if (
    !r ||
    !Number.isFinite(r.start) ||
    !Number.isFinite(r.end) ||
    r.start < 0 ||
    r.end <= r.start
  )
    throw Error("Invalid time range");
  return r;
}

function mergeRanges(rows: TimeRange[]): TimeRange[] {
  const sorted = [...rows]
    .map(validateRange)
    .sort((a, b) => a.start - b.start);
  const out: TimeRange[] = [];
  for (const row of sorted) {
    const last = out[out.length - 1];
    if (last && row.start <= last.end + 0.001) {
      last.end = Math.max(last.end, row.end);
    } else out.push({ ...row });
  }
  return out;
}

function subtractRange(keep: TimeRange[], cut: TimeRange): TimeRange[] {
  validateRange(cut);
  const next: TimeRange[] = [];
  for (const row of keep) {
    if (cut.end <= row.start || cut.start >= row.end) {
      next.push(row);
      continue;
    }
    if (cut.start > row.start) next.push({ start: row.start, end: cut.start });
    if (cut.end < row.end) next.push({ start: cut.end, end: row.end });
  }
  return next.filter((r) => r.end - r.start >= 0.04);
}

/** Map selected transcript segments to a single source time range. */
export function selectionRange(segments: Segment[], indices: number[]): TimeRange {
  if (!indices.length) throw Error("Select transcript text first");
  const chosen = indices
    .filter((i) => Number.isInteger(i) && i >= 0 && i < segments.length)
    .map((i) => segments[i]);
  if (!chosen.length) throw Error("Selection is outside the transcript");
  if (chosen.some((s) => !Number.isFinite(s.start) || !Number.isFinite(s.end)))
    throw Error("Transcript timestamps are incomplete");
  return validateRange({
    start: Math.min(...chosen.map((s) => s.start)),
    end: Math.max(...chosen.map((s) => s.end)),
  });
}

/** Remove dialogue corresponding to selected segments (non-destructive). */
export function deleteDialogue(
  state: TranscriptCutState,
  segments: Segment[],
  indices: number[],
): TranscriptCutState {
  const cut = selectionRange(segments, indices);
  return {
    ...state,
    keep: subtractRange(state.keep, cut),
    removed: mergeRanges([...state.removed, cut]),
  };
}

/** Restore a previously removed range back into the keep list. */
export function restoreRemoved(
  state: TranscriptCutState,
  range: TimeRange,
): TranscriptCutState {
  validateRange(range);
  return {
    ...state,
    keep: mergeRanges([...state.keep, range]),
    removed: state.removed.filter(
      (r) => !(r.start === range.start && r.end === range.end),
    ),
  };
}

/**
 * Reorder keep ranges by moving a paragraph block identified by segment indices.
 * Operates on keep ranges that intersect the selection.
 */
export function moveSelection(
  state: TranscriptCutState,
  segments: Segment[],
  indices: number[],
  targetIndex: number,
): TranscriptCutState {
  const range = selectionRange(segments, indices);
  const moving = state.keep.filter(
    (r) => r.start < range.end && r.end > range.start,
  );
  if (!moving.length) throw Error("Selection is not in the current rough cut");
  const rest = state.keep.filter(
    (r) => !(r.start < range.end && r.end > range.start),
  );
  const at = Math.max(0, Math.min(targetIndex, rest.length));
  const keep = [...rest.slice(0, at), ...moving, ...rest.slice(at)];
  return { ...state, keep };
}

/** Create a clip highlight draft from selected transcript text. */
export function clipFromSelection(
  segments: Segment[],
  indices: number[],
  title?: string,
) {
  const range = selectionRange(segments, indices);
  const text = indices
    .filter((i) => i >= 0 && i < segments.length)
    .map((i) => segments[i].text.trim())
    .filter(Boolean)
    .join(" ");
  return {
    start: range.start,
    end: range.end,
    title: (title || text.slice(0, 80) || "Transcript clip").slice(0, 120),
    reason: "Created from transcript selection",
    score: null as number | null,
  };
}

/** Caption-only edit — never mutates keep/removed media ranges. */
export function overrideCaption(
  state: TranscriptCutState,
  start: number,
  text: string,
): TranscriptCutState {
  if (!Number.isFinite(start) || typeof text !== "string" || !text.trim())
    throw Error("Enter caption text");
  if (text.length > 4000) throw Error("Caption exceeds 4000 characters");
  const captionOverrides = [
    ...state.captionOverrides.filter((c) => c.start !== start),
    { start, text: text.trim() },
  ].slice(0, 2000);
  return { ...state, captionOverrides };
}

/** Total duration of the current rough cut. */
export function cutDuration(state: TranscriptCutState) {
  return state.keep.reduce((sum, r) => sum + (r.end - r.start), 0);
}

/** Segments still present in the rough cut, with optional caption overrides. */
export function editedTranscript(
  segments: Segment[],
  state: TranscriptCutState,
): Segment[] {
  const overrides = new Map(
    state.captionOverrides.map((c) => [c.start, c.text]),
  );
  return segments
    .filter((s) =>
      state.keep.some((r) => s.start < r.end && s.end > r.start),
    )
    .map((s) => ({
      ...s,
      text: overrides.get(s.start) ?? s.text,
    }));
}

/** Diff helpers for comparison UI. */
export function transcriptComparison(
  original: Segment[],
  state: TranscriptCutState,
) {
  const edited = editedTranscript(original, state);
  const removedText = original
    .filter((s) =>
      state.removed.some((r) => s.start < r.end && s.end > r.start),
    )
    .map((s) => s.text);
  return {
    original,
    edited,
    removedText,
    originalDuration: original.length
      ? Math.max(...original.map((s) => s.end)) -
        Math.min(...original.map((s) => s.start))
      : 0,
    editedDuration: cutDuration(state),
    removedRanges: state.removed,
    keepRanges: state.keep,
  };
}

export function validateCutState(input: unknown): TranscriptCutState {
  if (!input || typeof input !== "object") throw Error("Invalid cut state");
  const s = input as TranscriptCutState;
  if (s.version !== 1 || !Array.isArray(s.keep) || !Array.isArray(s.removed))
    throw Error("Unsupported transcript cut document");
  if (s.keep.length > 500 || s.removed.length > 500)
    throw Error("Too many transcript cut ranges");
  s.keep.forEach(validateRange);
  s.removed.forEach(validateRange);
  if (!Array.isArray(s.captionOverrides) || s.captionOverrides.length > 2000)
    throw Error("Invalid caption overrides");
  for (const c of s.captionOverrides) {
    if (
      !Number.isFinite(c.start) ||
      typeof c.text !== "string" ||
      !c.text.trim() ||
      c.text.length > 4000
    )
      throw Error("Invalid caption override");
  }
  return s;
}
