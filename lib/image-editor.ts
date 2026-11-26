/** Pure helpers for the lightweight raster image editor (Canvas-backed). */

export type ImageAdjustments = {
  brightness: number; // -1..1
  contrast: number; // -1..1
  saturation: number; // -1..1
  hue: number; // -180..180
  blur: number; // 0..20 px (preview hint)
  sharpen: number; // 0..1
};

export type ImageTransform = {
  rotation: 0 | 90 | 180 | 270;
  flipX: boolean;
  flipY: boolean;
  /** Normalized crop rect in source space */
  crop: { x: number; y: number; w: number; h: number };
};

export const defaultAdjustments: ImageAdjustments = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  hue: 0,
  blur: 0,
  sharpen: 0,
};

export const defaultTransform: ImageTransform = {
  rotation: 0,
  flipX: false,
  flipY: false,
  crop: { x: 0, y: 0, w: 1, h: 1 },
};

export function validateAdjustments(input: unknown): ImageAdjustments {
  const a = input as ImageAdjustments;
  const num = (v: unknown, min: number, max: number) =>
    typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
  if (
    !a ||
    !num(a.brightness, -1, 1) ||
    !num(a.contrast, -1, 1) ||
    !num(a.saturation, -1, 1) ||
    !num(a.hue, -180, 180) ||
    !num(a.blur, 0, 20) ||
    !num(a.sharpen, 0, 1)
  )
    throw Error("Invalid image adjustments");
  return { ...a };
}

export function validateTransform(input: unknown): ImageTransform {
  const t = input as ImageTransform;
  if (
    !t ||
    ![0, 90, 180, 270].includes(t.rotation) ||
    typeof t.flipX !== "boolean" ||
    typeof t.flipY !== "boolean" ||
    !t.crop ||
    !Number.isFinite(t.crop.x) ||
    !Number.isFinite(t.crop.y) ||
    !Number.isFinite(t.crop.w) ||
    !Number.isFinite(t.crop.h) ||
    t.crop.w <= 0 ||
    t.crop.h <= 0 ||
    t.crop.x < 0 ||
    t.crop.y < 0 ||
    t.crop.x + t.crop.w > 1.0001 ||
    t.crop.y + t.crop.h > 1.0001
  )
    throw Error("Invalid image transform");
  return {
    rotation: t.rotation,
    flipX: t.flipX,
    flipY: t.flipY,
    crop: { ...t.crop },
  };
}

/** CSS filter string for live preview (approximation). */
export function cssFilters(a: ImageAdjustments): string {
  const b = 1 + a.brightness;
  const c = 1 + a.contrast;
  const s = 1 + a.saturation;
  const parts = [
    `brightness(${b})`,
    `contrast(${c})`,
    `saturate(${s})`,
    `hue-rotate(${a.hue}deg)`,
  ];
  if (a.blur > 0) parts.push(`blur(${a.blur}px)`);
  return parts.join(" ");
}

export type PixelBuffer = {
  data: Uint8ClampedArray;
  width: number;
  height: number;
};

/**
 * Apply pixel adjustments (brightness/contrast/sat/hue).
 * Blur/sharpen stay preview-only via CSS — documented honestly.
 */
export function applyPixelAdjustments(
  data: PixelBuffer,
  a: ImageAdjustments,
): PixelBuffer {
  validateAdjustments(a);
  const out = {
    width: data.width,
    height: data.height,
    data: new Uint8ClampedArray(data.data),
  };
  const d = out.data;
  const bOff = a.brightness * 255;
  const cFactor = a.contrast >= 0 ? 1 + a.contrast : 1 / (1 - a.contrast);
  const sat = 1 + a.saturation;
  const hue = (a.hue * Math.PI) / 180;
  const cos = Math.cos(hue);
  const sin = Math.sin(hue);
  for (let i = 0; i < d.length; i += 4) {
    let r = data.data[i];
    let g = data.data[i + 1];
    let b = data.data[i + 2];
    r = (r - 128) * cFactor + 128 + bOff;
    g = (g - 128) * cFactor + 128 + bOff;
    b = (b - 128) * cFactor + 128 + bOff;
    const gray = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    r = gray + (r - gray) * sat;
    g = gray + (g - gray) * sat;
    b = gray + (b - gray) * sat;
    if (a.hue) {
      const nr =
        0.213 * r +
        0.715 * g +
        0.072 * b +
        cos * (0.787 * r - 0.715 * g - 0.072 * b) +
        sin * (-0.213 * r - 0.715 * g + 0.928 * b);
      const ng =
        0.213 * r +
        0.715 * g +
        0.072 * b +
        cos * (-0.213 * r + 0.285 * g - 0.072 * b) +
        sin * (0.143 * r + 0.14 * g - 0.283 * b);
      const nb =
        0.213 * r +
        0.715 * g +
        0.072 * b +
        cos * (-0.213 * r - 0.715 * g + 0.928 * b) +
        sin * (-0.787 * r + 0.715 * g + 0.072 * b);
      r = nr;
      g = ng;
      b = nb;
    }
    d[i] = Math.max(0, Math.min(255, r));
    d[i + 1] = Math.max(0, Math.min(255, g));
    d[i + 2] = Math.max(0, Math.min(255, b));
  }
  return out;
}
