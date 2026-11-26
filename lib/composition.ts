import { validateMask, type LayerMask } from "./layer-mask";
import { blendModes, type BlendMode } from "./layer-blend";
import { layerTransformFilters, type LayerTransform } from "./layer-transform";
import { TEXT_TRACK_ASSET } from "./types";

import type { Keyframe } from "./keyframe-curve";

export { TEXT_TRACK_ASSET };
export {
  curve,
  sampleCurve,
  type Ease,
  type Keyframe,
} from "./keyframe-curve";
export type Track = LayerTransform & {
  id: string;
  name: string;
  group?: string;
  asset: string;
  type: "video" | "image" | "audio" | "text" | "shape" | "effect";
  text?: string;
  color?: string;
  fontSize?: number;
  shapeKind?: "rect" | "ellipse" | "line";
  effectStack?: import("./grading").StackedEffect[];
  nested?: Composition;
  at: number;
  length: number;
  slip: number;
  x: number;
  y: number;
  size: number;
  opacity: number;
  volume: number;
  visible: boolean;
  muted: boolean;
  locked: boolean;
  solo: boolean;
  loop: boolean;
  fade: number;
  keyColor?: { color: string; similarity: number; blend: number };
  mask?: LayerMask;
  blendMode?: BlendMode;
  keys: Partial<
    Record<"x" | "y" | "volume" | "rotation" | "opacity" | "size", Keyframe[]>
  >;
};
export type Composition = { version: 1; tracks: Track[] };
const within = (n: unknown, min: number, max: number) =>
  typeof n === "number" && Number.isFinite(n) && n >= min && n <= max;
export function validateComposition(v: Composition) {
  if (v.version !== 1 || !Array.isArray(v.tracks) || v.tracks.length > 16)
    throw Error("Unsupported composition or more than 16 tracks");
  const ids = new Set();
  for (const t of v.tracks) {
    if (
      !t ||
      typeof t.name !== "string" ||
      t.name.length > 100 ||
      typeof t.id !== "string" ||
      !/^[a-f0-9-]{36}$/.test(t.id) ||
      typeof t.asset !== "string" ||
      !/^[a-f0-9-]{36}$/.test(t.asset) ||
      ((t.type === "text" || t.type === "shape" || t.type === "effect") &&
        t.asset !== TEXT_TRACK_ASSET) ||
      (t.group !== undefined && !/^[a-f0-9-]{36}$/.test(t.group)) ||
      ids.has(t.id) ||
      !["audio", "image", "video", "text", "shape", "effect"].includes(t.type)
    )
      throw Error("Invalid timeline track");
    if (t.type === "text") {
      if (
        typeof t.text !== "string" ||
        !t.text.trim() ||
        t.text.length > 200 ||
        (t.color !== undefined && !/^#[0-9a-f]{6}$/i.test(t.color)) ||
        (t.fontSize !== undefined &&
          (!Number.isFinite(t.fontSize) || t.fontSize < 8 || t.fontSize > 200))
      )
        throw Error("Invalid text layer");
    }
    if (t.type === "shape") {
      if (
        !t.shapeKind ||
        !["rect", "ellipse", "line"].includes(t.shapeKind) ||
        (t.color !== undefined && !/^#[0-9a-f]{6}$/i.test(t.color))
      )
        throw Error("Invalid shape layer");
    }
    if (t.nested) {
      if (t.nested.version !== 1 || !Array.isArray(t.nested.tracks))
        throw Error("Invalid nested composition");
      if (t.nested.tracks.some((n) => n.nested))
        throw Error("Nested compositions are limited to one level.");
      validateComposition(t.nested);
    }
    ids.add(t.id);
    const transforms = layerTransformFilters(t);
    if (t.type === "audio" && transforms.length)
      throw Error("Visual transforms require an image or video layer.");
    if (
      (t.type === "text" || t.type === "shape" || t.type === "effect") &&
      (t.keyColor || t.mask)
    )
      throw Error("Chroma key and masks are not supported on that layer type.");
    if (
      t.blendMode !== undefined &&
      (t.type === "audio" ||
        typeof t.blendMode !== "string" ||
        !Object.hasOwn(blendModes, t.blendMode))
    )
      throw Error("Invalid media layer blend mode.");
    if (t.mask !== undefined) {
      if (t.type === "audio")
        throw Error("Masks require an image or video layer.");
      validateMask(t.mask, t.length);
    }
    if (
      t.keyColor !== undefined &&
      (!t.keyColor ||
        t.type === "audio" ||
        typeof t.keyColor.color !== "string" ||
        !/^#[0-9a-f]{6}$/i.test(t.keyColor.color) ||
        !within(t.keyColor.similarity, 0.01, 1) ||
        !within(t.keyColor.blend, 0, 1))
    )
      throw Error("Invalid layer chroma key.");
    for (const n of ["visible", "muted", "locked", "solo", "loop"] as const)
      if (typeof t[n] !== "boolean") throw Error("Invalid track switch");
    for (const [k, min, max] of [
      ["at", 0, 600],
      ["length", 0.04, 600],
      ["slip", 0, 43200],
      ["size", 0.05, 1],
      ["x", 0, 1],
      ["y", 0, 1],
      ["opacity", 0, 1],
      ["volume", 0, 2],
      ["fade", 0, 10],
    ] as const)
      if (!within(t[k], min, max)) throw Error("Invalid track " + k);
    if (!t.keys || typeof t.keys !== "object") throw Error("Invalid keyframes");
    for (const [k, keys] of Object.entries(t.keys)) {
      if (
        !["x", "y", "volume", "rotation", "opacity", "size"].includes(k) ||
        (t.type === "audio" &&
          ["rotation", "opacity", "size"].includes(k)) ||
        !Array.isArray(keys) ||
        keys.length > 48
      )
        throw Error("Unsupported animation");
      let previous = -1;
      for (const key of keys) {
        const min =
          k === "rotation" ? -180 : k === "size" ? 0.05 : 0;
        const max =
          k === "rotation" ? 180 : k === "volume" ? 2 : 1;
        if (
          !within(key.time, 0, t.length) ||
          key.time <= previous ||
          !within(key.value, min, max) ||
          ![
            "linear",
            "in",
            "out",
            "in-out",
            "hold",
            "bezier",
            "bezier-in",
            "bezier-out",
          ].includes(key.ease)
        )
          throw Error("Invalid animation point");
        for (const c of [key.cx1, key.cy1, key.cx2, key.cy2])
          if (
            c !== undefined &&
            (!Number.isFinite(c) || c < 0 || c > 1)
          )
            throw Error("Invalid Bézier control point");
        previous = key.time;
      }
    }
  }
  return v;
}
export function enabledTracks(c: Composition | undefined) {
  const tracks = c ? validateComposition(c).tracks : [];
  const solo = tracks.some((t) => t.solo);
  return tracks.filter(
    (t) => (!solo || t.solo) && ((t.visible && t.type !== "audio") || !t.muted),
  );
}
