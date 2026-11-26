import { curve, type Keyframe } from "./keyframe-curve";

export type LayerTransform = {
  rotation?: number;
  flipX?: boolean;
  flipY?: boolean;
};

export function layerTransformFilters(
  { rotation, flipX, flipY }: LayerTransform,
  rotationKeys?: Keyframe[],
) {
  if (
    (rotation !== undefined &&
      (!Number.isFinite(rotation) || Math.abs(rotation) > 180)) ||
    [flipX, flipY].some(
      (value) => value !== undefined && typeof value !== "boolean",
    )
  )
    throw Error("Invalid media layer transform.");

  const filters: string[] = [];
  if (flipX) filters.push("hflip");
  if (flipY) filters.push("vflip");
  if (rotationKeys?.length) {
    const angle = `(${curve(rotationKeys, rotation ?? 0, 0)})*PI/180`;
    const bounds = "ceil(sqrt(iw*iw+ih*ih)/2)*2";
    filters.push(`rotate='${angle}':ow=${bounds}:oh=${bounds}:c=black@0`);
  } else if (rotation) {
    const angle = `${rotation}*PI/180`;
    filters.push(
      `rotate=${angle}:ow=ceil((rotw(${angle})-0.000001)/2)*2:oh=ceil((roth(${angle})-0.000001)/2)*2:c=black@0`,
    );
  }
  return filters;
}
