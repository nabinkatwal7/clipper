import { curve } from "./composition";
export type CropPoint = { time: number; x: number; y: number };
export function validCrop(points: CropPoint[]) {
  if (!Array.isArray(points) || points.length > 64)
    throw Error("Use up to 64 crop positions.");
  let prior = -1;
  for (const p of points) {
    if (
      !p ||
      ![p.time, p.x, p.y].every(Number.isFinite) ||
      p.time <= prior ||
      p.time < 0 ||
      p.time > 43200 ||
      p.x < 0 ||
      p.x > 1 ||
      p.y < 0 ||
      p.y > 1
    )
      throw Error("Invalid crop keyframe.");
    prior = p.time;
  }
  return points;
}
export function cropAt(points: CropPoint[], time: number) {
  const end = points.findIndex((p) => p.time >= time);
  if (end === 0) return points[0];
  if (end < 0) return points.at(-1);
  const a = points[end - 1],
    b = points[end],
    v = (time - a.time) / (b.time - a.time);
  return { x: a.x + (b.x - a.x) * v, y: a.y + (b.y - a.y) * v };
}
export function cropExpression(
  points: CropPoint[],
  axis: "x" | "y",
  start: number,
) {
  return curve(
    points.map((p) => ({ time: p.time, value: p[axis], ease: "linear" })),
    0.5,
    -start,
  );
}
