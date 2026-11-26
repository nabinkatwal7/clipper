export const effects = [
  "none",
  "blur",
  "sharpen",
  "vignette",
  "grain",
  "monochrome",
  "sepia",
  "pixelate",
  "mirror",
  "glow",
  "letterbox",
  "edge",
  "rgbshift",
  "posterize",
  "invert",
] as const;
export type Grade = {
  lut?: string;
  lutName?: string;
  lutIntensity?: number;
  brightness: number;
  contrast: number;
  gamma: number;
  saturation: number;
  hue: number;
  exposure: number;
  temperature: number;
  red: number;
  green: number;
  blue: number;
  shadows: number;
  highlights: number;
  effect: (typeof effects)[number];
  amount: number;
  from?: number;
  to?: number;
};
export const neutral: Grade = {
  brightness: 0,
  contrast: 1,
  gamma: 1,
  saturation: 1,
  hue: 0,
  exposure: 0,
  temperature: 0,
  red: 1,
  green: 1,
  blue: 1,
  shadows: 0,
  highlights: 0,
  effect: "none",
  amount: 0.5,
};
export const looks: Record<string, Partial<Grade>> = {
  Natural: {},
  Cinematic: { contrast: 1.12, saturation: 0.85, temperature: -0.09 },
  Vibrant: { saturation: 1.35, contrast: 1.08 },
  Warm: { temperature: 0.2 },
  Cool: { temperature: -0.2 },
  Vintage: { effect: "sepia", amount: 0.5, contrast: 0.92 },
  Monochrome: { saturation: 0 },
};
export const gradeRanges = {
  brightness: [-0.5, 0.5],
  contrast: [0.25, 2],
  gamma: [0.3, 3],
  saturation: [0, 3],
  hue: [-180, 180],
  exposure: [-2, 2],
  temperature: [-1, 1],
  red: [0, 2],
  green: [0, 2],
  blue: [0, 2],
  shadows: [-1, 1],
  highlights: [-1, 1],
  amount: [0, 1],
} as const;
export function gradeValue(input: Partial<Grade>): Grade {
  const v = { ...neutral, ...input };
  if (
    v.lut !== undefined &&
    (typeof v.lut !== "string" ||
      !/^([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/.test(
        v.lut,
      ))
  )
    throw Error("Invalid LUT asset");
  if (
    v.lutIntensity !== undefined &&
    (!Number.isFinite(v.lutIntensity) ||
      v.lutIntensity < 0 ||
      v.lutIntensity > 1)
  )
    throw Error("Invalid LUT intensity");
  if (!effects.includes(v.effect)) throw Error("Unsupported effect");
  for (const [k, [lo, hi]] of Object.entries(gradeRanges)) {
    const n = v[k as keyof typeof gradeRanges];
    if (!Number.isFinite(n) || n < lo || n > hi)
      throw Error("Invalid grade " + k);
  }
  for (const t of [v.from, v.to])
    if (t !== undefined && (!Number.isFinite(t) || t < 0 || t > 600))
      throw Error("Invalid effect range");
  if (v.to !== undefined && v.to <= (v.from ?? 0))
    throw Error("Effect end must follow its start");
  return v;
}
export type StackedEffect = {
  id: string;
  effect: Exclude<(typeof effects)[number], "none">;
  amount: number;
  enabled: boolean;
  from?: number;
  to?: number;
};

export function validateEffectStack(stack: StackedEffect[] | undefined) {
  if (stack === undefined) return undefined;
  if (!Array.isArray(stack) || stack.length > 8)
    throw Error("Use at most 8 stacked effects.");
  const ids = new Set<string>();
  return stack.map((item) => {
    if (
      !item ||
      typeof item.id !== "string" ||
      !/^[a-f0-9-]{36}$/.test(item.id) ||
      ids.has(item.id) ||
      item.effect === ("none" as never) ||
      !effects.includes(item.effect) ||
      typeof item.enabled !== "boolean" ||
      !Number.isFinite(item.amount) ||
      item.amount < 0 ||
      item.amount > 1
    )
      throw Error("Invalid stacked effect.");
    ids.add(item.id);
    for (const t of [item.from, item.to])
      if (t !== undefined && (!Number.isFinite(t) || t < 0 || t > 600))
        throw Error("Invalid stacked effect range.");
    if (item.to !== undefined && item.to <= (item.from ?? 0))
      throw Error("Stacked effect end must follow its start.");
    return item;
  });
}

function effectFilter(
  effect: Grade["effect"],
  amount: number,
  h: number,
  from?: number,
  to?: number,
) {
  if (effect === "none") return [] as string[];
  const a = amount;
  const when =
    from !== undefined || to !== undefined
      ? `:enable='between(t,${from ?? 0},${to ?? 600})'`
      : "";
  const fx: Record<Exclude<Grade["effect"], "none">, string> = {
    blur: "gblur=sigma=" + (1 + 12 * a),
    sharpen: "unsharp=luma_amount=" + 2 * a,
    vignette: "vignette=angle=" + (0.2 + 0.6 * a),
    grain: "noise=alls=" + Math.round(40 * a) + ":allf=t",
    monochrome: "hue=s=0",
    sepia: `colorchannelmixer=rr=${1 - 0.607 * a}:rg=${0.769 * a}:rb=${0.189 * a}:gr=${0.349 * a}:gg=${1 - 0.314 * a}:gb=${0.168 * a}:br=${0.272 * a}:bg=${0.534 * a}:bb=${1 - 0.869 * a}`,
    pixelate:
      "pixelize=w=" + Math.round(2 + 30 * a) + ":h=" + Math.round(2 + 30 * a),
    mirror: "hflip",
    glow: "unsharp=luma_msize_x=7:luma_msize_y=7:luma_amount=" + -1.5 * a,
    letterbox:
      "drawbox=x=0:y=0:w=iw:h=" +
      Math.round(h * 0.12 * a) +
      ":color=black:t=fill",
    edge: "edgedetect=low=" + (0.05 + 0.2 * a) + ":high=" + (0.15 + 0.4 * a),
    rgbshift:
      "rgbashift=rh=" +
      Math.round(2 + 10 * a) +
      ":bv=" +
      Math.round(2 + 10 * a),
    posterize: "eq=gamma=" + (1 + a) + ":contrast=" + (1 + 0.4 * a),
    invert: "negate",
  };
  const filters = [
    fx[effect] +
      (when && effect === "mirror"
        ? when.slice(1).replace("enable=", "=enable=")
        : when),
  ];
  if (effect === "letterbox")
    filters.push(
      `drawbox=x=0:y=ih-${Math.round(h * 0.12 * a)}:w=iw:h=${Math.round(h * 0.12 * a)}:color=black:t=fill` +
        when,
    );
  return filters;
}

export function gradeFilters(
  input: Partial<Grade>,
  _w: number,
  h: number,
  stack?: StackedEffect[],
) {
  const g = gradeValue(input);
  const filters: string[] = [];
  if (g.brightness || g.contrast !== 1 || g.gamma !== 1 || g.saturation !== 1)
    filters.push(
      `eq=brightness=${g.brightness}:contrast=${g.contrast}:gamma=${g.gamma}:saturation=${g.saturation}`,
    );
  if (g.exposure) filters.push("exposure=exposure=" + g.exposure);
  if (g.hue) filters.push("hue=h=" + g.hue);
  if (g.temperature || g.shadows || g.highlights)
    filters.push(
      `colorbalance=rs=${g.shadows}:gs=${g.shadows}:bs=${g.shadows}:rh=${g.highlights}:gh=${g.highlights}:bh=${g.highlights}:rm=${g.temperature * 0.35}:bm=${-g.temperature * 0.35}`,
    );
  if (g.red !== 1 || g.green !== 1 || g.blue !== 1)
    filters.push(`colorchannelmixer=rr=${g.red}:gg=${g.green}:bb=${g.blue}`);
  const layered = validateEffectStack(stack) || [];
  if (layered.length) {
    for (const item of layered)
      if (item.enabled)
        filters.push(
          ...effectFilter(item.effect, item.amount, h, item.from, item.to),
        );
  } else {
    filters.push(...effectFilter(g.effect, g.amount, h, g.from, g.to));
  }
  return filters;
}
export type Mix = {
  duck: boolean;
  normalize: boolean;
  noise: boolean;
  compress: boolean;
  limit: boolean;
  highpass: number;
  lowpass: number;
  bass: number;
  treble: number;
  balance: number;
  fadeIn: number;
  fadeOut: number;
};
export const dry: Mix = {
  duck: false,
  normalize: false,
  noise: false,
  compress: false,
  limit: false,
  highpass: 0,
  lowpass: 0,
  bass: 0,
  treble: 0,
  balance: 0,
  fadeIn: 0,
  fadeOut: 0,
};
export function mixFilters(input: Partial<Mix>, duration: number) {
  const m = { ...dry, ...input };
  for (const k of ["duck", "normalize", "noise", "compress", "limit"] as const)
    if (typeof m[k] !== "boolean") throw Error("Invalid audio switch");
  for (const [k, lo, hi] of [
    ["highpass", 0, 16000],
    ["lowpass", 0, 20000],
    ["bass", -18, 18],
    ["treble", -18, 18],
    ["balance", -1, 1],
    ["fadeIn", 0, 60],
    ["fadeOut", 0, 60],
  ] as const)
    if (!Number.isFinite(m[k]) || m[k] < lo || m[k] > hi)
      throw Error("Invalid " + k);
  return [
    m.highpass && "highpass=f=" + m.highpass,
    m.lowpass && "lowpass=f=" + m.lowpass,
    m.noise && "afftdn",
    m.bass && "bass=g=" + m.bass,
    m.treble && "treble=g=" + m.treble,
    m.balance && "stereotools=balance_out=" + m.balance,
    m.compress && "acompressor",
    m.normalize && "loudnorm=I=-16:TP=-1.5:LRA=11",
    m.fadeIn && "afade=t=in:d=" + Math.min(duration, m.fadeIn),
    m.fadeOut &&
      `afade=t=out:st=${Math.max(0, duration - m.fadeOut)}:d=${Math.min(duration, m.fadeOut)}`,
    m.limit && "alimiter=limit=0.95",
  ].filter(Boolean) as string[];
}

export type AdjustmentLayer = {
  id: string;
  name: string;
  at: number;
  length: number;
  enabled: boolean;
  effects: StackedEffect[];
};

export function validateAdjustmentLayers(layers: AdjustmentLayer[] | undefined) {
  if (layers === undefined) return undefined;
  if (!Array.isArray(layers) || layers.length > 8)
    throw Error("Use at most 8 adjustment layers.");
  const ids = new Set<string>();
  return layers.map((layer) => {
    if (
      !layer ||
      typeof layer.id !== "string" ||
      !/^[a-f0-9-]{36}$/.test(layer.id) ||
      ids.has(layer.id) ||
      typeof layer.name !== "string" ||
      layer.name.length > 80 ||
      typeof layer.enabled !== "boolean" ||
      !Number.isFinite(layer.at) ||
      layer.at < 0 ||
      layer.at > 600 ||
      !Number.isFinite(layer.length) ||
      layer.length < 0.04 ||
      layer.length > 600
    )
      throw Error("Invalid adjustment layer.");
    ids.add(layer.id);
    return {
      ...layer,
      effects: validateEffectStack(layer.effects) || [],
    };
  });
}

export function adjustmentFilters(layers: AdjustmentLayer[] | undefined, h: number) {
  const filters: string[] = [];
  for (const layer of validateAdjustmentLayers(layers) || []) {
    if (!layer.enabled) continue;
    for (const item of layer.effects) {
      if (!item.enabled) continue;
      filters.push(
        ...effectFilter(
          item.effect,
          item.amount,
          h,
          layer.at + (item.from ?? 0),
          layer.at + (item.to ?? layer.length),
        ),
      );
    }
  }
  return filters;
}
