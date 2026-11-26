import { createHash, randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { Settings } from "./types";
import { file, workspaceRoot } from "./store";

const LIMIT = 24;

export function previewKey(
  project: string,
  clip: string,
  start: number,
  end: number,
  offset: number,
  duration: number,
  settings: Settings,
  fingerprints: string[],
) {
  return createHash("sha256")
    .update(
      JSON.stringify([
        "preview-v1",
        project,
        clip,
        start,
        end,
        offset,
        duration,
        settings,
        fingerprints,
      ]),
    )
    .digest("hex");
}

export function previewPath(project: string, key: string) {
  if (!/^[a-f0-9]{64}$/.test(key)) throw Error("Invalid preview cache key");
  return file("temp", project, key + ".mp4");
}

export async function readPreview(project: string, key: string) {
  try {
    const target = previewPath(project, key);
    const data = await fs.readFile(target);
    await fs.utimes(target, new Date(), new Date()).catch(() => {});
    return data;
  } catch {
    return null;
  }
}

export async function writePreview(
  project: string,
  key: string,
  source: string,
) {
  const target = previewPath(project, key);
  const temporary = target + "." + randomUUID() + ".tmp";
  try {
    await fs.copyFile(source, temporary);
    await fs.rename(temporary, target);
  } finally {
    await fs.rm(temporary, { force: true });
  }
  await prunePreviews(project);
}

async function prunePreviews(project: string) {
  const dir = path.join(workspaceRoot(), "temp");
  const prefix = project + ".";
  const suffix = ".mp4";
  const names = (await fs.readdir(dir).catch(() => [] as string[])).filter(
    (name) =>
      name.startsWith(prefix) &&
      name.endsWith(suffix) &&
      /^[a-f0-9]{64}\.mp4$/.test(name.slice(prefix.length)),
  );
  if (names.length <= LIMIT) return;
  const ranked = await Promise.all(
    names.map(async (name) => ({
      name,
      mtime: (await fs.stat(path.join(dir, name))).mtimeMs,
    })),
  );
  ranked.sort((a, b) => a.mtime - b.mtime);
  await Promise.all(
    ranked
      .slice(0, ranked.length - LIMIT)
      .map((entry) => fs.rm(path.join(dir, entry.name), { force: true })),
  );
}
