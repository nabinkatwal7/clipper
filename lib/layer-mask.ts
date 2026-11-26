import { curve } from "./keyframe-curve";

export type MaskGeometry = {
  x: number;
  y: number;
  width: number;
  height: number;
  feather: number;
};
export type MaskKeyframe = MaskGeometry & { time: number };
export type LayerMask = MaskGeometry & {
  shape: "ellipse" | "rectangle" | "diamond" | "rounded";
  cornerRadius?: number;
  invert: boolean;
  keys?: MaskKeyframe[];
};

export const defaultMask: LayerMask = {
  shape: "ellipse",
  x: 0.5,
  y: 0.5,
  width: 0.75,
  height: 0.75,
  feather: 0.12,
  invert: false,
};

export function validateMask(mask: LayerMask, duration = Infinity) {
  const valid = (value: number, min: number, max: number) =>
    Number.isFinite(value) && value >= min && value <= max;
  if (
    !mask ||
    !["ellipse", "rectangle", "diamond", "rounded"].includes(mask.shape) ||
    (mask.cornerRadius !== undefined &&
      (!Number.isFinite(mask.cornerRadius) ||
        mask.cornerRadius < 0 ||
        mask.cornerRadius > 0.5)) ||
    !valid(mask.x, 0, 1) ||
    !valid(mask.y, 0, 1) ||
    !valid(mask.width, 0.05, 1) ||
    !valid(mask.height, 0.05, 1) ||
    !valid(mask.feather, 0, 0.5) ||
    typeof mask.invert !== "boolean"
  )
    throw Error("Invalid media layer mask.");
  if (mask.keys === undefined) return;
  if (!Array.isArray(mask.keys) || mask.keys.length > 24)
    throw Error("Use at most 24 mask keyframes.");
  let last = -1;
  for (const key of mask.keys) {
    if (
      !key ||
      !valid(key.time, 0, duration) ||
      key.time <= last ||
      !valid(key.x, 0, 1) ||
      !valid(key.y, 0, 1) ||
      !valid(key.width, 0.05, 1) ||
      !valid(key.height, 0.05, 1) ||
      !valid(key.feather, 0, 0.5)
    )
      throw Error("Invalid mask keyframe or keyframe outside the layer.");
    last = key.time;
  }
}

export function maskFilter(mask: LayerMask) {
  validateMask(mask);
  const property = (key: keyof MaskGeometry) =>
    curve(
      mask.keys?.map((frame) => ({
        time: frame.time,
        value: frame[key],
        ease: "linear",
      })),
      mask[key],
      0,
      "T",
    );
  const setup = `st(0,(X/W-(${property("x")}))*2/(${property("width")}));st(1,(Y/H-(${property("y")}))*2/(${property("height")}));st(2,${property("feather")});`;
  const distance =
    mask.shape === "ellipse"
      ? "sqrt(ld(0)*ld(0)+ld(1)*ld(1))"
      : mask.shape === "diamond"
        ? "abs(ld(0))+abs(ld(1))"
        : mask.shape === "rounded"
          ? // Superellipse approximates rounded rect for export.
            "pow(abs(ld(0)),3)+pow(abs(ld(1)),3)"
          : "max(abs(ld(0)),abs(ld(1)))";
  const opacity = `if(gt(ld(2),0),clip((1-ld(3))/ld(2),0,1),lte(ld(3),1))`;
  const coverage = mask.invert ? `1-${opacity}` : opacity;
  return layerAlphaFilter(`${setup}st(3,${distance});alpha(X,Y)*(${coverage})`);
}

export function layerAlphaFilter(expression: string) {
  return `format=gbrap,geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='${expression}':interpolation=nearest,format=rgba`;
}
