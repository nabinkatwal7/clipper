import { uuid } from "./id";
import type { Settings } from "./types";
import { defaults } from "./types";
import { settings as validateSettings } from "./validation";

export type ReelFactoryJob = {
  version: 1;
  id: string;
  name: string;
  createdAt: string;
  sources: string[];
  categories: string[];
  language: string;
  clipCount: number;
  duration: Settings["duration"];
  minScore: number;
  layout: Settings["layout"];
  style: Settings["style"];
  ratio: Settings["ratio"];
  resolution: Settings["resolution"];
  captions: boolean;
  brandingProfile?: string;
  reviewRequired: boolean;
  status: "draft" | "queued" | "running" | "partial" | "done" | "failed";
  results: { project: string; clip?: string; ok: boolean; error?: string }[];
};

export function validateReelJob(input: unknown): ReelFactoryJob {
  if (!input || typeof input !== "object") throw Error("Invalid reel job");
  const j = input as ReelFactoryJob;
  if (j.version !== 1) throw Error("Unsupported reel factory version");
  if (
    typeof j.name !== "string" ||
    !j.name.trim() ||
    j.name.length > 120 ||
    !Array.isArray(j.sources) ||
    !j.sources.length ||
    j.sources.length > 40 ||
    j.sources.some((id) => typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id))
  )
    throw Error("Select 1–40 source projects");
  if (
    ![5, 10, 20].includes(j.clipCount) ||
    !Number.isFinite(j.minScore) ||
    j.minScore < 0 ||
    j.minScore > 100
  )
    throw Error("Clip count must be 5, 10 or 20");
  // Reuse settings validation for layout/duration fields
  validateSettings({
    ...defaults,
    duration: j.duration || defaults.duration,
    layout: j.layout || defaults.layout,
    style: j.style || defaults.style,
    ratio: j.ratio || defaults.ratio,
    resolution: j.resolution || defaults.resolution,
    captions: !!j.captions,
    count: j.clipCount as 5 | 10 | 20,
    minimumScore: j.minScore,
  });
  return {
    version: 1,
    id: typeof j.id === "string" && /^[0-9a-f-]{36}$/i.test(j.id) ? j.id : uuid(),
    name: j.name.trim(),
    createdAt: j.createdAt || new Date().toISOString(),
    sources: j.sources,
    categories: Array.isArray(j.categories)
      ? j.categories
          .filter((c) => typeof c === "string")
          .slice(0, 20)
          .map((c) => c.slice(0, 60))
      : [],
    language: typeof j.language === "string" ? j.language.slice(0, 40) : "auto",
    clipCount: j.clipCount,
    duration: j.duration || defaults.duration,
    minScore: j.minScore,
    layout: j.layout || defaults.layout,
    style: j.style || defaults.style,
    ratio: j.ratio || defaults.ratio,
    resolution: j.resolution || defaults.resolution,
    captions: !!j.captions,
    brandingProfile:
      typeof j.brandingProfile === "string"
        ? j.brandingProfile.slice(0, 80)
        : undefined,
    reviewRequired: !!j.reviewRequired,
    status: j.status || "draft",
    results: Array.isArray(j.results) ? j.results.slice(0, 200) : [],
  };
}

export function settingsFromReel(job: ReelFactoryJob): Settings {
  return validateSettings({
    ...defaults,
    mode: "ai",
    duration: job.duration,
    count: job.clipCount,
    layout: job.layout,
    style: job.style,
    ratio: job.ratio,
    resolution: job.resolution,
    captions: job.captions,
    minimumScore: job.minScore,
    category: job.categories[0],
  });
}
