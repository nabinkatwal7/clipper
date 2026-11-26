import type { Segment } from "./types";

export function splitCaption(segments: Segment[], index: number) {
  const segment = segments[index];
  if (!segment) return segments;
  const mid = Math.round(((segment.start + segment.end) / 2) * 1000) / 1000;
  if (mid - segment.start < 0.04 || segment.end - mid < 0.04) return segments;
  const words = segment.words || [];
  const leftWords = words.filter((word) => word.end <= mid);
  const rightWords = words.filter((word) => word.start >= mid);
  const next = [...segments];
  next.splice(
    index,
    1,
    {
      ...segment,
      end: mid,
      text: leftWords.map((w) => w.word).join(" ").trim() || segment.text,
      words: leftWords,
    },
    {
      ...segment,
      start: mid,
      text: rightWords.map((w) => w.word).join(" ").trim() || segment.text,
      words: rightWords,
    },
  );
  return next;
}

export function mergeCaptions(segments: Segment[], index: number) {
  if (index < 0 || index >= segments.length - 1) return segments;
  const a = segments[index],
    b = segments[index + 1];
  const merged: Segment = {
    start: a.start,
    end: b.end,
    text: (a.text + " " + b.text).trim(),
    words: [...(a.words || []), ...(b.words || [])],
  };
  const next = [...segments];
  next.splice(index, 2, merged);
  return next;
}

export function replaceCaptionText(
  segments: Segment[],
  needle: string,
  replace: string,
) {
  if (!needle) return segments;
  return segments.map((segment) => ({
    ...segment,
    text: segment.text.split(needle).join(replace),
    words: (segment.words || []).map((word) => ({
      ...word,
      word: word.word.split(needle).join(replace),
    })),
  }));
}
