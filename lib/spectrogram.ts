/** Client-safe FFT spectrogram helpers (no Node imports). */

export type WindowFn = "hann" | "hamming" | "rectangular";

export type SpectrogramOptions = {
  fftSize?: number;
  hopSize?: number;
  window?: WindowFn;
  minDb?: number;
  maxDb?: number;
  logFrequency?: boolean;
};

function windowAt(kind: WindowFn, i: number, n: number) {
  if (kind === "rectangular") return 1;
  if (kind === "hamming") return 0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (n - 1));
  return 0.5 * (1 - Math.cos((2 * Math.PI * i) / (n - 1)));
}

/** In-place radix-2 Cooley–Tukey FFT (length must be power of 2). */
export function fft(re: Float64Array, im: Float64Array) {
  const n = re.length;
  if (n !== im.length || n < 2 || (n & (n - 1)) !== 0)
    throw Error("FFT size must be a power of two");
  let j = 0;
  for (let i = 1; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const tr = re[i];
      re[i] = re[j];
      re[j] = tr;
      const ti = im[i];
      im[i] = im[j];
      im[j] = ti;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wlenRe = Math.cos(ang),
      wlenIm = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let wr = 1,
        wi = 0;
      for (let k = 0; k < len / 2; k++) {
        const uRe = re[i + k],
          uIm = im[i + k];
        const vRe = re[i + k + len / 2] * wr - im[i + k + len / 2] * wi;
        const vIm = re[i + k + len / 2] * wi + im[i + k + len / 2] * wr;
        re[i + k] = uRe + vRe;
        im[i + k] = uIm + vIm;
        re[i + k + len / 2] = uRe - vRe;
        im[i + k + len / 2] = uIm - vIm;
        const nwr = wr * wlenRe - wi * wlenIm;
        wi = wr * wlenIm + wi * wlenRe;
        wr = nwr;
      }
    }
  }
}

/**
 * Build a magnitude spectrogram matrix:
 * rows = frequency bins (0..fftSize/2), cols = time frames.
 * Values are normalized 0–1 from minDb..maxDb.
 */
export function computeSpectrogram(
  samples: Float32Array | Float64Array,
  opts: SpectrogramOptions = {},
): { data: Float32Array; rows: number; cols: number; fftSize: number } {
  const fftSize = opts.fftSize || 1024;
  if ((fftSize & (fftSize - 1)) !== 0 || fftSize < 64 || fftSize > 8192)
    throw Error("fftSize must be a power of two between 64 and 8192");
  const hop = opts.hopSize || fftSize / 4;
  const win = opts.window || "hann";
  const minDb = opts.minDb ?? -80;
  const maxDb = opts.maxDb ?? 0;
  const rows = fftSize / 2;
  const cols = Math.max(1, Math.floor((samples.length - fftSize) / hop) + 1);
  const data = new Float32Array(rows * cols);
  const re = new Float64Array(fftSize);
  const im = new Float64Array(fftSize);
  const range = Math.max(1e-6, maxDb - minDb);

  for (let c = 0; c < cols; c++) {
    const offset = c * hop;
    re.fill(0);
    im.fill(0);
    for (let i = 0; i < fftSize; i++) {
      const s = samples[offset + i] || 0;
      re[i] = s * windowAt(win, i, fftSize);
    }
    fft(re, im);
    for (let r = 0; r < rows; r++) {
      const mag = Math.sqrt(re[r] * re[r] + im[r] * im[r]) / (fftSize / 2);
      const db = 20 * Math.log10(Math.max(1e-12, mag));
      let v = (db - minDb) / range;
      if (v < 0) v = 0;
      if (v > 1) v = 1;
      // low frequencies at bottom when drawing
      data[(rows - 1 - r) * cols + c] = v;
    }
  }
  return { data, rows, cols, fftSize };
}

/** Paint spectrogram into an ImageData buffer (RGBA). */
export function spectrogramToImageData(
  matrix: { data: Float32Array; rows: number; cols: number },
  image: ImageData,
) {
  const { data, rows, cols } = matrix;
  const w = image.width,
    h = image.height;
  for (let y = 0; y < h; y++) {
    const srcRow = Math.min(rows - 1, Math.floor((y / h) * rows));
    for (let x = 0; x < w; x++) {
      const srcCol = Math.min(cols - 1, Math.floor((x / w) * cols));
      const v = data[srcRow * cols + srcCol];
      const i = (y * w + x) * 4;
      // teal → bright scale (matches studio accent family)
      image.data[i] = Math.round(20 + v * 180);
      image.data[i + 1] = Math.round(40 + v * 200);
      image.data[i + 2] = Math.round(60 + v * 160);
      image.data[i + 3] = 255;
    }
  }
  return image;
}

/** Map a frequency in Hz to a row index (linear or log). */
export function frequencyToRow(
  hz: number,
  sampleRate: number,
  rows: number,
  logFrequency: boolean,
) {
  const nyquist = sampleRate / 2;
  const clamped = Math.max(1, Math.min(nyquist, hz));
  if (!logFrequency) return Math.floor((1 - clamped / nyquist) * (rows - 1));
  const min = Math.log10(20);
  const max = Math.log10(nyquist);
  const t = (Math.log10(clamped) - min) / (max - min);
  return Math.floor((1 - t) * (rows - 1));
}
