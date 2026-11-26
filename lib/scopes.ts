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
