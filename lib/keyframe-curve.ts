export type Ease = "linear" | "in" | "out" | "in-out" | "hold";
export type Keyframe = { time: number; value: number; ease: Ease };

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
