import type { Settings } from "./types";

export const variantLabels = {
  portrait: "Portrait 9:16",
  square: "Square 1:1",
  landscape: "Landscape 16:9",
  clean: "Clean without captions",
  refreshed: "Use latest transcript captions",
} as const;
export type VariantFormat = keyof typeof variantLabels;
const ratios = { portrait: "9:16", square: "1:1", landscape: "16:9" } as const;

export function dynamicSettings(
  settings: Settings,
  format: VariantFormat,
): { label: string; value: Settings } {
  return {
    label: variantLabels[format],
    value:
      format === "refreshed"
        ? { ...settings, captions: true }
        : format === "clean"
          ? { ...settings, captions: false }
          : { ...settings, ratio: ratios[format] },
  };
}
