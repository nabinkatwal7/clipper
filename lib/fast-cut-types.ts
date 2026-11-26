export type CutMode = "lossless" | "accurate" | "smart";

export type CutSegment = {
  id: string;
  start: number;
  end: number;
  label: string;
  color?: string;
  notes?: string;
};

export type CutSession = {
  version: 1;
  sourceProject: string;
  mode: CutMode;
  segments: CutSegment[];
};

const MODE_HELP: Record<CutMode, string> = {
  lossless:
    "Stream copy near keyframes. Fast, no re-encode. Boundaries snap to keyframes — not frame-accurate.",
  accurate:
    "Re-encodes the segment for frame-accurate starts and ends. Slower, highest boundary precision.",
  smart:
    "Re-encodes only when the requested start is far from a keyframe; otherwise uses stream copy.",
};

export function cutModeHelp(mode: CutMode) {
  return MODE_HELP[mode];
}
