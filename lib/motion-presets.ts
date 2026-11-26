import { applyAnimationPreset, type AnimationPresetId } from "./animation-presets";
import { sampleCurve, type Track } from "./composition";
import { createShapeTrack } from "./motion-graphics";
import { TEXT_TRACK_ASSET } from "./types";
import { uuid } from "./id";

export type MotionTitlePresetId =
  | "lower-third"
  | "centered-title"
  | "impact-pop"
  | "subscribe-bar"
  | "chapter-card";

export const motionTitlePresets: {
  id: MotionTitlePresetId;
  label: string;
  description: string;
}[] = [
  {
    id: "lower-third",
    label: "Lower third",
    description: "Name plate sliding in from the left",
  },
  {
    id: "centered-title",
    label: "Centered title",
    description: "Fade + zoom title card",
  },
  {
    id: "impact-pop",
    label: "Impact pop",
    description: "Bold title with pop-in and pulse",
  },
  {
    id: "subscribe-bar",
    label: "Subscribe bar",
    description: "Bottom CTA bar with slide-up",
  },
  {
    id: "chapter-card",
    label: "Chapter card",
    description: "Full-width chapter title with fade",
  },
];

function textTrack(
  name: string,
  text: string,
  at: number,
  length: number,
  extras: Partial<Track> = {},
): Track {
  return {
    id: uuid(),
    name,
    type: "text",
    text,
    asset: TEXT_TRACK_ASSET,
    at,
    length,
    slip: 0,
    x: 0.5,
    y: 0.5,
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
    fontSize: 56,
    keys: {},
    ...extras,
  };
}

/** Build a small set of motion layers for a title-card recipe. */
export function buildMotionTitlePreset(
  id: MotionTitlePresetId,
  title = "Clip title",
): Track[] {
  switch (id) {
    case "lower-third": {
      const bar = createShapeTrack("rect", 0.2, 4);
      bar.name = "Plate";
      bar.x = 0.18;
      bar.y = 0.78;
      bar.size = 0.42;
      bar.color = "#0f766e";
      const name = textTrack("Name", title.slice(0, 40), 0.35, 3.8, {
        x: 0.22,
        y: 0.76,
        fontSize: 42,
      });
      return [
        applyAnimationPreset(bar, "slide-in-left", 0.4),
        applyAnimationPreset(name, "slide-in-left", 0.45),
      ];
    }
    case "centered-title": {
      const t = textTrack("Title", title.slice(0, 60), 0.1, 3.5, {
        y: 0.45,
        fontSize: 72,
      });
      return [applyAnimationPreset(t, "zoom-in", 0.55)];
    }
    case "impact-pop": {
      const t = textTrack("Impact", title.slice(0, 48).toUpperCase(), 0, 3, {
        fontSize: 80,
        y: 0.42,
      });
      let next = applyAnimationPreset(t, "pop-in", 0.5);
      next = applyAnimationPreset(next, "loop-pulse", 0.4);
      return [next];
    }
    case "subscribe-bar": {
      const bar = createShapeTrack("rect", 0.5, 4);
      bar.name = "CTA bar";
      bar.x = 0.5;
      bar.y = 0.9;
      bar.size = 0.7;
      bar.color = "#134e4a";
      const label = textTrack("CTA", "Subscribe for more", 0.65, 3.8, {
        y: 0.88,
        fontSize: 36,
      });
      const slideUp = (track: Track): Track => ({
        ...track,
        keys: {
          ...track.keys,
          y: [
            { time: 0, value: Math.min(1, track.y + 0.12), ease: "out" },
            { time: 0.45, value: track.y, ease: "hold" },
          ],
          opacity: [
            { time: 0, value: 0, ease: "out" },
            { time: 0.35, value: 1, ease: "hold" },
          ],
        },
      });
      return [slideUp(bar), slideUp(label)];
    }
    case "chapter-card": {
      const bg = createShapeTrack("rect", 0, 2.5);
      bg.name = "Chapter bg";
      bg.x = 0.5;
      bg.y = 0.5;
      bg.size = 1;
      bg.color = "#042f2e";
      bg.opacity = 0.85;
      const t = textTrack("Chapter", title.slice(0, 50), 0.15, 2.2, {
        fontSize: 64,
      });
      return [
        applyAnimationPreset(bg, "fade-in", 0.35),
        applyAnimationPreset(t, "fade-in", 0.45),
      ];
    }
    default:
      throw Error("Unknown motion title preset");
  }
}

export type MotionSample = {
  id: string;
  type: Track["type"];
  name: string;
  text?: string;
  color: string;
  x: number;
  y: number;
  size: number;
  opacity: number;
  rotation: number;
  shapeKind?: Track["shapeKind"];
};

/** Sample animated layer properties at local composition time (seconds). */
export function sampleMotionLayers(
  tracks: Track[],
  time: number,
): MotionSample[] {
  return tracks
    .filter((t) => t.visible && time >= t.at && time < t.at + t.length)
    .map((t) => {
      const local = time - t.at;
      return {
        id: t.id,
        type: t.type,
        name: t.name,
        text: t.text,
        color: t.color || "#ffffff",
        x: sampleCurve(t.keys.x, t.x, local),
        y: sampleCurve(t.keys.y, t.y, local),
        size: sampleCurve(t.keys.size, t.size, local),
        opacity: sampleCurve(t.keys.opacity, t.opacity, local),
        rotation: sampleCurve(
          t.keys.rotation,
          (t as Track & { rotation?: number }).rotation ?? 0,
          local,
        ),
        shapeKind: t.shapeKind,
      };
    });
}

export function applyPresetToTrack(
  track: Track,
  preset: AnimationPresetId,
  duration = 0.45,
) {
  return applyAnimationPreset(track, preset, duration);
}
