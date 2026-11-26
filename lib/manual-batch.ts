import { z } from "zod";
import type { Highlight } from "./types";

const selections = z
  .array(
    z.object({
      start: z.number().min(0),
      end: z.number(),
      title: z.string().trim().max(160).optional(),
    }),
  )
  .min(1)
  .max(20);

export function manualBatch(input: unknown, duration: number): Highlight[] {
  const result = selections.safeParse(input);
  if (!result.success) throw Error("Choose 1–20 valid clip ranges.");
  const seen = new Set<string>();
  return result.data.map(({ start, end, title }, i) => {
    if (end > duration || end - start < 0.25 || end - start > 600)
      throw Error(
        "Each range must be inside the recording and last 0.25–600 seconds.",
      );
    const key = JSON.stringify([start, end]);
    if (seen.has(key)) throw Error("Remove duplicate ranges before rendering.");
    seen.add(key);
    return {
      start,
      end,
      title: title || `Manual clip ${i + 1}`,
      score: null,
      reason: "Selected manually",
    };
  });
}
