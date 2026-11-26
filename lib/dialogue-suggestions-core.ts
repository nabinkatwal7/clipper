import type { Segment } from "./types";
import { selectionRange, type TimeRange } from "./transcript-edit";

export type DialogueLanguage = "en" | "ne" | "hi" | "mixed";

export type DialogueSuggestion = {
  id: string;
  kind:
    | "filler"
    | "repeat"
    | "pause"
    | "intro"
    | "outro"
    | "concise"
    | "reorder"
    | "opening"
    | "ending";
  why: string;
  ranges: TimeRange[];
  action: "remove" | "keep";
  source: "dictionary" | "ollama";
  approved?: boolean;
};

export const fillerDictionaries: Record<DialogueLanguage, string[]> = {
  en: [
    "um",
    "uh",
    "er",
    "ah",
    "like",
    "you know",
    "i mean",
    "sort of",
    "kind of",
    "basically",
    "literally",
    "right",
    "okay so",
    "so yeah",
  ],
  ne: ["अँ", "अं", "हजुर", "के भनूँ", "अनि", "त्यो", "अँ अँ", "हैन"],
  hi: ["अं", "उह", "मतलब", "यानी", "वैसे", "तो", "ना", "हाँ तो", "अरे"],
  mixed: [
    "um",
    "uh",
    "like",
    "you know",
    "अँ",
    "मतलब",
    "basically",
    "अनि",
    "okay so",
  ],
};

function normalize(text: string) {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function segmentIsFiller(seg: Segment, dict: string[]) {
  const t = normalize(seg.text);
  if (!t || t.length > 48) return false;
  return dict.some((f) => t === f || t === f + "." || t.startsWith(f + " "));
}

function nearDuplicate(a: string, b: string) {
  const x = normalize(a),
    y = normalize(b);
  if (!x || !y || Math.abs(x.length - y.length) > 24) return false;
  if (x === y) return true;
  const aw = new Set(x.match(/[\p{L}\p{N}]+/gu) || []),
    bw = y.match(/[\p{L}\p{N}]+/gu) || [];
  if (aw.size < 4 || bw.length < 4) return false;
  let common = 0;
  for (const w of bw) if (aw.has(w)) common++;
  return common / Math.max(aw.size, bw.length) > 0.85;
}

export function dictionarySuggestions(
  rows: Segment[],
  language: DialogueLanguage = "mixed",
): DialogueSuggestion[] {
  const dict = fillerDictionaries[language] || fillerDictionaries.mixed;
  const out: DialogueSuggestion[] = [];
  const fillerIdx: number[] = [];
  rows.forEach((row, i) => {
    if (segmentIsFiller(row, dict) && row.end - row.start <= 2.5)
      fillerIdx.push(i);
  });
  if (fillerIdx.length) {
    out.push({
      id: "dict-filler",
      kind: "filler",
      why: `Remove ${fillerIdx.length} short filler utterance(s) for ${language}.`,
      ranges: fillerIdx.map((i) => selectionRange(rows, [i])),
      action: "remove",
      source: "dictionary",
    });
  }
  for (let i = 1; i < rows.length; i++) {
    if (!nearDuplicate(rows[i - 1].text, rows[i].text)) continue;
    out.push({
      id: "dict-repeat-" + i,
      kind: "repeat",
      why: "Repeated sentence detected; keep the clearer second take or remove the first.",
      ranges: [selectionRange(rows, [i - 1])],
      action: "remove",
      source: "dictionary",
    });
    if (out.length > 20) break;
  }
  for (let i = 1; i < rows.length; i++) {
    const gap = rows[i].start - rows[i - 1].end;
    if (gap >= 2.5 && gap <= 12) {
      out.push({
        id: "dict-pause-" + i,
        kind: "pause",
        why: `Awkward pause of ${gap.toFixed(1)}s between lines.`,
        ranges: [{ start: rows[i - 1].end, end: rows[i].start }],
        action: "remove",
        source: "dictionary",
      });
    }
    if (out.filter((s) => s.kind === "pause").length >= 8) break;
  }
  if (rows.length >= 4) {
    const head = rows.slice(0, Math.min(3, rows.length));
    const headText = head.map((r) => normalize(r.text)).join(" ");
    if (
      /\b(welcome|hello|hi everyone|let me start|before we|introduction)\b/i.test(
        headText,
      ) ||
      /नमस्ते|स्वागत|सुरु|शुरुआत/.test(headText)
    ) {
      out.push({
        id: "dict-intro",
        kind: "intro",
        why: "Opening looks like an introduction that may be skippable for short-form.",
        ranges: [{ start: head[0].start, end: head[head.length - 1].end }],
        action: "remove",
        source: "dictionary",
      });
    }
  }
  return out.slice(0, 24);
}

export function applyApprovedRemovals(
  keep: TimeRange[],
  suggestions: DialogueSuggestion[],
): TimeRange[] {
  let next = keep.map((r) => ({ ...r }));
  for (const s of suggestions) {
    if (!s.approved || s.action !== "remove") continue;
    for (const cut of s.ranges) {
      const rebuilt: TimeRange[] = [];
      for (const row of next) {
        if (cut.end <= row.start || cut.start >= row.end) {
          rebuilt.push(row);
          continue;
        }
        if (cut.start > row.start)
          rebuilt.push({ start: row.start, end: cut.start });
        if (cut.end < row.end) rebuilt.push({ start: cut.end, end: row.end });
      }
      next = rebuilt.filter((r) => r.end - r.start >= 0.04);
    }
  }
  return next;
}

export function validateSuggestion(
  item: unknown,
  duration: number,
): DialogueSuggestion | null {
  if (!item || typeof item !== "object") return null;
  const row = item as DialogueSuggestion;
  if (
    typeof row.why !== "string" ||
    !row.why.trim() ||
    ![
      "filler",
      "repeat",
      "pause",
      "intro",
      "outro",
      "concise",
      "reorder",
      "opening",
      "ending",
    ].includes(row.kind) ||
    !["remove", "keep"].includes(row.action) ||
    !Array.isArray(row.ranges) ||
    !row.ranges.length ||
    row.ranges.length > 12
  )
    return null;
  const ranges: TimeRange[] = [];
  for (const r of row.ranges) {
    if (
      !r ||
      !Number.isFinite(r.start) ||
      !Number.isFinite(r.end) ||
      r.start < 0 ||
      r.end > duration + 0.05 ||
      r.end - r.start < 0.04 ||
      r.end - r.start > 600
    )
      return null;
    ranges.push({ start: r.start, end: r.end });
  }
  return {
    id:
      typeof row.id === "string"
        ? row.id.slice(0, 80)
        : "sug-" + Math.random().toString(36).slice(2, 10),
    kind: row.kind,
    why: row.why.trim().slice(0, 400),
    ranges,
    action: row.action,
    source: "ollama",
  };
}
