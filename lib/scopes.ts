export type ScopeData = {
  rgb: [number, number, number][];
  luma: number[];
};

/** Sample a canvas/image into 64-bin RGB and luma histograms. */
export function sampleScopes(
  source: CanvasImageSource,
  width: number,
  height: number,
): ScopeData {
  const canvas = document.createElement("canvas");
  const w = Math.max(1, Math.min(160, Math.floor(width)));
  const h = Math.max(1, Math.min(160, Math.floor(height)));
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return { rgb: Array.from({ length: 64 }, () => [0, 0, 0]), luma: Array(64).fill(0) };
  ctx.drawImage(source, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h).data;
  const rgb = Array.from({ length: 64 }, () => [0, 0, 0] as [number, number, number]);
  const luma = Array(64).fill(0) as number[];
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i],
      g = data[i + 1],
      b = data[i + 2];
    rgb[Math.min(63, r >> 2)][0]++;
    rgb[Math.min(63, g >> 2)][1]++;
    rgb[Math.min(63, b >> 2)][2]++;
    const y = Math.min(63, ((0.2126 * r + 0.7152 * g + 0.0722 * b) | 0) >> 2);
    luma[y]++;
  }
  return { rgb, luma };
}

/** Row-wise luma waveform (column = time sample, height = level). */
export function sampleWaveform(
  source: CanvasImageSource,
  width: number,
  height: number,
  columns = 128,
): number[] {
  const canvas = document.createElement("canvas");
  const w = Math.max(1, Math.min(160, Math.floor(width)));
  const h = Math.max(1, Math.min(160, Math.floor(height)));
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return Array(columns).fill(0);
  ctx.drawImage(source, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h).data;
  const out: number[] = [];
  const step = w / columns;
  for (let col = 0; col < columns; col++) {
    const x = Math.min(w - 1, Math.floor(col * step));
    let peak = 0;
    for (let y = 0; y < h; y++) {
      const i = (y * w + x) * 4;
      const l = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
      if (l > peak) peak = l;
    }
    out.push(peak / 255);
  }
  return out;
}

/** Vectorscope: Cb/Cr-like points from RGB (U/V normalized −0.5…0.5). */
export function sampleVectorscope(
  source: CanvasImageSource,
  width: number,
  height: number,
  maxPoints = 1200,
): { u: number; v: number; r: number; g: number; b: number }[] {
  const canvas = document.createElement("canvas");
  const w = Math.max(1, Math.min(96, Math.floor(width)));
  const h = Math.max(1, Math.min(96, Math.floor(height)));
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return [];
  ctx.drawImage(source, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h).data;
  const step = Math.max(1, Math.floor((w * h) / maxPoints));
  const out: { u: number; v: number; r: number; g: number; b: number }[] = [];
  for (let p = 0; p < w * h; p += step) {
    const i = p * 4;
    const r = data[i] / 255,
      g = data[i + 1] / 255,
      b = data[i + 2] / 255;
    const u = -0.14713 * r - 0.28886 * g + 0.436 * b;
    const v = 0.615 * r - 0.51499 * g - 0.10001 * b;
    out.push({ u, v, r, g, b });
  }
  return out;
}

/** RGB parade: per-column average R, G, B in 0–1. */
export function sampleParade(
  source: CanvasImageSource,
  width: number,
  height: number,
  columns = 128,
): [number, number, number][] {
  const canvas = document.createElement("canvas");
  const w = Math.max(1, Math.min(160, Math.floor(width)));
  const h = Math.max(1, Math.min(160, Math.floor(height)));
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return Array.from({ length: columns }, () => [0, 0, 0]);
  ctx.drawImage(source, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h).data;
  const out: [number, number, number][] = [];
  const step = w / columns;
  for (let col = 0; col < columns; col++) {
    const x = Math.min(w - 1, Math.floor(col * step));
    let r = 0,
      g = 0,
      b = 0;
    for (let y = 0; y < h; y++) {
      const i = (y * w + x) * 4;
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
    }
    const n = h || 1;
    out.push([r / n / 255, g / n / 255, b / n / 255]);
  }
  return out;
}
