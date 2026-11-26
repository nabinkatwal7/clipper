import { uuid } from "./id";
import { TEXT_TRACK_ASSET } from "./types";
import type { Track } from "./composition";
import { createShapeTrack } from "./motion-graphics";

export type CalloutKind =
  | "number"
  | "arrow"
  | "highlight"
  | "step"
  | "chapter"
  | "shortcut"
  | "cursor";

export type TutorialAnnotation = {
  id: string;
  kind: CalloutKind;
  at: number;
  length: number;
  x: number;
  y: number;
  label: string;
  /** Normalized 0–1 box size for highlight */
  size?: number;
  color?: string;
};

export const CALLOUT_KINDS: { id: CalloutKind; label: string }[] = [
  { id: "number", label: "Numbered callout" },
  { id: "arrow", label: "Arrow" },
  { id: "highlight", label: "Highlight box" },
  { id: "step", label: "Step marker" },
  { id: "chapter", label: "Chapter marker" },
  { id: "shortcut", label: "Keyboard shortcut" },
  { id: "cursor", label: "Cursor marker" },
];

export function validateAnnotation(input: unknown): TutorialAnnotation {
  const a = input as TutorialAnnotation;
  if (
    !a ||
    typeof a.id !== "string" ||
    !/^[0-9a-f-]{36}$/i.test(a.id) ||
    !CALLOUT_KINDS.some((k) => k.id === a.kind) ||
    !Number.isFinite(a.at) ||
    a.at < 0 ||
    !Number.isFinite(a.length) ||
    a.length < 0.04 ||
    a.length > 120 ||
    !Number.isFinite(a.x) ||
    a.x < 0 ||
    a.x > 1 ||
    !Number.isFinite(a.y) ||
    a.y < 0 ||
    a.y > 1 ||
    typeof a.label !== "string" ||
    !a.label.trim() ||
    a.label.length > 80 ||
    (a.size !== undefined &&
      (!Number.isFinite(a.size) || a.size < 0.05 || a.size > 1)) ||
    (a.color !== undefined && !/^#[0-9a-fA-F]{6}$/.test(a.color))
  )
    throw Error("Invalid tutorial annotation");
  return {
    id: a.id,
    kind: a.kind,
    at: a.at,
    length: a.length,
    x: a.x,
    y: a.y,
    label: a.label.trim(),
    size: a.size,
    color: a.color,
  };
}

export function emptyAnnotation(
  kind: CalloutKind,
  at = 0,
  label?: string,
): TutorialAnnotation {
  const defaults: Record<CalloutKind, string> = {
    number: "1",
    arrow: "→",
    highlight: "Focus",
    step: "Step 1",
    chapter: "Chapter",
    shortcut: "Ctrl+S",
    cursor: "Click",
  };
  return {
    id: uuid(),
    kind,
    at,
    length: kind === "chapter" ? 2 : 3,
    x: kind === "cursor" ? 0.55 : 0.35,
    y: kind === "cursor" ? 0.45 : 0.3,
    label: label || defaults[kind],
    size: kind === "highlight" ? 0.28 : 0.12,
    color:
      kind === "highlight"
        ? "#fbbf24"
        : kind === "cursor"
          ? "#f43f5e"
          : "#14b8a6",
  };
}

/** Convert annotations into composition tracks (text/shapes). Honest: no OS cursor tracking. */
export function annotationsToTracks(
  rows: TutorialAnnotation[],
): Track[] {
  const out: Track[] = [];
  for (const raw of rows.slice(0, 24)) {
    const a = validateAnnotation(raw);
    if (a.kind === "highlight") {
      const box = createShapeTrack("rect", a.at, a.length);
      box.name = `Highlight · ${a.label}`;
      box.x = a.x;
      box.y = a.y;
      box.size = a.size ?? 0.28;
      box.color = a.color || "#fbbf24";
      box.opacity = 0.35;
      out.push(box);
    } else if (a.kind === "cursor") {
      const dot = createShapeTrack("ellipse", a.at, a.length);
      dot.name = "Cursor marker";
      dot.x = a.x;
      dot.y = a.y;
      dot.size = 0.06;
      dot.color = a.color || "#f43f5e";
      out.push(dot);
      out.push({
        id: uuid(),
        name: "Cursor label",
        type: "text",
        text: a.label.slice(0, 40),
        asset: TEXT_TRACK_ASSET,
        at: a.at,
        length: a.length,
        slip: 0,
        x: Math.min(0.95, a.x + 0.06),
        y: Math.max(0.05, a.y - 0.06),
        size: 1,
        opacity: 1,
        volume: 0,
        visible: true,
        muted: true,
        locked: false,
        solo: false,
        loop: false,
        fade: 0.1,
        color: "#ffffff",
        fontSize: 28,
        keys: {},
      });
    } else if (a.kind === "arrow") {
      const line = createShapeTrack("line", a.at, a.length);
      line.name = "Arrow";
      line.x = a.x;
      line.y = a.y;
      line.size = a.size ?? 0.2;
      line.color = a.color || "#14b8a6";
      out.push(line);
      out.push({
        id: uuid(),
        name: "Arrow tip",
        type: "text",
        text: a.label.slice(0, 8) || "→",
        asset: TEXT_TRACK_ASSET,
        at: a.at,
        length: a.length,
        slip: 0,
        x: Math.min(1, a.x + 0.08),
        y: a.y,
        size: 1,
        opacity: 1,
        volume: 0,
        visible: true,
        muted: true,
        locked: false,
        solo: false,
        loop: false,
        fade: 0.05,
        color: a.color || "#14b8a6",
        fontSize: 48,
        keys: {},
      });
    } else {
      const prefix =
        a.kind === "number"
          ? ""
          : a.kind === "shortcut"
            ? "⌨ "
            : a.kind === "chapter"
              ? "§ "
              : "";
      out.push({
        id: uuid(),
        name: `${a.kind} · ${a.label}`.slice(0, 100),
        type: "text",
        text: `${prefix}${a.label}`.slice(0, 80),
        asset: TEXT_TRACK_ASSET,
        at: a.at,
        length: a.length,
        slip: 0,
        x: a.x,
        y: a.y,
        size: 1,
        opacity: 1,
        volume: 0,
        visible: true,
        muted: true,
        locked: false,
        solo: false,
        loop: false,
        fade: 0.12,
        color: a.color || "#ffffff",
        fontSize: a.kind === "chapter" ? 56 : a.kind === "number" ? 64 : 36,
        keys: {
          opacity: [
            { time: 0, value: 0, ease: "out" },
            { time: 0.25, value: 1, ease: "hold" },
          ],
        },
      });
    }
  }
  return out.slice(0, 16);
}
