export const blendModes = {
  normal: "Normal",
  multiply: "Multiply",
  screen: "Screen",
  overlay: "Overlay",
  darken: "Darken",
  lighten: "Lighten",
  addition: "Add",
  difference: "Difference",
} as const;

export type BlendMode = keyof typeof blendModes;

export function layerBlendGraph(
  base: string,
  layer: string,
  output: string,
  placement: string,
  mode: BlendMode = "normal",
) {
  if (!Object.hasOwn(blendModes, mode))
    throw Error("Invalid layer blend mode.");
  if (mode === "normal")
    return [`[${base}][${layer}]overlay=${placement}[${output}]`];

  // The canvas places the layer at its animated coordinates and preserves its alpha.
  // Blend its RGB channels, then use the original alpha to mix the result into the base.
  const label = (suffix: string) => `[${output}_${suffix}]`;
  return [
    `[${base}]format=gbrp,split=3${label("original")}${label("base")}${label("canvas")}`,
    `${label("canvas")}format=rgba,colorchannelmixer=aa=0${label("clear")}`,
    `${label("clear")}[${layer}]overlay=${placement}:format=rgb${label("placed")}`,
    `${label("placed")}split=2${label("rgba")}${label("alpha")}`,
    `${label("rgba")}format=gbrp${label("color")}`,
    `${label("alpha")}alphaextract,format=gbrp${label("mask")}`,
    `${label("base")}${label("color")}blend=all_mode=${mode}:shortest=1${label("blended")}`,
    `${label("original")}${label("blended")}${label("mask")}maskedmerge=planes=7,format=yuv420p[${output}]`,
  ];
}
