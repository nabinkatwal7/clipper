import type { Ease, Keyframe, Track } from "./composition";

export type AnimationPresetId =
  | "fade-in"
  | "fade-out"
  | "slide-in-left"
  | "slide-in-right"
  | "slide-out-left"
  | "slide-out-right"
  | "zoom-in"
  | "zoom-out"
  | "pop-in"
  | "rotate-in";

export const animationPresets: {
  id: AnimationPresetId;
  label: string;
  kind: "entrance" | "exit";
}[] = [
  { id: "fade-in", label: "Fade in", kind: "entrance" },
  { id: "fade-out", label: "Fade out", kind: "exit" },
  { id: "slide-in-left", label: "Slide in left", kind: "entrance" },
  { id: "slide-in-right", label: "Slide in right", kind: "entrance" },
  { id: "slide-out-left", label: "Slide out left", kind: "exit" },
  { id: "slide-out-right", label: "Slide out right", kind: "exit" },
  { id: "zoom-in", label: "Zoom in", kind: "entrance" },
  { id: "zoom-out", label: "Zoom out", kind: "exit" },
  { id: "pop-in", label: "Pop in", kind: "entrance" },
  { id: "rotate-in", label: "Rotate in", kind: "entrance" },
];

const pair = (
  a: number,
  b: number,
  duration: number,
  ease: Ease = "in-out",
): Keyframe[] => [
  { time: 0, value: a, ease },
  { time: duration, value: b, ease: "hold" },
];

const exitPair = (
  a: number,
  b: number,
  length: number,
  duration: number,
  ease: Ease = "in-out",
): Keyframe[] => [
  { time: Math.max(0, length - duration), value: a, ease },
  { time: length, value: b, ease: "hold" },
];

/** Build keyframe patches for a supported entrance/exit preset. */
export function animationPreset(
  id: AnimationPresetId,
  track: Pick<Track, "length" | "x" | "y" | "size" | "opacity" | "rotation">,
  duration = 0.45,
): Track["keys"] {
  const span = Math.max(
    0.04,
    Math.min(duration, Math.max(0.04, track.length / 2)),
  );
  switch (id) {
    case "fade-in":
      return { opacity: pair(0, track.opacity, span, "out") };
    case "fade-out":
      return {
        opacity: exitPair(track.opacity, 0, track.length, span, "in"),
      };
    case "slide-in-left":
      return {
        x: pair(0, track.x, span),
        opacity: pair(0, track.opacity, span, "out"),
      };
    case "slide-in-right":
      return {
        x: pair(1, track.x, span),
        opacity: pair(0, track.opacity, span, "out"),
      };
    case "slide-out-left":
      return {
        x: exitPair(track.x, 0, track.length, span),
        opacity: exitPair(track.opacity, 0, track.length, span, "in"),
      };
    case "slide-out-right":
      return {
        x: exitPair(track.x, 1, track.length, span),
        opacity: exitPair(track.opacity, 0, track.length, span, "in"),
      };
    case "zoom-in":
      return {
        size: pair(
          Math.max(0.05, track.size * 0.45),
          track.size,
          span,
          "out",
        ),
        opacity: pair(0, track.opacity, span, "out"),
      };
    case "zoom-out":
      return {
        size: exitPair(
          track.size,
          Math.max(0.05, track.size * 0.45),
          track.length,
          span,
          "in",
        ),
        opacity: exitPair(track.opacity, 0, track.length, span, "in"),
      };
    case "pop-in":
      return {
        size: [
          { time: 0, value: Math.max(0.05, track.size * 0.35), ease: "out" },
          {
            time: Math.min(span, track.length),
            value: Math.min(1, track.size * 1.08),
            ease: "in",
          },
          {
            time: Math.min(span * 1.35, track.length),
            value: track.size,
            ease: "hold",
          },
        ],
        opacity: pair(0, track.opacity, span * 0.6, "out"),
      };
    case "rotate-in":
      return {
        rotation: pair(-28, track.rotation ?? 0, span, "out"),
        opacity: pair(0, track.opacity, span, "out"),
      };
    default:
      throw Error("Unsupported animation preset");
  }
}

export function applyAnimationPreset(
  track: Track,
  id: AnimationPresetId,
  duration = 0.45,
): Track {
  if (track.type === "audio")
    throw Error("Animation presets require an image or video layer.");
  return {
    ...track,
    keys: { ...track.keys, ...animationPreset(id, track, duration) },
  };
}
