/** Pure helpers for the lightweight raster image editor (Canvas-backed). */

export type ImageAdjustments = {
  brightness: number; // -1..1
  contrast: number; // -1..1
  saturation: number; // -1..1
  hue: number; // -180..180
  blur: number; // 0..20 px (preview hint)
  sharpen: number; // 0..1
};

export type ImageLevels = {
  black: number; // 0..255
  mid: number; // 0.1..9.9 gamma
  white: number; // 0..255
};

export type ImageTransform = {
  rotation: 0 | 90 | 180 | 270;
  flipX: boolean;
  flipY: boolean;
  /** Normalized crop rect in source space */
  crop: { x: number; y: number; w: number; h: number };
};

/** Normalized selection in image space (after transform). */
export type ImageSelection = {
  x: number;
  y: number;
  w: number;
  h: number;
} | null;

export type EditorTool = "select" | "brush" | "eraser";

export const defaultAdjustments: ImageAdjustments = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  hue: 0,
  blur: 0,
  sharpen: 0,
};

export const defaultLevels: ImageLevels = {
  black: 0,
  mid: 1,
  white: 255,
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

export function validateLevels(input: unknown): ImageLevels {
  const l = input as ImageLevels;
  if (
    !l ||
    !Number.isFinite(l.black) ||
    !Number.isFinite(l.mid) ||
    !Number.isFinite(l.white) ||
    l.black < 0 ||
    l.black > 254 ||
    l.white < 1 ||
    l.white > 255 ||
    l.black >= l.white ||
    l.mid < 0.1 ||
    l.mid > 9.9
  )
    throw Error("Invalid image levels");
  return { black: l.black, mid: l.mid, white: l.white };
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

export function validateSelection(input: unknown): ImageSelection {
  if (input === null) return null;
  const s = input as NonNullable<ImageSelection>;
  if (
    !s ||
    !Number.isFinite(s.x) ||
    !Number.isFinite(s.y) ||
    !Number.isFinite(s.w) ||
    !Number.isFinite(s.h) ||
    s.w <= 0 ||
    s.h <= 0 ||
    s.x < 0 ||
    s.y < 0 ||
    s.x + s.w > 1.0001 ||
    s.y + s.h > 1.0001
  )
    throw Error("Invalid image selection");
  return { x: s.x, y: s.y, w: s.w, h: s.h };
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

export type HistoryStack<T> = {
  past: T[];
  present: T;
  future: T[];
};

export function historyPush<T>(
  stack: HistoryStack<T>,
  next: T,
  max = 24,
): HistoryStack<T> {
  return {
    past: [...stack.past, stack.present].slice(-max),
    present: next,
    future: [],
  };
}

export function historyUndo<T>(stack: HistoryStack<T>): HistoryStack<T> {
  if (!stack.past.length) return stack;
  const past = [...stack.past];
  const present = past.pop()!;
  return {
    past,
    present,
    future: [stack.present, ...stack.future].slice(0, 24),
  };
}

export function historyRedo<T>(stack: HistoryStack<T>): HistoryStack<T> {
  if (!stack.future.length) return stack;
  const [present, ...future] = stack.future;
  return {
    past: [...stack.past, stack.present].slice(-24),
    present,
    future,
  };
}

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

/** Photoshop-style levels: remap black/white points + midtone gamma. */
export function applyLevels(data: PixelBuffer, levels: ImageLevels): PixelBuffer {
  const L = validateLevels(levels);
  if (L.black === 0 && L.white === 255 && L.mid === 1) {
    return {
      width: data.width,
      height: data.height,
      data: new Uint8ClampedArray(data.data),
    };
  }
  const out = {
    width: data.width,
    height: data.height,
    data: new Uint8ClampedArray(data.data),
  };
  const range = L.white - L.black || 1;
  const gamma = 1 / L.mid;
  const d = out.data;
  for (let i = 0; i < d.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      let v = (data.data[i + c] - L.black) / range;
      v = Math.max(0, Math.min(1, v));
      v = Math.pow(v, gamma);
      d[i + c] = Math.round(v * 255);
    }
  }
  return out;
}

function inSelection(
  px: number,
  py: number,
  w: number,
  h: number,
  sel: ImageSelection,
): boolean {
  if (!sel) return true;
  const x0 = Math.floor(sel.x * w);
  const y0 = Math.floor(sel.y * h);
  const x1 = Math.ceil((sel.x + sel.w) * w);
  const y1 = Math.ceil((sel.y + sel.h) * h);
  return px >= x0 && px < x1 && py >= y0 && py < y1;
}

/** Soft circular brush stamp (paint or erase alpha). */
export function stampBrush(
  data: PixelBuffer,
  opts: {
    nx: number;
    ny: number;
    radius: number; // normalized 0.002..0.2 of min(w,h)
    color: [number, number, number];
    opacity: number; // 0..1
    erase?: boolean;
    selection?: ImageSelection;
  },
): PixelBuffer {
  if (
    !Number.isFinite(opts.nx) ||
    !Number.isFinite(opts.ny) ||
    opts.nx < 0 ||
    opts.nx > 1 ||
    opts.ny < 0 ||
    opts.ny > 1 ||
    opts.radius < 0.002 ||
    opts.radius > 0.2 ||
    opts.opacity < 0 ||
    opts.opacity > 1
  )
    throw Error("Invalid brush stamp");
  const out = {
    width: data.width,
    height: data.height,
    data: new Uint8ClampedArray(data.data),
  };
  const minDim = Math.min(data.width, data.height);
  const r = Math.max(1, Math.round(opts.radius * minDim));
  const cx = Math.round(opts.nx * data.width);
  const cy = Math.round(opts.ny * data.height);
  const [cr, cg, cb] = opts.color;
  const d = out.data;
  for (let y = cy - r; y <= cy + r; y++) {
    if (y < 0 || y >= data.height) continue;
    for (let x = cx - r; x <= cx + r; x++) {
      if (x < 0 || x >= data.width) continue;
      if (!inSelection(x, y, data.width, data.height, opts.selection ?? null))
        continue;
      const dist = Math.hypot(x - cx, y - cy);
      if (dist > r) continue;
      const falloff = (1 - dist / r) * opts.opacity;
      const i = (y * data.width + x) * 4;
      if (opts.erase) {
        d[i + 3] = Math.max(0, Math.round(d[i + 3] * (1 - falloff)));
      } else {
        d[i] = Math.round(d[i] * (1 - falloff) + cr * falloff);
        d[i + 1] = Math.round(d[i + 1] * (1 - falloff) + cg * falloff);
        d[i + 2] = Math.round(d[i + 2] * (1 - falloff) + cb * falloff);
      }
    }
  }
  return out;
}

/** Restrict adjustments to selection by blending. */
export function applyInSelection(
  base: PixelBuffer,
  edited: PixelBuffer,
  sel: ImageSelection,
): PixelBuffer {
  if (!sel) return edited;
  validateSelection(sel);
  const out = {
    width: base.width,
    height: base.height,
    data: new Uint8ClampedArray(base.data),
  };
  const x0 = Math.floor(sel.x * base.width);
  const y0 = Math.floor(sel.y * base.height);
  const x1 = Math.ceil((sel.x + sel.w) * base.width);
  const y1 = Math.ceil((sel.y + sel.h) * base.height);
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * base.width + x) * 4;
      out.data[i] = edited.data[i];
      out.data[i + 1] = edited.data[i + 1];
      out.data[i + 2] = edited.data[i + 2];
      out.data[i + 3] = edited.data[i + 3];
    }
  }
  return out;
}
