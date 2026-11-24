import { promises as fs } from "node:fs";
import { randomUUID } from "node:crypto";
import { run, bin } from "./process";
import { file } from "./store";
const pending = new Map<string, Promise<Uint8Array<ArrayBuffer>>>();
let queue = Promise.resolve();
export async function poster(id: string, duration: number) {
  const target = file("clips", id, "jpg");
  try {
    return new Uint8Array(await fs.readFile(target));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
  }
  const existing = pending.get(id);
  if (existing) return existing;
  const task = queue.then(async () => {
    const tmp = file("temp", randomUUID(), "jpg");
    try {
      await run(
        bin.ffmpeg,
        [
          "-loglevel",
          "error",
          "-threads",
          "1",
          "-protocol_whitelist",
          "file,pipe",
          "-ss",
          String(Math.min(1, duration / 3)),
          "-i",
          file("clips", id, "mp4"),
          "-frames:v",
          "1",
          "-vf",
          "scale=480:480:force_original_aspect_ratio=decrease",
          "-threads",
          "1",
          tmp,
        ],
        undefined,
        undefined,
        30000,
      );
      await fs.access(file("clips", id, "mp4"));
      await fs.rename(tmp, target);
      return new Uint8Array(await fs.readFile(target));
    } finally {
      await fs.rm(tmp, { force: true });
      pending.delete(id);
    }
  });
  queue = task.then(
    () => {},
    () => {},
  );
  pending.set(id, task);
  return task;
}
