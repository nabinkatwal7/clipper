export type LayerMask = {
  shape: "ellipse" | "rectangle";
  x: number;
  y: number;
  width: number;
  height: number;
  feather: number;
  invert: boolean;
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

export function validateMask(mask: LayerMask) {
  const valid = (value: number, min: number, max: number) =>
    Number.isFinite(value) && value >= min && value <= max;
  if (
    !mask ||
    !["ellipse", "rectangle"].includes(mask.shape) ||
    !valid(mask.x, 0, 1) ||
    !valid(mask.y, 0, 1) ||
    !valid(mask.width, 0.05, 1) ||
    !valid(mask.height, 0.05, 1) ||
    !valid(mask.feather, 0, 0.5) ||
    typeof mask.invert !== "boolean"
  )
    throw Error("Invalid media layer mask.");
}

export function maskFilter(mask: LayerMask) {
  validateMask(mask);
  const x = `((X/W-${mask.x})/${mask.width / 2})`;
  const y = `((Y/H-${mask.y})/${mask.height / 2})`;
  const distance =
    mask.shape === "ellipse"
      ? `sqrt(${x}*${x}+${y}*${y})`
      : `max(abs(${x}),abs(${y}))`;
  const opacity = mask.feather
    ? `clip((1-${distance})/${mask.feather},0,1)`
    : `lte(${distance},1)`;
  const coverage = mask.invert ? `1-${opacity}` : opacity;
  return `format=gbrap,geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='alpha(X,Y)*(${coverage})':interpolation=nearest,format=rgba`;
}
