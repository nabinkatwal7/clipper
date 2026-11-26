export type Ease =
  | "linear"
  | "in"
  | "out"
  | "in-out"
  | "hold"
  | "bezier"
  | "bezier-in"
  | "bezier-out";

export type Keyframe = {
  time: number;
  value: number;
  ease: Ease;
  /** Custom cubic-bezier controls when ease is bezier* (0–1). */
  cx1?: number;
  cy1?: number;
  cx2?: number;
  cy2?: number;
};

export function bezierControls(key: Keyframe): [number, number, number, number] {
  if (
    [key.cx1, key.cy1, key.cx2, key.cy2].every(
      (n) => typeof n === "number" && Number.isFinite(n),
    )
  )
    return [
      Math.max(0, Math.min(1, key.cx1!)),
      Math.max(0, Math.min(1, key.cy1!)),
      Math.max(0, Math.min(1, key.cx2!)),
      Math.max(0, Math.min(1, key.cy2!)),
    ];
  if (key.ease === "bezier-in") return [0.42, 0, 1, 1];
  if (key.ease === "bezier-out") return [0, 0, 0.58, 1];
  if (key.ease === "bezier") return [0.42, 0, 0.58, 1];
  return [0, 0, 1, 1];
}

/** Cubic Bézier y for x in 0–1. */
export function cubicBezier(
  t: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
) {
  const cx = 3 * x1,
    bx = 3 * (x2 - x1) - cx,
    ax = 1 - cx - bx;
  const cy = 3 * y1,
    by = 3 * (y2 - y1) - cy,
    ay = 1 - cy - by;
  let u = t;
  for (let i = 0; i < 6; i++) {
    const x = ((ax * u + bx) * u + cx) * u - t;
    const d = (3 * ax * u + 2 * bx) * u + cx;
    if (Math.abs(d) < 1e-6) break;
    u -= x / d;
  }
  u = Math.max(0, Math.min(1, u));
  return ((ay * u + by) * u + cy) * u;
}

function easeProgress(key: Keyframe, t: number) {
  if (key.ease === "hold") return 0;
  if (key.ease === "in") return t * t;
  if (key.ease === "out") return 1 - (1 - t) * (1 - t);
  if (key.ease === "in-out") return t * t * (3 - 2 * t);
  if (
    key.ease === "bezier" ||
    key.ease === "bezier-in" ||
    key.ease === "bezier-out" ||
    key.cx1 !== undefined
  ) {
    const [x1, y1, x2, y2] = bezierControls(key);
    return cubicBezier(t, x1, y1, x2, y2);
  }
  return t;
}

/** Sample a keyframe curve at local time (same math as the FFmpeg expression builder). */
export function sampleCurve(
  keys: Keyframe[] | undefined,
  value: number,
  time: number,
) {
  if (!keys?.length) return value;
  if (time < keys[0].time) return keys[0].value;
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i],
      b = keys[i + 1];
    if (time < b.time) {
      const t = (time - a.time) / (b.time - a.time);
      return a.value + (b.value - a.value) * easeProgress(a, t);
    }
  }
  return keys.at(-1)!.value;
}

export function curve(
  keys: Keyframe[] | undefined,
  value: number,
  offset: number,
  clock = "t",
) {
  if (!keys?.length) return String(value);
  let expr = String(keys.at(-1)!.value);
  for (let i = keys.length - 2; i >= 0; i--) {
    const a = keys[i],
      b = keys[i + 1],
      t = `((${clock}-(${offset + a.time}))/${b.time - a.time})`;
    const [x1, y1, x2, y2] = bezierControls(a);
    // Approximate custom Bézier with a cubic polynomial for FFmpeg exprs.
    const eased =
      a.ease === "hold"
        ? "0"
        : a.ease === "in"
          ? `(${t}*${t})`
          : a.ease === "out"
            ? `(1-(1-${t})*(1-${t}))`
            : a.ease === "in-out"
              ? `(${t}*${t}*(3-2*${t}))`
              : a.ease.startsWith("bezier") || a.cx1 !== undefined
                ? `(${y1}*3*(1-${t})*(1-${t})*${t}+${y2}*3*(1-${t})*${t}*${t}+${t}*${t}*${t})`
                : t;
    void x1;
    void x2;
    expr = `if(lt(${clock},${offset + b.time}),${a.value}+(${b.value - a.value})*${eased},${expr})`;
  }
  return `if(lt(${clock},${keys[0].time + offset}),${keys[0].value},${expr})`;
}
