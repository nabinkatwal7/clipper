import { promises as fs } from "node:fs";
import path from "node:path";
import type { Project } from "../types";

/**
 * Storage classification, cache sweeps and dependency-aware cleanup.
 * Deletion is always two-step: build a plan (preview), then execute exactly the items the user
 * confirmed. Paths are re-validated to sit inside the workspace at execution time.
 */
export type Category =
  | "source" | "proxy" | "clips" | "audio-temp" | "analysis-cache" | "ollama-cache" | "embedding-cache"
  | "preview-cache" | "speech-temp" | "partial" | "user-imports" | "results" | "assets" | "transcripts" | "projects" | "other";

export type Entry = { path: string; dir: string; name: string; projectId?: string; bytes: number; mtimeMs: number; category: Category };

/** Categories that can be rebuilt from the source and settings. */
export const REGENERABLE: ReadonlySet<Category> = new Set(["proxy", "audio-temp", "analysis-cache", "ollama-cache", "embedding-cache", "preview-cache", "speech-temp", "partial"]);
const CACHE_CATEGORIES: Category[] = ["analysis-cache", "ollama-cache", "embedding-cache", "preview-cache", "proxy"];

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

export function classify(dir: string, name: string): { category: Category; projectId?: string } {
  const m = name.match(new RegExp(`^(${UUID})\\.(.+)$`, "i"));
  const projectId = m?.[1];
  const rest = m?.[2] ?? name;
  if (name.endsWith(".tmp") || /\.tmp$/.test(rest)) return { category: "partial", projectId };
  switch (dir) {
    case "uploads": return { category: rest === "proxy.mp4" ? "proxy" : rest === "mp4" ? "source" : "other", projectId };
    case "clips": return { category: "clips", projectId };
    case "audio": return { category: "audio-temp", projectId };
    case "assets": return { category: "assets", projectId };
    case "transcripts": return { category: "transcripts", projectId };
    case "projects": return { category: "projects", projectId };
    case "temp":
      if (/^signals\./.test(rest) || rest === "index.json") return { category: "analysis-cache", projectId };
      if (/^speech\./.test(rest)) return { category: "speech-temp", projectId };
      if (/^[a-f0-9]{64}\.embeddings\.json$/.test(rest)) return { category: "embedding-cache", projectId };
      if (/^[a-f0-9]{64}\.json$/.test(rest)) return { category: "ollama-cache", projectId };
      if (/^[a-f0-9]{64}\.mp4$/.test(rest)) return { category: "preview-cache", projectId };
      // chat/replay imports and moment results are user data or costly results: never auto-removed.
      if (/^(chat\.messages|replay\.points|moments|chat)\.json$/.test(rest)) return { category: rest === "moments.json" ? "results" : "user-imports", projectId };
      return { category: "other", projectId };
  }
  return { category: "other", projectId };
}

const DIRS = ["uploads", "clips", "audio", "temp", "assets", "transcripts", "projects"] as const;
const MAX_ENTRIES = 300_000;

export async function scan(root: string): Promise<Entry[]> {
  const out: Entry[] = [];
  for (const dir of DIRS) {
    const base = path.join(root, dir);
    const names = await fs.readdir(base).catch(() => [] as string[]);
    for (const name of names) {
      if (out.length >= MAX_ENTRIES) throw Error("Too many files to scan safely.");
      const p = path.join(base, name);
      const st = await fs.stat(p).catch(() => null);
      if (!st?.isFile()) continue;
      const c = classify(dir, name);
      out.push({ path: p, dir, name, projectId: c.projectId, bytes: st.size, mtimeMs: st.mtimeMs, category: c.category });
    }
  }
  return out;
}

export function report(entries: Entry[]) {
  const by = new Map<Category, { bytes: number; count: number }>();
  for (const e of entries) {
    const x = by.get(e.category) ?? { bytes: 0, count: 0 };
    x.bytes += e.bytes;
    x.count++;
    by.set(e.category, x);
  }
  return [...by].map(([category, v]) => ({ category, ...v, regenerable: REGENERABLE.has(category) })).sort((a, b) => b.bytes - a.bytes);
}

export type PlanItem = { path: string; name: string; bytes: number; category: Category; reason: string };
export type Plan = { items: PlanItem[]; blocked: { name: string; reason: string }[]; bytes: number };

const done = (items: PlanItem[], blocked: Plan["blocked"]): Plan => ({ items, blocked, bytes: items.reduce((a, i) => a + i.bytes, 0) });
const item = (e: Entry, reason: string): PlanItem => ({ path: e.path, name: e.name, bytes: e.bytes, category: e.category, reason });

/** Cache sweep: expiry and size limits over regenerable caches only. Busy projects are skipped. */
export function planCache(entries: Entry[], o: { olderThanDays?: number; limitMb?: number; categories?: Category[]; busy: Set<string>; now?: number }): Plan {
  const now = o.now ?? Date.now();
  const cats = new Set((o.categories ?? CACHE_CATEGORIES).filter((c) => REGENERABLE.has(c)));
  const blocked: Plan["blocked"] = [];
  const pool = entries.filter((e) => {
    if (!cats.has(e.category)) return false;
    if (e.projectId && o.busy.has(e.projectId)) return (blocked.push({ name: e.name, reason: "project has a running job" }), false);
    return true;
  });
  const chosen = new Map<string, PlanItem>();
  if (o.olderThanDays !== undefined)
    for (const e of pool) if (now - e.mtimeMs > o.olderThanDays * 86400_000) chosen.set(e.path, item(e, `older than ${o.olderThanDays} days`));
  if (o.limitMb !== undefined) {
    let total = pool.reduce((a, e) => a + e.bytes, 0) - [...chosen.values()].reduce((a, i) => a + i.bytes, 0);
    const limit = o.limitMb * 1048576;
    for (const e of [...pool].sort((a, b) => a.mtimeMs - b.mtimeMs)) {
      if (total <= limit) break;
      if (chosen.has(e.path)) continue;
      chosen.set(e.path, item(e, `cache over ${o.limitMb} MB (oldest first)`));
      total -= e.bytes;
    }
  }
  return done([...chosen.values()], blocked);
}

export type Policy = "preserve" | "production" | "space-saver" | "temporary" | "archive";
export const POLICIES: Policy[] = ["preserve", "production", "space-saver", "temporary", "archive"];

/** Clips whose renders were checked and passed with no warnings. */
export const verified = (p: Project) => p.clips.length > 0 && p.clips.every((c) => !!c.qa && c.qa.warnings.length === 0);

/**
 * Policy preview. Sources are only ever proposed under "temporary", only when the source can be
 * downloaded again, the project is idle and verified, and no other project references it.
 */
export function planPolicy(policy: Policy, entries: Entry[], projects: Project[], busy: Set<string>, now = Date.now()): Plan {
  const items: PlanItem[] = [];
  const blocked: Plan["blocked"] = [];
  if (policy === "preserve" || policy === "archive") return done(items, [{ name: "(all)", reason: policy === "archive" ? "Archive mode packages projects (see Backups); it never deletes." : "Preserve Everything keeps all files." }]);
  const byId = new Map(projects.map((p) => [p.id, p]));
  const take = (e: Entry, reason: string) => items.push(item(e, reason));
  const blockedMsg = (e: Entry, reason: string) => blocked.push({ name: e.name, reason });
  const stale = (e: Entry) => now - e.mtimeMs > 3600_000; // never touch files written in the last hour

  for (const e of entries) {
    const proj = e.projectId ? byId.get(e.projectId) : undefined;
    const idle = !e.projectId || !busy.has(e.projectId);
    if (e.category === "partial") {
      if (stale(e)) take(e, "incomplete temporary file");
      continue;
    }
    if (!REGENERABLE.has(e.category) && e.category !== "source") continue;
    if (!idle) { blockedMsg(e, "project has a running job"); continue; }
    if (e.category === "audio-temp" || e.category === "speech-temp") {
      if (proj && proj.status === "ready") take(e, "extracted audio is rebuilt when needed");
      continue;
    }
    if (policy === "production") continue;
    // space-saver and temporary
    if (e.category === "source") {
      if (policy !== "temporary") continue;
      if (!proj) { blockedMsg(e, "no project record"); continue; }
      if (!proj.source) { blockedMsg(e, "imported from a local file; it cannot be downloaded again"); continue; }
      if (!verified(proj)) { blockedMsg(e, "clips are not verified (or none exist yet)"); continue; }
      const ref = projects.find((o) => o.id !== proj.id && JSON.stringify(o.settings).includes(proj.id));
      if (ref) { blockedMsg(e, `referenced by project "${ref.title}"`); continue; }
      take(e, "downloaded source; can be fetched again from its URL");
      continue;
    }
    if (!proj || !verified(proj)) { blockedMsg(e, "clips are not verified (or none exist yet)"); continue; }
    if (!stale(e)) continue;
    take(e, "regenerable cache of a verified project");
  }
  return done(items, blocked);
}

/** Delete exactly the confirmed paths, after proving each is a plan item inside the workspace. */
export async function execute(root: string, plan: Plan, confirmedPaths: string[]) {
  const allowed = new Map(plan.items.map((i) => [path.resolve(i.path), i]));
  const base = path.resolve(root) + path.sep;
  let freed = 0, removed = 0;
  const failed: string[] = [];
  for (const p of confirmedPaths) {
    const abs = path.resolve(p);
    const it = allowed.get(abs);
    if (!it || !abs.startsWith(base)) { failed.push(path.basename(abs) + " (not in the approved preview)"); continue; }
    try {
      await fs.rm(abs, { force: true });
      freed += it.bytes;
      removed++;
    } catch (e) {
      failed.push(it.name + " (" + (e instanceof Error ? e.message : String(e)) + ")");
    }
  }
  return { removed, freed, failed };
}
