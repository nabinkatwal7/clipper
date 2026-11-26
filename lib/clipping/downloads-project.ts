import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { enqueue, probe } from "../jobs";
import { importSourceSubtitles } from "../source-subtitles";
import { file, save } from "../store";
import { settings as parseSettings } from "../validation";
import type { Project } from "../types";
import { readCollection } from "./collection";
import { cacheValid, itemDir, type DownloadItem } from "./downloads";

async function linkOrCopy(from: string, to: string) {
  try {
    await fs.link(from, to);
  } catch {
    await fs.copyFile(from, to, fs.constants.COPYFILE_EXCL);
  }
}

/**
 * Turn a cached video download into a project without downloading again. Subtitle tracks that were
 * downloaded earlier for the same source are attached so the transcript step can use them.
 */
export async function downloadToProject(itemId: string): Promise<Project> {
  const rows = await readCollection<DownloadItem>("downloads");
  const item = rows.find((r) => r.id === itemId);
  if (!item || item.request.mode !== "video") throw Error("Choose a finished video download.");
  if (!(await cacheValid(item))) throw Error("The cached file is missing or changed. Download it again.");
  const media = item.files.find((f) => f.kind === "video")!;
  const id = randomUUID();
  const now = new Date().toISOString();
  await linkOrCopy(path.join(itemDir(item.id), media.name), file("uploads", id, "mp4"));
  try {
    for (const sub of rows.filter((r) => r.canonical === item.canonical && r.request.mode === "subtitles" && r.status === "done")) {
      for (const f of sub.files.filter((x) => x.kind === "subtitle")) {
        const lang = f.name.replace(/\.vtt$/i, "").split(".").pop() ?? "und";
        if (!/^[a-zA-Z0-9_-]{2,30}$/.test(lang)) continue;
        await fs.copyFile(path.join(itemDir(sub.id), f.name), path.join(path.dirname(file("uploads", id, "mp4")), `${id}.${lang}.vtt`), fs.constants.COPYFILE_EXCL).catch(() => {});
      }
    }
    const p: Project = {
      id, title: (item.inspection?.title ?? "Downloaded video").slice(0, 200), source: item.canonical, fingerprint: item.sha256,
      duration: 0, width: 0, height: 0, status: "queued", stage: "queued", detail: "Using a cached download", createdAt: now, updatedAt: now,
      settings: parseSettings({}), clips: [], highlights: [],
    };
    await save(p);
    enqueue(id, async (signal) => {
      await probe(p, signal);
      await importSourceSubtitles(id).catch(() => false);
    });
    return p;
  } catch (e) {
    await fs.rm(file("uploads", id, "mp4"), { force: true });
    throw e;
  }
}
