import { createHash, randomUUID } from "node:crypto";
import { createReadStream, promises as fs } from "node:fs";
import path from "node:path";
import { dirs, list, root } from "./store";
import { validId } from "./validation";
import { busy } from "./jobs";
type Entry = { path: string; bytes: number; sha256: string };
type Manifest = {
  schemaVersion: 1;
  id: string;
  created: string;
  projects: string[];
  media: boolean;
  files: Entry[];
  requirements: string[];
};
const backups = () => path.join(root, "backups");
async function hash(f: string) {
  const h = createHash("sha256");
  for await (const chunk of createReadStream(f)) h.update(chunk);
  return h.digest("hex");
}
const settingsFiles = [
  "collections.json",
  "workflows.json",
  "workspace.json",
  "onboarding.json",
  "translations.json",
  "history.json",
];
function safeName(name: string) {
  return (
    settingsFiles.includes(name) ||
    /^(uploads|clips|transcripts|projects|assets|temp)\/[a-f0-9-]{36}(?:\.[a-zA-Z0-9_-]+)+$/.test(
      name,
    )
  );
}
async function plain(base: string, rel: string) {
  if (!safeName(rel)) throw Error("Invalid backup path");
  const target = path.join(base, rel),
    real = await fs.realpath(target),
    baseReal = await fs.realpath(base);
  if (
    !real.startsWith(baseReal + path.sep) ||
    !(await fs.lstat(target)).isFile()
  )
    throw Error("Backup contains an invalid file");
  return target;
}
export async function backupList() {
  await fs.mkdir(backups(), { recursive: true });
  const result = [];
  for (const id of await fs.readdir(backups())) {
    if (!/^[a-f0-9-]{36}$/.test(id)) continue;
    const m = await manifest(id);
    result.push({
      id,
      created: m.created,
      media: m.media,
      projects: m.projects.length,
      bytes: m.files.reduce((a, f) => a + f.bytes, 0),
    });
  }
  return result.sort((a, b) => b.created.localeCompare(a.created));
}
async function manifest(id: string): Promise<Manifest> {
  validId(id);
  const m = JSON.parse(
    await fs.readFile(path.join(backups(), id, "manifest.json"), "utf8"),
  );
  if (
    m.schemaVersion !== 1 ||
    m.id !== id ||
    !Array.isArray(m.files) ||
    m.files.length > 100000 ||
    m.files.some(
      (e: Entry) =>
        !safeName(e.path) ||
        !Number.isSafeInteger(e.bytes) ||
        e.bytes < 0 ||
        !/^\w{64}$/.test(e.sha256),
    )
  )
    throw Error("Invalid backup manifest");
  return m;
}
export async function snapshot(
  project: string | undefined,
  media: boolean,
  signal: AbortSignal,
) {
  if (project) validId(project);
  const projects = (await list()).filter((p) => !project || p.id === project);
  if (project && !projects.length) throw Error("Missing project");
  if (projects.some((p) => busy(p.id)))
    throw Error(
      "Wait until selected jobs have finished before taking a snapshot.",
    );
  const ids = new Set(projects.map((p) => p.id)),
    clips = new Set(projects.flatMap((p) => p.clips.map((c) => c.id))),
    assets = new Set(
      projects.flatMap((p) =>
        p.clips.flatMap((c) =>
          (c.settings.composition?.tracks || []).map((t) => t.asset),
        ),
      ),
    );
  const files: string[] = [];
  for (const dir of dirs) {
    if (dir === "audio") continue;
    for (const e of await fs.readdir(path.join(root, dir), {
      withFileTypes: true,
    })) {
      const rel = dir + "/" + e.name,
        id = e.name.slice(0, 36);
      if (!e.isFile() || !safeName(rel)) continue;
      if (
        dir === "temp" &&
        !/(checkpoint\.json|index\.json|chat\.json)$/.test(e.name)
      )
        continue;
      if (
        project &&
        !(dir === "clips"
          ? clips.has(id)
          : dir === "assets"
            ? assets.has(id)
            : ids.has(id))
      )
        continue;
      if (
        !media &&
        (["uploads", "clips"].includes(dir) ||
          (dir === "assets" && !e.name.endsWith(".json")))
      )
        continue;
      files.push(rel);
    }
  }
  if (!project)
    for (const f of settingsFiles) {
      if (await fs.stat(path.join(root, f)).catch(() => null)) files.push(f);
    }
  const id = randomUUID(),
    dest = path.join(backups(), id),
    stage = dest + ".partial";
  await fs.mkdir(stage, { recursive: true });
  const m: Manifest = {
    schemaVersion: 1,
    id,
    created: new Date().toISOString(),
    projects: [...ids],
    media,
    files: [],
    requirements: [
      "Node.js and Clipper Studio",
      "FFmpeg and FFprobe",
      "yt-dlp for URL imports",
      "Local Ollama model(s): " +
        [
          ...new Set(
            projects.map(
              (p) =>
                p.settings.model || process.env.OLLAMA_MODEL || "qwen2.5:3b",
            ),
          ),
        ].join(", "),
      "Faster Whisper for speech transcription",
    ],
  };
  for (const rel of files) {
    signal.throwIfAborted();
    const src = await plain(root, rel),
      dst = path.join(stage, rel);
    await fs.mkdir(path.dirname(dst), { recursive: true });
    await fs.copyFile(src, dst);
    m.files.push({
      path: rel,
      bytes: (await fs.stat(dst)).size,
      sha256: await hash(dst),
    });
  }
  await fs.writeFile(
    path.join(stage, "manifest.json"),
    JSON.stringify(m, null, 2),
  );
  await fs.rename(stage, dest);
  return { id, files: m.files.length, folder: dest };
}
export async function inspectBackup(
  id: string,
  restore: boolean,
  signal: AbortSignal,
) {
  const m = await manifest(id);
  const src = path.join(backups(), id);
  const dest = path.join(root, "restored", randomUUID());
  const stage = dest + ".partial";
  for (const e of m.files) {
    signal.throwIfAborted();
    const f = await plain(src, e.path);
    if ((await fs.stat(f)).size !== e.bytes || (await hash(f)) !== e.sha256)
      throw Error("Backup checksum failed for " + e.path);
    if (restore) {
      const to = path.join(stage, e.path);
      await fs.mkdir(path.dirname(to), { recursive: true });
      await fs.copyFile(f, to);
      if ((await hash(to)) !== e.sha256)
        throw Error("Restored file failed verification");
    }
  }
  if (restore) {
    await fs.mkdir(stage, { recursive: true });
    await fs.rename(stage, dest);
  }
  return {
    verified: m.files.length,
    media: m.media,
    folder: restore ? dest : undefined,
  };
}
