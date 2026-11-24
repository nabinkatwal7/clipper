import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { validId } from "./validation";
import type { Project, Segment } from "./types";
export const root = path.join(process.cwd(), "storage");
export const dirs = [
  "uploads",
  "assets",
  "audio",
  "transcripts",
  "projects",
  "clips",
  "temp",
] as const;
export async function init() {
  await Promise.all(
    dirs.map((d) => fs.mkdir(path.join(root, d), { recursive: true })),
  );
}
export function file(dir: (typeof dirs)[number], id: string, ext: string) {
  validId(id);
  if (!/^[a-z0-9.]+$/.test(ext)) throw Error("Invalid extension");
  return path.join(root, dir, `${id}.${ext}`);
}
const storeState = globalThis as unknown as {
  clipWrites?: Map<string, Promise<void>>;
};
const writes = (storeState.clipWrites ??= new Map());
export async function save(p: Project) {
  p.updatedAt = new Date().toISOString();
  const target = file("projects", p.id, "json");
  const snapshot = JSON.stringify(p, null, 2);
  const previous = writes.get(p.id) || Promise.resolve();
  const write = previous
    .catch(() => {})
    .then(async () => {
      const temporary = target + "." + randomUUID() + ".tmp";
      try {
        await fs.writeFile(temporary, snapshot);
        for (let attempt = 0; ; attempt++) {
          try {
            await fs.rename(temporary, target);
            break;
          } catch (error) {
            if (
              attempt >= 12 ||
              !["EPERM", "EBUSY", "EACCES"].includes(
                (error as NodeJS.ErrnoException).code || "",
              )
            )
              throw error;
            await new Promise((resolve) =>
              setTimeout(resolve, Math.min(200, 20 * 2 ** attempt)),
            );
          }
        }
      } finally {
        await fs.rm(temporary, { force: true }).catch(() => {});
      }
    });
  writes.set(p.id, write);
  try {
    await write;
  } finally {
    if (writes.get(p.id) === write) writes.delete(p.id);
  }
}
export async function read(id: string): Promise<Project> {
  return JSON.parse(await fs.readFile(file("projects", id, "json"), "utf8"));
}
export async function list() {
  await init();
  const names = await fs.readdir(path.join(root, "projects"));
  const values = await Promise.all(
    names
      .filter((n) => n.endsWith(".json"))
      .map(async (n) => {
        try {
          return await read(n.slice(0, -5));
        } catch {
          return null;
        }
      }),
  );
  return values
    .filter((p): p is Project => !!p)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
export async function transcript(id: string): Promise<Segment[]> {
  return JSON.parse(await fs.readFile(file("transcripts", id, "json"), "utf8"));
}
