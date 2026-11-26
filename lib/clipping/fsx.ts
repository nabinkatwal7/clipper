import { promises as fs } from "node:fs";

const TRANSIENT = new Set(["EPERM", "EBUSY", "EACCES"]);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * On Windows, renaming over a file that another request currently has open fails with
 * EPERM/EBUSY/EACCES. The window is milliseconds, so retry with short backoff.
 */
export async function renameRetry(from: string, to: string, attempts = 40) {
  for (let i = 0; ; i++) {
    try {
      return await fs.rename(from, to);
    } catch (e) {
      if (i >= attempts || !TRANSIENT.has((e as NodeJS.ErrnoException).code ?? "")) throw e;
      await sleep(Math.min(100, 5 + i * 5));
    }
  }
}

/** Read a file, retrying the same transient Windows errors. ENOENT is returned as null. */
export async function readRetry(file: string, attempts = 20): Promise<string | null> {
  for (let i = 0; ; i++) {
    try {
      return await fs.readFile(file, "utf8");
    } catch (e) {
      const code = (e as NodeJS.ErrnoException).code ?? "";
      if (code === "ENOENT") return null;
      if (i >= attempts || !TRANSIENT.has(code)) throw e;
      await sleep(Math.min(100, 5 + i * 5));
    }
  }
}
