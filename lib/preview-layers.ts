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

/** Approximate FFmpeg colorkey on a canvas layer (similarity 0–1, blend 0–1). */
export function applyChromaKey(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  key: { color: string; similarity: number; blend: number },
) {
  const hex = key.color.replace("#", "");
  if (hex.length !== 6) return;
  const kr = parseInt(hex.slice(0, 2), 16),
    kg = parseInt(hex.slice(2, 4), 16),
    kb = parseInt(hex.slice(4, 6), 16);
  const threshold = key.similarity * 441.67;
  const soft = Math.max(1, key.blend * 441.67);
  const image = ctx.getImageData(0, 0, width, height);
  const data = image.data;
  for (let i = 0; i < data.length; i += 4) {
    const d = Math.hypot(data[i] - kr, data[i + 1] - kg, data[i + 2] - kb);
    if (d <= threshold) data[i + 3] = 0;
    else if (d < threshold + soft)
      data[i + 3] = Math.round(data[i + 3] * ((d - threshold) / soft));
  }
  ctx.putImageData(image, 0, 0);
}
