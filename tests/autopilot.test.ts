import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { AutopilotSchema, chooseProfile, fileKey, isDue, pickCandidates, readyFiles, resumePoint, newRun, type Autopilot, type Run } from "../lib/clipping/autopilot-core";
import { parseAutopilot, startRun, retryRun, approveRun } from "../lib/clipping/autopilot";
import { readCollection, mutateCollection } from "../lib/clipping/collection";
import { workspaceScope, storageBase } from "../lib/identity";
import { init, file, save, read } from "../lib/store";
import { defaults, type Project } from "../lib/types";
import { run, bin } from "../lib/process";
import type { Candidate } from "../lib/clipping/candidates";

const base = (over: Partial<Autopilot> = {}): Autopilot =>
  AutopilotSchema.parse({ id: "autopilot-0001", name: "T", trigger: { kind: "manual" }, requireApproval: false, ...over });

test("autopilot schema: defaults are safe (disabled, approval required) and invalid triggers are rejected", () => {
  const ap = AutopilotSchema.parse({ id: "autopilot-0002", name: "x", trigger: { kind: "new-video", creatorId: "creator-0001" } });
  assert.equal(ap.enabled, false);
  assert.equal(ap.requireApproval, true);
  assert.equal(ap.useAi, false);
  assert.throws(() => AutopilotSchema.parse({ id: "autopilot-0003", name: "x", trigger: { kind: "file-arrival", folder: "" } }));
  assert.throws(() => parseAutopilot({ id: "autopilot-0004", name: "x", trigger: { kind: "new-video", creatorId: "creator-0001", intervalMinutes: 1 } }));
});

test("due checks, language routing and branching helpers", () => {
  const now = Date.parse("2026-11-26T12:00:00Z");
  const ap = base({ enabled: true, trigger: { kind: "file-arrival", folder: "/x", intervalMinutes: 5 }, lastRun: "2026-11-26T11:57:00Z" });
  assert.equal(isDue(ap, now), false);
  assert.equal(isDue({ ...ap, lastRun: "2026-11-26T11:50:00Z" }, now), true);
  assert.equal(isDue({ ...ap, enabled: false }, now), false);
  assert.equal(isDue(base({ enabled: true }), now), false, "manual never due");
  const routed = base({ profile: "general", routes: [{ language: "ne", profile: "comedy" }] });
  assert.equal(chooseProfile(routed, "ne"), "comedy");
  assert.equal(chooseProfile(routed, "ne-Latn"), "comedy");
  assert.equal(chooseProfile(routed, "en"), "general");
  assert.equal(chooseProfile(routed, undefined), "general");
  const r = newRun(ap, "run-1", "s", "p");
  assert.equal(resumePoint(r), "import");
  r.steps.forEach((s) => (s.status = "done"));
  assert.equal(resumePoint(r), null);
});

test("file arrival waits for a stable size and never re-imports a seen file", () => {
  const f = { name: "stream.mkv", size: 1000, mtimeMs: 5 };
  const first = readyFiles([f, { name: "notes.txt", size: 5, mtimeMs: 1 }], {}, new Set());
  assert.deepEqual(first.ready, []);
  assert.deepEqual(first.pending, { "stream.mkv": 1000 });
  assert.equal(readyFiles([{ ...f, size: 1500 }], first.pending, new Set()).ready.length, 0, "still growing");
  assert.equal(readyFiles([f], first.pending, new Set()).ready.length, 1);
  assert.equal(readyFiles([f], first.pending, new Set([fileKey(f)])).ready.length, 0);
});

test("candidate selection drops rejected, enforces min score, keeps the best N in time order", () => {
  const c = (id: string, start: number, score: number, review?: "rejected"): Candidate =>
    ({ id, start, end: start + 30, peakAt: start, score, breakdown: [], boundary: { start: "none", end: "none" }, precision: "media", notes: [], review });
  const picked = pickCandidates([c("a", 300, 0.9), c("b", 10, 0.5), c("c", 100, 0.95, "rejected"), c("d", 200, 0.1), c("e", 50, 0.7)], { minScore: 0.3, count: 2 });
  assert.deepEqual(picked.map((x) => x.id), ["e", "a"]);
});

// ---- Real pipeline: queue -> analyse -> select -> approval -> FFmpeg render, on a synthesised video.
const haveFfmpeg = path.isAbsolute(bin.ffmpeg) && existsSync(bin.ffmpeg);
async function waitFor<T>(fn: () => Promise<T | undefined>, ms = 180_000): Promise<T> {
  const end = Date.now() + ms;
  for (;;) {
    const v = await fn();
    if (v !== undefined) return v;
    if (Date.now() > end) throw Error("timed out");
    await new Promise((r) => setTimeout(r, 500));
  }
}
test("autopilot end to end: approval gate, real render, run history, and retry of a failed run", { skip: !haveFfmpeg && "FFMPEG_BIN not configured" }, async () => {
  const user = "00000000-0000-4000-8000-" + String(Date.now()).padStart(12, "0");
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "clip-ap-"));
  try {
    await workspaceScope.run(user, async () => {
      await init();
      const fixture = path.join(tmp, "fixture.mp4");
      await run(bin.ffmpeg, [
        "-v", "error", "-y",
        "-f", "lavfi", "-i", "color=c=gray:s=320x180:r=10:d=40",
        "-f", "lavfi", "-i", "sine=f=300:d=40",
        "-f", "lavfi", "-i", "anoisesrc=d=5:c=white:a=0.8",
        "-f", "lavfi", "-i", "testsrc2=s=320x180:r=10:d=5",
        "-filter_complex", "[1:a]volume=0.1[q];[2:a]adelay=18000|18000,apad=whole_dur=40[b];[q][b]amix=inputs=2:duration=first:normalize=0[a];[0:v][3:v]overlay=enable='between(t,18,23)'[v]",
        "-map", "[v]", "-map", "[a]", "-t", "40", "-c:v", "libx264", "-preset", "ultrafast", "-c:a", "aac", fixture,
      ]);
      const pid = randomUUID(), now = new Date().toISOString();
      await fs.copyFile(fixture, file("uploads", pid, "mp4"));
      const p: Project = { id: pid, title: "fixture", duration: 0, width: 0, height: 0, status: "queued", stage: "queued", detail: "", createdAt: now, updatedAt: now, settings: { ...defaults, captions: false, count: 1, resolution: "720" }, clips: [], highlights: [] };
      await save(p);
      const ap = base({ requireApproval: true, minScore: 0.2, count: 1, name: "e2e" });
      const started = await startRun(ap, { projectId: pid });
      const runs = () => readCollection<Run>("runs");
      const find = (id: string) => runs().then((rs) => rs.find((r) => r.id === id)!);
      // 1) pauses for approval after real analysis
      const waiting = await waitFor(async () => { const r = await find(started.id); return r.status === "awaiting-approval" || r.status === "failed" ? r : undefined; });
      assert.equal(waiting.status, "awaiting-approval", waiting.error);
      assert.equal(waiting.steps.find((s) => s.name === "analyze")!.status, "done");
      assert.equal(waiting.steps.find((s) => s.name === "ai")!.status, "skipped");
      assert.ok(waiting.selected && waiting.selected.length === 1);
      assert.equal((await read(pid)).clips.length, 0, "nothing rendered before approval");
      // 2) approve -> render -> done
      await waitFor(async () => (await read(pid)).status === "ready" ? true : undefined);
      await approveRun(started.id);
      const done = await waitFor(async () => { const r = await find(started.id); return r.status === "done" || r.status === "failed" ? r : undefined; });
      assert.equal(done.status, "done", done.error);
      const after = await read(pid);
      assert.equal(after.clips.length, 1);
      assert.ok((await fs.stat(file("clips", after.clips[0].id, "mp4"))).size > 1000, "a real rendered file exists");
      assert.ok(after.clips[0].start <= 23 && after.clips[0].end >= 18, `clip ${after.clips[0].start}-${after.clips[0].end} covers the burst`);
      assert.equal(done.steps.find((s) => s.name === "render")!.status, "done");
      // 3) failure recovery: a failed run resumes from the failing step, finished steps are not repeated
      await mutateCollection<Run, void>("runs", (rows) => {
        const r = rows.find((x) => x.id === started.id)!;
        r.status = "failed"; r.error = "simulated";
        r.steps.find((s) => s.name === "render")!.status = "failed";
        r.steps.find((s) => s.name === "validate")!.status = "pending";
      });
      await waitFor(async () => (await read(pid)).status === "ready" ? true : undefined);
      await retryRun(started.id);
      const again = await waitFor(async () => { const r = await find(started.id); return r.status === "done" || r.status === "failed" ? r : undefined; });
      assert.equal(again.status, "done", again.error);
      assert.equal((await read(pid)).clips.length, 2, "render re-ran once; analysis was reused");
    });
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
    await fs.rm(path.join(storageBase, "workspaces", user), { recursive: true, force: true });
  }
});
