import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { workspaceScope } from "../identity";
import { busy, enqueue, generate, ingest, probe } from "../jobs";
import { validateUrl } from "../network";
import { ledger } from "../production-store";
import { file, read, save, transcript } from "../store";
import { settings as parseSettings } from "../validation";
import type { Project } from "../types";
import { checkCompliance, factsFromClip, type Campaign } from "./campaigns";
import { AutopilotSchema, MAX_RUNS, chooseProfile, fileKey, isDue, newRun, pickCandidates, readyFiles, resumePoint, trimSeen, type Autopilot, type Run, type StepName } from "./autopilot-core";
import { mutateCollection, readCollection, upsert } from "./collection";
import { checkCreator, type Creator } from "./discovery-store";
import { momentsFile, parseMomentOptions, runMomentAi, runMomentAnalysis, type MomentsResult } from "./engine";
import { readJson } from "./media-analysis";
import type { TrackedVideo } from "./feeds";

const updateRun = (id: string, fn: (r: Run) => void) =>
  mutateCollection<Run, void>("runs", (rows) => {
    const r = rows.find((x) => x.id === id);
    if (r) fn(r);
  });

async function step(runId: string, name: StepName, fn: () => Promise<{ status?: "done" | "skipped"; detail?: string } | void>) {
  const run = (await readCollection<Run>("runs")).find((r) => r.id === runId)!;
  const cur = run.steps.find((s) => s.name === name)!;
  if (cur.status === "done" || cur.status === "skipped") return "cached" as const;
  await updateRun(runId, (r) => Object.assign(r.steps.find((s) => s.name === name)!, { status: "running", at: new Date().toISOString(), detail: undefined }));
  try {
    const out = (await fn()) ?? {};
    await updateRun(runId, (r) => Object.assign(r.steps.find((s) => s.name === name)!, { status: out.status ?? "done", detail: out.detail, at: new Date().toISOString() }));
    return "ran" as const;
  } catch (e) {
    await updateRun(runId, (r) => Object.assign(r.steps.find((s) => s.name === name)!, { status: "failed", detail: e instanceof Error ? e.message : String(e), at: new Date().toISOString() }));
    throw e;
  }
}

async function finish(runId: string, status: Run["status"], detail?: string, from?: StepName) {
  await updateRun(runId, (r) => {
    r.status = status;
    r.finishedAt = new Date().toISOString();
    if (detail) r.error = status === "failed" ? detail : undefined;
    if (from) for (const s of r.steps) if (s.status === "pending") Object.assign(s, { status: "skipped", detail: detail ?? "branch ended the run" });
  });
}

/** The whole production pipeline. Idempotent per step, so retry resumes where it stopped. */
async function pipeline(runId: string, signal: AbortSignal, language?: string) {
  const getRun = async () => (await readCollection<Run>("runs")).find((r) => r.id === runId)!;
  const run0 = await getRun();
  const ap = (await readCollection<Autopilot>("autopilots")).find((a) => a.id === run0.autopilotId);
  if (!ap) throw Error("Autopilot was deleted.");
  const pid = run0.projectId!;
  try {
    await step(runId, "import", async () => {
      const p = await read(pid);
      if (!p.duration) await (p.source ? ingest(p, signal) : probe(p, signal));
      return { detail: `${Math.round((await read(pid)).duration)}s source ready` };
    });
    if (ap.requireTranscript && !(await transcript(pid).catch(() => null))?.length) {
      await updateRun(runId, (r) => Object.assign(r.steps.find((s) => s.name === "analyze")!, { status: "skipped", detail: "Branch: no transcript and this autopilot requires one." }));
      return finish(runId, "done", "No transcript; stopped by the requireTranscript condition.", "analyze");
    }
    await step(runId, "analyze", async () => {
      const profile = chooseProfile(ap, language);
      await runMomentAnalysis(await read(pid), parseMomentOptions({ profile, count: Math.min(20, ap.count * 2), minScore: ap.minScore }), signal);
      return { detail: `profile ${profile}` };
    });
    await step(runId, "ai", async () => {
      if (!ap.useAi) return { status: "skipped", detail: "AI ranking is off." };
      await runMomentAi(await read(pid), "intelligent", signal);
      const r = await readJson<MomentsResult>(momentsFile(pid));
      return { detail: r?.aiReport?.used ? `Ollama reviewed ${r.aiReport.analysed}` : (r?.aiReport?.notes.join(" ") ?? "skipped") };
    });
    let ended = false;
    await step(runId, "select", async () => {
      const moments = await readJson<MomentsResult>(momentsFile(pid));
      const picks = pickCandidates(moments?.candidates ?? [], ap);
      await updateRun(runId, (r) => void (r.selected = picks.map((c) => c.id)));
      if (!picks.length) ended = true;
      return { detail: picks.length ? `${picks.length} candidate(s) passed` : "No candidate met the minimum score." };
    });
    if (ended || !(await getRun()).selected?.length) return finish(runId, "done", "No candidates to produce.", "approval");
    if (ap.requireApproval && (await getRun()).steps.find((s) => s.name === "approval")!.status !== "done") {
      await updateRun(runId, (r) => {
        r.status = "awaiting-approval";
        Object.assign(r.steps.find((s) => s.name === "approval")!, { status: "running", detail: "Waiting for your approval of the selected moments." });
      });
      return;
    }
    await step(runId, "approval", async () => ({ status: "skipped", detail: "Approval not required." }));
    await step(runId, "render", async () => {
      if (!ap.render) return { status: "skipped", detail: "Rendering is off; candidates are in the Moment finder." };
      const p = await read(pid);
      const moments = (await readJson<MomentsResult>(momentsFile(pid)))!;
      const chosen = new Set((await getRun()).selected);
      const camp = ap.campaignId ? (await readCollection<Campaign>("campaigns")).find((c) => c.id === ap.campaignId) : undefined;
      if (camp) {
        p.settings = {
          ...p.settings,
          ...(camp.ratio !== "any" ? { ratio: camp.ratio } : {}),
          ...(camp.layout !== "any" ? { layout: camp.layout } : {}),
          captions: camp.captions.required || p.settings.captions,
        };
        await save(p);
      }
      const ranges = moments.candidates.filter((c) => chosen.has(c.id)).map((c) => ({
        start: c.start, end: c.end, title: c.metadata?.title ?? `Moment ${c.id.slice(1)}`,
        reason: `Autopilot: measured score ${Math.round(c.score * 100)}`, score: Math.round(c.score * 100),
      }));
      await generate(p, signal, ranges);
      return { detail: `${ranges.length} clip(s) rendered` };
    });
    await step(runId, "validate", async () => {
      const camp = ap.campaignId ? (await readCollection<Campaign>("campaigns")).find((c) => c.id === ap.campaignId) : undefined;
      if (!camp || !ap.render) return { status: "skipped", detail: camp ? "Nothing rendered." : "No campaign linked." };
      const p = await read(pid);
      const led = await ledger(pid);
      const rows = p.clips.map((c) => {
        const rep = checkCompliance(camp, factsFromClip(p, c, { attributionText: led.rights.attribution || undefined, sourceCreator: led.rights.creator || undefined, rights: led.rights.permission }));
        return { clip: c.id, compliant: rep.summary.compliant, fail: rep.summary.fail, needsReview: rep.summary.needsReview };
      });
      await updateRun(runId, (r) => void (r.compliance = rows));
      return { detail: `${rows.filter((x) => x.fail === 0).length}/${rows.length} clips have no failed checks` };
    });
    await finish(runId, "done");
  } catch (e) {
    await finish(runId, signal.aborted ? "cancelled" : "failed", e instanceof Error ? e.message : String(e));
    throw e;
  }
}

async function addRun(run: Run) {
  await mutateCollection<Run, void>("runs", (rows) => {
    rows.push(run);
    while (rows.length > MAX_RUNS) rows.shift();
  });
}

export type Source = { url?: string; file?: string; projectId?: string; language?: string };

/** Create (or reuse) the project, record the run, and queue the pipeline on the shared job queue. */
export async function startRun(ap: Autopilot, src: Source): Promise<Run> {
  let p: Project;
  if (src.projectId) p = await read(src.projectId);
  else {
    const id = randomUUID();
    const now = new Date().toISOString();
    p = { id, title: "Autopilot import", duration: 0, width: 0, height: 0, status: "queued", stage: "queued", detail: "Waiting for local worker", createdAt: now, updatedAt: now, settings: parseSettings({ count: ap.count }), clips: [], highlights: [] };
    if (src.url) {
      p.source = (await validateUrl(src.url)).href;
    } else if (src.file) {
      p.title = path.basename(src.file).slice(0, 200);
      await fs.copyFile(src.file, file("uploads", id, "mp4"), fs.constants.COPYFILE_EXCL);
    } else throw Error("Choose a project, URL or file.");
    await save(p);
  }
  if (busy(p.id)) throw Error("That project already has a running job.");
  const run = newRun(ap, randomUUID(), src.url ?? src.file ?? p.title, p.id);
  await addRun(run);
  await upsert("autopilots", { ...ap, lastRun: run.startedAt }, 100);
  enqueue(p.id, (signal) => pipeline(run.id, signal, src.language));
  return run;
}

/** Resume a failed or interrupted run from its first unfinished step. */
export async function retryRun(runId: string): Promise<Run> {
  const run = (await readCollection<Run>("runs")).find((r) => r.id === runId);
  if (!run || !run.projectId) throw Error("Run not found.");
  if (run.status === "running" || run.status === "awaiting-approval") throw Error("This run is not finished.");
  if (!resumePoint(run)) throw Error("Nothing left to retry.");
  if (busy(run.projectId)) throw Error("That project already has a running job.");
  await updateRun(runId, (r) => {
    r.status = "running";
    r.error = undefined;
    r.finishedAt = undefined;
    for (const s of r.steps) if (s.status === "failed" || s.status === "running") s.status = "pending";
  });
  enqueue(run.projectId, (signal) => pipeline(runId, signal));
  return { ...run, status: "running" };
}

export async function approveRun(runId: string, ids?: string[]): Promise<Run> {
  const run = (await readCollection<Run>("runs")).find((r) => r.id === runId);
  if (!run || run.status !== "awaiting-approval" || !run.projectId) throw Error("This run is not waiting for approval.");
  if (busy(run.projectId)) throw Error("That project already has a running job.");
  await updateRun(runId, (r) => {
    if (ids) r.selected = r.selected?.filter((x) => ids.includes(x));
    r.status = "running";
    Object.assign(r.steps.find((s) => s.name === "approval")!, { status: "done", detail: "Approved by you.", at: new Date().toISOString() });
  });
  enqueue(run.projectId, (signal) => pipeline(runId, signal));
  return run;
}

export async function rejectRun(runId: string) {
  await updateRun(runId, (r) => {
    if (r.status !== "awaiting-approval") return;
    r.status = "cancelled";
    r.finishedAt = new Date().toISOString();
    Object.assign(r.steps.find((s) => s.name === "approval")!, { status: "failed", detail: "Rejected by you." });
    for (const s of r.steps) if (s.status === "pending") Object.assign(s, { status: "skipped" });
  });
}

export function parseAutopilot(input: unknown, prev?: Autopilot): Autopilot {
  const r = AutopilotSchema.safeParse({ ...(input as object), seen: prev?.seen ?? [], pending: prev?.pending ?? {}, baselined: prev?.baselined ?? false, lastRun: prev?.lastRun });
  if (!r.success) throw Error("Invalid autopilot: " + r.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; "));
  return r.data;
}

/** Evaluate one autopilot's trigger. Returns the runs it started. */
export async function evaluate(ap: Autopilot): Promise<{ started: Run[]; note: string }> {
  const runs = await readCollection<Run>("runs");
  if (runs.some((r) => r.autopilotId === ap.id && (r.status === "running" || r.status === "awaiting-approval")))
    return { started: [], note: "A previous run is still active." };
  const started: Run[] = [];
  const checked = async (patch: Partial<Autopilot>) => upsert("autopilots", { ...ap, ...patch, lastRun: new Date().toISOString() }, 100);
  if (ap.trigger.kind === "new-video") {
    const creator = (await readCollection<Creator>("creators")).find((c) => c.id === (ap.trigger as { creatorId: string }).creatorId);
    if (!creator) return { started, note: "Tracked creator no longer exists." };
    let note = "";
    try { await checkCreator(creator.id, false); } catch (e) { note = (e as Error).message; }
    const vids = (await readCollection<TrackedVideo>("videos")).filter((v) => v.creatorId === creator.id);
    if (!ap.baselined) {
      // Only uploads that appear AFTER the autopilot was enabled are processed.
      await checked({ baselined: true, seen: trimSeen(ap.seen, vids.map((v) => v.id)) });
      return { started, note: "Recorded the current uploads as already seen; new uploads will be processed." };
    }
    const fresh = vids.filter((v) => !ap.seen.includes(v.id)).sort((a, b) => Date.parse(b.published ?? "0") - Date.parse(a.published ?? "0")).slice(0, ap.maxPerRun);
    let current = ap;
    for (const v of fresh) {
      try { started.push(await startRun(current, { url: v.url, language: creator.language })); } catch (e) { note = (e as Error).message; }
      current = { ...current, seen: trimSeen(current.seen, [v.id]) };
    }
    await checked({ seen: trimSeen(ap.seen, fresh.map((v) => v.id)) });
    return { started, note };
  }
  if (ap.trigger.kind === "file-arrival") {
    const folder = path.resolve(ap.trigger.folder);
    const names = await fs.readdir(folder).catch(() => null);
    if (!names) { await checked({}); return { started, note: "Folder is not readable." }; }
    const listing = (await Promise.all(names.map(async (name) => {
      const st = await fs.stat(path.join(folder, name)).catch(() => null);
      return st?.isFile() ? { name, size: st.size, mtimeMs: st.mtimeMs } : null;
    }))).filter((x): x is NonNullable<typeof x> => !!x);
    if (!ap.baselined) {
      await checked({ baselined: true, seen: trimSeen(ap.seen, listing.map(fileKey)) });
      return { started, note: "Existing files were recorded as seen; files that arrive later will be processed." };
    }
    const { ready, pending } = readyFiles(listing, ap.pending, new Set(ap.seen));
    const take = ready.slice(0, ap.maxPerRun);
    for (const f of take) started.push(await startRun(ap, { file: path.join(folder, f.name) }));
    await checked({ pending, seen: trimSeen(ap.seen, take.map(fileKey)) });
    return { started, note: "" };
  }
  return { started, note: "Manual autopilots only run when you start them." };
}

/** Evaluate every due autopilot of the current user. */
export async function evaluateDue(now = Date.now()) {
  const aps = await readCollection<Autopilot>("autopilots");
  const out: { id: string; started: number; note: string }[] = [];
  for (const ap of aps) if (isDue(ap, now)) {
    try {
      const r = await evaluate(ap);
      out.push({ id: ap.id, started: r.started.length, note: r.note });
    } catch (e) {
      out.push({ id: ap.id, started: 0, note: (e as Error).message });
    }
  }
  return out;
}

// ---- in-process scheduler: runs only while this server process is alive.
const g = globalThis as unknown as { clipperScheduler?: { users: Set<string>; timer?: NodeJS.Timeout; ticking: boolean } };
const sched = (g.clipperScheduler ??= { users: new Set(), ticking: false });

async function tick() {
  if (sched.ticking) return;
  sched.ticking = true;
  try {
    for (const user of sched.users) await workspaceScope.run(user, () => evaluateDue()).catch(() => {});
  } finally {
    sched.ticking = false;
  }
}

/** Register the current user for background checks. Called on authenticated API requests. */
export function touchScheduler() {
  const user = workspaceScope.getStore();
  if (!user) return;
  sched.users.add(user);
  if (!sched.timer) {
    sched.timer = setInterval(() => void tick(), 60_000);
    sched.timer.unref?.();
  }
}

