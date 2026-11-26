/** Simple block-match tracker — optical-flow style without OpenCV. */

export type MotionSample = { time: number; x: number; y: number };

function lumaAt(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  x: number,
  y: number,
) {
  const xi = Math.max(0, Math.min(w - 1, x | 0));
  const yi = Math.max(0, Math.min(h - 1, y | 0));
  const i = (yi * w + xi) * 4;
  return 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
}

function sad(
  a: Uint8ClampedArray,
  b: Uint8ClampedArray,
  w: number,
  h: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  block: number,
) {
  let sum = 0;
  const half = (block / 2) | 0;
  for (let dy = -half; dy <= half; dy++)
    for (let dx = -half; dx <= half; dx++)
      sum += Math.abs(
        lumaAt(a, w, h, ax + dx, ay + dy) - lumaAt(b, w, h, bx + dx, by + dy),
      );
  return sum;
}

type Frame = { width: number; height: number; data: Uint8ClampedArray };

/** Track a point across consecutive frames. Returns normalized 0–1 coords. */
export function trackPoint(
  frames: Frame[],
  times: number[],
  startX: number,
  startY: number,
  search = 12,
  block = 9,
): MotionSample[] {
  if (!frames.length) return [];
  const out: MotionSample[] = [];
  let x = startX * frames[0].width;
  let y = startY * frames[0].height;
  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];
    if (i > 0) {
      const prev = frames[i - 1];
      let best = Infinity,
        nx = x,
        ny = y;
      for (let dy = -search; dy <= search; dy++) {
        for (let dx = -search; dx <= search; dx++) {
          const cx = x + dx,
            cy = y + dy;
          if (cx < 0 || cy < 0 || cx >= frame.width || cy >= frame.height)
            continue;
          const score = sad(
            prev.data,
            frame.data,
            frame.width,
            frame.height,
            x,
            y,
            cx,
            cy,
            block,
          );
          if (score < best) {
            best = score;
            nx = cx;
            ny = cy;
          }
        }
      }
      x = nx;
      y = ny;
    }
    out.push({
      time: times[i] ?? i,
      x: Math.round((x / frame.width) * 1000) / 1000,
      y: Math.round((y / frame.height) * 1000) / 1000,
    });
  }
  return out;
}
