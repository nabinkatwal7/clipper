export type Ease = "linear" | "in" | "out" | "in-out" | "hold";
export type Keyframe = { time: number; value: number; ease: Ease };

function easeProgress(ease: Ease, t: number) {
  if (ease === "hold") return 0;
  if (ease === "in") return t * t;
  if (ease === "out") return 1 - (1 - t) * (1 - t);
  if (ease === "in-out") return t * t * (3 - 2 * t);
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
      return a.value + (b.value - a.value) * easeProgress(a.ease, t);
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
    const eased =
      a.ease === "hold"
        ? "0"
        : a.ease === "in"
          ? `(${t}*${t})`
          : a.ease === "out"
            ? `(1-(1-${t})*(1-${t}))`
            : a.ease === "in-out"
              ? `(${t}*${t}*(3-2*${t}))`
              : t;
    expr = `if(lt(${clock},${offset + b.time}),${a.value}+(${b.value - a.value})*${eased},${expr})`;
  }
  return `if(lt(${clock},${keys[0].time + offset}),${keys[0].value},${expr})`;
}
