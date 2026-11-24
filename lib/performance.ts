import type { Project } from "./types";
import type { Ledger } from "./production";
export function performanceSummary(p: Project, d: Ledger) {
  const groups = new Map<string, { views: number; measured: number }>();
  for (const c of p.clips) {
    const v = d.analytics[c.editorialId || c.id]?.views;
    if (v === undefined) continue;
    const category = (c.category||c.settings.category)?.trim() || "Uncategorized";
    const entry = groups.get(category) || { views: 0, measured: 0 };
    entry.views += v;
    entry.measured++;
    groups.set(category, entry);
  }
  return [...groups]
    .map(([category, g]) => ({
      category,
      ...g,
      meanViews: g.views / g.measured,
    }))
    .sort((a, b) => b.meanViews - a.meanViews);
}
