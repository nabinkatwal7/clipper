import { defaults, type Settings } from "./types";
import { settings } from "./validation";
export const workflows: Record<string, Partial<Settings>> = {
  "Streamer highlights": { count: 5 },
  "Gaming reactions": {
    category: "Gaming",
    layout: "facecam",
    style: "highlight",
  },
  "Podcast shorts": {
    category: "Interview",
    duration: "30-60",
    style: "minimal",
  },
  "Educational clips": { category: "Education", analysisDepth: "deep" },
  "Funny moments": {
    category: "Comedy",
    instructions: "Prefer complete humorous exchanges.",
  },
  "Quick social clips": {
    analysisDepth: "fast",
    duration: "15-30",
    resolution: "720",
  },
  "Cinematic highlights": {
    resolution: "1080",
    analysisDepth: "deep",
    grade: { contrast: 1.12, saturation: 0.85 },
  },
};
export const operations = [
  "analyze",
  "filter",
  "select",
  "layout",
  "subtitles",
  "normalize",
  "render",
] as const;
export type Op = (typeof operations)[number];
export type Workflow = {
  version: 1;
  settings: Settings;
  nodes: Op[];
  edges: [Op, Op][];
};
export function compileWorkflow(w: Workflow) {
  if (
    w.version !== 1 ||
    !Array.isArray(w.nodes) ||
    !Array.isArray(w.edges) ||
    w.nodes.length > operations.length ||
    new Set(w.nodes).size !== w.nodes.length ||
    !w.nodes.includes("render") ||
    !w.nodes.includes("analyze") ||
    w.nodes.some((n) => !operations.includes(n))
  )
    throw Error(
      "Workflow requires analysis, render and unique supported operations.",
    );
  for (const e of w.edges)
    if (
      !Array.isArray(e) ||
      e.length !== 2 ||
      !w.nodes.includes(e[0]) ||
      !w.nodes.includes(e[1]) ||
      operations.indexOf(e[0]) >= operations.indexOf(e[1])
    )
      throw Error("Invalid or circular workflow connection.");
  const order = operations.filter((n) => w.nodes.includes(n));
  for (let i = 1; i < order.length; i++) {
    if (!w.edges.some(([a, b]) => a === order[i - 1] && b === order[i]))
      throw Error(
        "Connect the workflow into a continuous processing sequence.",
      );
  }
  const s = settings({ ...defaults, ...w.settings, mode: "ai" });
  if (!order.includes("filter")) {
    s.minimumScore = 0;
    s.includeWords = "";
    s.excludeWords = "";
  }
  if (!order.includes("select")) s.count = defaults.count;
  if (!order.includes("layout")) {
    s.ratio = defaults.ratio;
    s.layout = defaults.layout;
  }
  if (!order.includes("subtitles")) s.captions = false;
  s.mix = { ...s.mix, normalize: order.includes("normalize") };
  return s;
}
