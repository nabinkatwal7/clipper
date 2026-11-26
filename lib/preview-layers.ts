import { sampleCurve, type Track } from "./composition";
import type { LayerMask, MaskGeometry } from "./layer-mask";
import type { BlendMode } from "./layer-blend";

export const canvasBlend: Record<BlendMode, GlobalCompositeOperation> = {
  normal: "source-over",
  multiply: "multiply",
  screen: "screen",
  overlay: "overlay",
  darken: "darken",
  lighten: "lighten",
  addition: "lighter",
  difference: "difference",
};

export function sampleMask(mask: LayerMask, time: number): MaskGeometry {
  const keys = mask.keys;
  if (!keys?.length) {
    const { x, y, width, height, feather } = mask;
    return { x, y, width, height, feather };
  }
  const property = (key: keyof MaskGeometry) =>
    sampleCurve(
      keys.map((frame) => ({
        time: frame.time,
        value: frame[key],
        ease: "linear",
      })),
      mask[key],
      time,
    );
  return {
    x: property("x"),
    y: property("y"),
    width: property("width"),
    height: property("height"),
    feather: property("feather"),
  };
}

export function layerPose(track: Track, local: number) {
  return {
    x: sampleCurve(track.keys.x, track.x, local),
    y: sampleCurve(track.keys.y, track.y, local),
    size: sampleCurve(track.keys.size, track.size, local),
    opacity: sampleCurve(track.keys.opacity, track.opacity, local),
    rotation: sampleCurve(track.keys.rotation, track.rotation ?? 0, local),
  };
}

/** Composition-local time for a source playhead inside the edited clip. */
export function compositionTime(sourceTime: number, clipStart: number) {
  return Math.max(0, sourceTime - clipStart);
}
