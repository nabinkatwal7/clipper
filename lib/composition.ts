import { validateMask, type LayerMask } from "./layer-mask";
import { blendModes, type BlendMode } from "./layer-blend";

import type { Keyframe } from "./keyframe-curve";
export { curve, type Ease, type Keyframe } from "./keyframe-curve";
export type Track = {
  id: string;
  name: string;
  group?: string;
  asset: string;
  type: "video" | "image" | "audio";
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
  keys: Partial<Record<"x" | "y" | "volume", Keyframe[]>>;
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
      ![t.id, t.asset].every(
        (v) => typeof v === "string" && /^[a-f0-9-]{36}$/.test(v),
      ) ||
      (t.group !== undefined && !/^[a-f0-9-]{36}$/.test(t.group)) ||
      ids.has(t.id) ||
      !["audio", "image", "video"].includes(t.type)
    )
      throw Error("Invalid timeline track");
    ids.add(t.id);
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
        !["x", "y", "volume"].includes(k) ||
        !Array.isArray(keys) ||
        keys.length > 48
      )
        throw Error("Unsupported animation");
      let previous = -1;
      for (const key of keys) {
        if (
          !within(key.time, 0, t.length) ||
          key.time <= previous ||
          !within(key.value, 0, k === "volume" ? 2 : 1) ||
          !["linear", "in", "out", "in-out", "hold"].includes(key.ease)
        )
          throw Error("Invalid animation point");
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
