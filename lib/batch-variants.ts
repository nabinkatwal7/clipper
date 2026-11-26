import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import { z } from "zod";
import { busy, enqueue, render } from "./jobs";
import { beginProgress, completeProgress, reporter } from "./progress";
import { file, list, save, transcript } from "./store";
import {
  dynamicSettings,
  variantLabels,
  type VariantFormat,
} from "./variant-formats";
import type { Clip } from "./types";

const request = z.object({
  clips: z.array(z.uuid()).min(1).max(20),
  formats: z
    .array(z.enum(Object.keys(variantLabels) as VariantFormat[]))
    .min(1)
    .max(5),
});

export async function queueVariants(input: unknown) {
  const { clips, formats } = request.parse(input);
  const ids = new Set(clips),
    presets = [...new Set(formats)];
  if (ids.size * presets.length > 40)
    throw Error("Queue up to 40 variations at a time.");
  const groups = (await list())
    .map((p) => ({ p, selected: p.clips.filter((c) => ids.has(c.id)) }))
    .filter((group) => group.selected.length);
  if (groups.reduce((count, g) => count + g.selected.length, 0) !== ids.size)
    throw Error("One or more selected clips are unavailable.");
  const refreshed = new Map<string, Clip["segments"]>();
  if (presets.includes("refreshed")) {
    for (const { p, selected } of groups) {
      const rows = await transcript(p.id).catch(
        (error: NodeJS.ErrnoException) => {
          if (error.code === "ENOENT") return [];
          throw error;
        },
      );
      for (const clip of selected) {
        const matching = rows.filter(
          (row) =>
            row.end > clip.start && row.start < clip.end && row.text.trim(),
        );
        if (!matching.length)
          throw Error("No saved transcript overlaps “" + clip.title + "”.");
        refreshed.set(clip.id, matching);
      }
    }
  }
  if (groups.some(({ p }) => busy(p.id)))
    throw Error("Wait for the selected projects to finish their current jobs.");
  const count = ids.size * presets.length;
  for (const { p, selected } of groups) {
    enqueue(p.id, async (signal) => {
      const total = selected.length * presets.length;
      p.status = "processing";
      p.stage = "rendering";
      p.detail = "Rendering batch variations";
      beginProgress(p, "rendering", p.detail, total, "clips");
      await save(p);
      const progress = reporter(p, "rendering");
      const results: Clip[] = [];
      let committed = false;
      try {
        for (const clip of selected) {
          for (const preset of presets) {
            signal.throwIfAborted();
            const settings = dynamicSettings(clip.settings, preset);
            const index = results.length;
            results.push(
              await render(
                p,
                {
                  ...clip,
                  title: clip.title + " · " + settings.label,
                  familyId: clip.familyId || clip.editorialId || clip.id,
                  editorialId: randomUUID(),
                },
                settings.value,
                preset === "refreshed"
                  ? refreshed.get(clip.id)!
                  : clip.segments,
                signal,
                randomUUID(),
                (seconds) => {
                  progress.update(
                    index + Math.min(1, seconds / (clip.end - clip.start)),
                    total,
                    "clips",
                    "Rendering " + settings.label,
                  );
                },
              ),
            );
          }
        }
        signal.throwIfAborted();
        await progress.flush();
        p.clips = [...p.clips, ...results];
        p.status = "ready";
        p.stage = "complete";
        p.detail = total + " variations ready";
        completeProgress(p, "rendering");
        await save(p);
        committed = true;
      } finally {
        if (!committed)
          await Promise.allSettled(
            results.map((c) =>
              fs.rm(file("clips", c.id, "mp4"), { force: true }),
            ),
          );
      }
    });
  }
  return { count, projects: groups.length };
}
