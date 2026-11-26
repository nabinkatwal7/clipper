// Long-form analysis benchmark. Usage:
//   npx tsx --env-file=.env.local scripts/benchmark-analysis.ts 10 60 [--resume]
// Arguments are source lengths in minutes. Sources are synthesised with FFmpeg (320x180, 10 fps,
// tone + periodic noise bursts), so numbers reflect analysis cost for that content on THIS machine.
import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { workspaceScope } from "../lib/identity";
import { init, file, save, read } from "../lib/store";
import { probe } from "../lib/jobs";
import { run, bin } from "../lib/process";
import { runMomentAnalysis, momentsFile, type MomentsResult } from "../lib/clipping/engine";
import { readJson } from "../lib/clipping/media-analysis";
import { defaults, type Project } from "../lib/types";

const minutes = process.argv.slice(2).filter((a) => /^\d+$/.test(a)).map(Number);
const resume = process.argv.includes("--resume");
const hd = process.argv.includes("--720p"); // 1280x720 @ 30 fps instead of 320x180 @ 10 fps
const SIZE = hd ? "1280x720" : "320x180";
const FPS = hd ? 30 : 10;

function ffmpegMemoryMb(): Promise<number> {
  return new Promise((resolve) =>
    execFile("tasklist", ["/FI", "IMAGENAME eq ffmpeg.exe", "/FO", "CSV", "/NH"], (_e, out) => {
      let kb = 0;
      for (const line of String(out).split(/\r?\n/)) {
        const m = line.match(/"([\d,. ]+) K"\s*$/);
        if (m) kb += Number(m[1].replace(/[^\d]/g, ""));
      }
      resolve(kb / 1024);
    }),
  );
}

async function sampler() {
  let peakNode = 0, peakFfmpeg = 0, running = true;
  const cpu0 = process.cpuUsage(), t0 = Date.now();
  let idle0 = 0, total0 = 0;
  for (const c of os.cpus()) { idle0 += c.times.idle; total0 += c.times.user + c.times.nice + c.times.sys + c.times.idle + c.times.irq; }
  const loop = (async () => {
    while (running) {
      peakNode = Math.max(peakNode, process.memoryUsage().rss / 1048576);
      peakFfmpeg = Math.max(peakFfmpeg, await ffmpegMemoryMb());
      await new Promise((r) => setTimeout(r, 400));
    }
  })();
  return async () => {
    running = false;
    await loop;
    let idle = 0, total = 0;
    for (const c of os.cpus()) { idle += c.times.idle; total += c.times.user + c.times.nice + c.times.sys + c.times.idle + c.times.irq; }
    const cpu = process.cpuUsage(cpu0);
    return {
      wallSec: (Date.now() - t0) / 1000,
      peakNodeRssMb: Math.round(peakNode),
      peakFfmpegMb: Math.round(peakFfmpeg),
      systemCpuAvgPercent: Math.round((1 - (idle - idle0) / (total - total0)) * 1000) / 10,
      nodeCpuSec: Math.round((cpu.user + cpu.system) / 1e4) / 100,
    };
  };
}

async function synth(target: string, mins: number) {
  const secs = mins * 60;
  const t = Date.now();
  // 12-second noise burst every 5 minutes, with a visual overlay at the same moments.
  await run(bin.ffmpeg, [
    "-v", "error", "-y",
    "-f", "lavfi", "-i", `color=c=gray:s=${SIZE}:r=${FPS}:d=${secs}`,
    "-f", "lavfi", "-i", `sine=f=220:d=${secs}`,
    "-f", "lavfi", "-i", `anoisesrc=d=${secs}:c=white:a=0.7`,
    "-f", "lavfi", "-i", `testsrc2=s=${SIZE}:r=${FPS}:d=${secs}`,
    "-filter_complex",
    "[1:a]volume=0.1[t];[2:a]volume='if(lt(mod(t,300),12),1,0)':eval=frame[n];[t][n]amix=inputs=2:duration=first:normalize=0[a];[0:v][3:v]overlay=enable='lt(mod(t,300),12)'[v]",
    "-map", "[v]", "-map", "[a]", "-t", String(secs), "-c:v", "libx264", "-preset", "ultrafast", "-g", String(FPS * 5), "-c:a", "aac", "-b:a", "48k", target,
  ], undefined, undefined, 3 * 3600_000);
  return (Date.now() - t) / 1000;
}

async function main() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "clip-bench-"));
  const user = "00000000-0000-4000-8000-" + String(Date.now()).padStart(12, "0");
  const results: unknown[] = [];
  try {
    await workspaceScope.run(user, async () => {
      await init();
      for (const mins of minutes) {
        const id = randomUUID(), now = new Date().toISOString();
        const synthSec = await synth(file("uploads", id, "mp4"), mins);
        const size = (await fs.stat(file("uploads", id, "mp4"))).size;
        const p: Project = { id, title: `bench ${mins}m`, duration: 0, width: 0, height: 0, status: "queued", stage: "queued", detail: "", createdAt: now, updatedAt: now, settings: { ...defaults, captions: false }, clips: [], highlights: [] };
        await save(p);
        await probe(p, new AbortController().signal);
        const entry: Record<string, unknown> = { resolution: SIZE + "@" + FPS, sourceMinutes: mins, sourceMb: Math.round(size / 1048576), synthSec: Math.round(synthSec) };

        if (resume && mins >= 60) {
          // Interrupt after the first chunk finishes, then run again: finished chunks must be reused.
          const ctl = new AbortController();
          const watcher = setInterval(async () => {
            const files = await fs.readdir(path.dirname(file("temp", id, "x"))).catch(() => []);
            if (files.some((f) => f.startsWith(id + ".signals.visual") && /\.0\.json$/.test(f))) ctl.abort();
          }, 200);
          const stopA = await sampler();
          try { await runMomentAnalysis(await read(id), { interval: 1, count: 5 }, ctl.signal); } catch { /* expected abort */ }
          clearInterval(watcher);
          entry.interruptedRun = await stopA();
          const left = (await fs.readdir(path.dirname(file("temp", id, "x")))).filter((f) => f.startsWith(id + ".signals.")).sort();
          entry.chunkFilesAfterInterrupt = left.map((f) => f.replace(id + ".", ""));
        }

        const stop = await sampler();
        await runMomentAnalysis(await read(id), { interval: 1, count: 5 }, new AbortController().signal);
        entry.analysis = await stop();
        const res = await readJson<MomentsResult>(momentsFile(id));
        const expected = Math.floor(mins / 5) + (mins % 5 ? 1 : 0);
        const hits = res!.candidates.filter((c) => { const k = Math.round(c.peakAt / 300); return Math.abs(c.peakAt - k * 300 - 6) < 40 || Math.abs(c.peakAt - k * 300) < 40; });
        entry.candidates = res!.candidates.length;
        entry.candidatesNearKnownBursts = hits.length;
        entry.knownBursts = expected;
        entry.trackBins = res!.tracks.combined?.length;
        entry.momentsFileKb = Math.round((await fs.stat(momentsFile(id))).size / 1024);
        entry.analysisXRealtime = Math.round(((mins * 60) / (entry.analysis as { wallSec: number }).wallSec) * 10) / 10;
        results.push(entry);
        console.log(JSON.stringify(entry));
      }
    });
  } finally {
    await fs.rm(root, { recursive: true, force: true });
    const { storageBase } = await import("../lib/identity");
    await fs.rm(path.join(storageBase, "workspaces", user), { recursive: true, force: true });
  }
  console.log("MACHINE", JSON.stringify({ cpu: os.cpus()[0].model.trim(), logicalCores: os.cpus().length, ramGb: Math.round(os.totalmem() / 1073741824), platform: process.platform, node: process.version }));
}
main().catch((e) => { console.error("BENCH ERROR", e); process.exit(1); });
