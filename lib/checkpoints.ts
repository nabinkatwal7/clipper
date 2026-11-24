import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { file, workspaceRoot } from "./store";
import type { Clip, Project } from "./types";
export type Checkpoint = {
  version: 1;
  id: string;
  at: string;
  name: string;
  source: string;
  family: string;
  clip: Pick<
    Clip,
    "title" | "start" | "end" | "settings" | "segments" | "postCaption"
  >;
};
export async function checkpoint(p: Project, c: Clip, name: string) {
  if (typeof name !== "string" || !name.trim() || name.length > 120)
    throw Error("Enter a checkpoint name under 120 characters");
  const id = randomUUID(),
    at = new Date().toISOString();
  const value: Checkpoint = {
    version: 1,
    id,
    at,
    name: name.trim(),
    source: p.id,
    family: c.editorialId || c.id,
    clip: {
      title: c.title,
      postCaption: c.postCaption,
      start: c.start,
      end: c.end,
      settings: c.settings,
      segments: c.segments,
    },
  };
  const dest = file("temp", p.id, id.replaceAll("-", "") + ".checkpoint.json"),
    tmp = dest + ".tmp";
  try {
    await fs.writeFile(tmp, JSON.stringify(value));
    await fs.rename(tmp, dest);
  } finally {
    await fs.rm(tmp, { force: true });
  }
  return value;
}
export async function checkpoints(p: Project, c: Clip) {
  const keys = (await fs.readdir(path.join(workspaceRoot(), "temp"))).filter(
    (n) => n.startsWith(p.id + ".") && n.endsWith(".checkpoint.json"),
  );
  const entries: Checkpoint[] = await Promise.all(
    keys.map((n) =>
      fs
        .readFile(path.join(workspaceRoot(), "temp", n), "utf8")
        .then((t) => JSON.parse(t)),
    ),
  );
  return entries
    .filter((v) => v.version === 1 && v.family === (c.editorialId || c.id))
    .sort((a, b) => b.at.localeCompare(a.at));
}
