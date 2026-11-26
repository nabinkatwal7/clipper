import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { workspaceRoot } from "../identity";
import { readRetry, renameRetry } from "./fsx";

/**
 * Tiny per-user JSON document store (no database). One file per collection under
 * `<workspace>/data/<name>.json`, written atomically and serialised in-process.
 */
const locks = new Map<string, Promise<unknown>>();

function target(name: string) {
  if (!/^[a-z0-9-]{1,40}$/.test(name)) throw Error("Invalid collection name");
  return path.join(workspaceRoot(), "data", name + ".json");
}

// Parsed rows keyed by file, validated by size+mtime. Readers stat() the file (no open handle),
// so they do not block a writer's rename on Windows; they only re-read after the file changed.
const cache = new Map<string, { size: number; mtimeMs: number; rows: unknown[] }>();

export async function readCollection<T extends { id: string }>(name: string): Promise<T[]> {
  const file = target(name);
  for (let attempt = 0; ; attempt++) {
    const st = await fs.stat(file).catch((e: NodeJS.ErrnoException) => {
      if (e.code === "ENOENT") return null;
      throw e;
    });
    if (!st) { cache.delete(file); return []; }
    const hit = cache.get(file);
    if (hit && hit.size === st.size && hit.mtimeMs === st.mtimeMs) return structuredClone(hit.rows) as T[];
    const text = await readRetry(file);
    if (text === null) return [];
    const v = JSON.parse(text);
    const rows = Array.isArray(v) ? v : [];
    // Only trust the cache entry if the file did not change while we were reading it.
    const after = await fs.stat(file).catch(() => null);
    if (after && after.size === st.size && after.mtimeMs === st.mtimeMs) cache.set(file, { size: st.size, mtimeMs: st.mtimeMs, rows });
    else if (attempt < 3) continue;
    return structuredClone(rows) as T[];
  }
}

/** Read-modify-write under a per-file lock so concurrent requests cannot lose updates. */
export async function mutateCollection<T extends { id: string }, R>(name: string, fn: (rows: T[]) => R | Promise<R>): Promise<R> {
  const file = target(name);
  const prev = locks.get(file) ?? Promise.resolve();
  const run = prev.catch(() => {}).then(async () => {
    const rows = await readCollection<T>(name);
    const result = await fn(rows);
    await fs.mkdir(path.dirname(file), { recursive: true });
    const tmp = file + "." + randomUUID() + ".tmp";
    try {
      await fs.writeFile(tmp, JSON.stringify(rows, null, 1));
      await renameRetry(tmp, file);
    } finally {
      await fs.rm(tmp, { force: true });
    }
    return result;
  });
  locks.set(file, run);
  return run;
}

export async function upsert<T extends { id: string }>(name: string, row: T, max = 500): Promise<T> {
  return mutateCollection<T, T>(name, (rows) => {
    const i = rows.findIndex((r) => r.id === row.id);
    if (i >= 0) rows[i] = row;
    else if (rows.length >= max) throw Error(`Limit of ${max} items reached.`);
    else rows.push(row);
    return row;
  });
}

export async function remove(name: string, id: string): Promise<boolean> {
  return mutateCollection<{ id: string }, boolean>(name, (rows) => {
    const i = rows.findIndex((r) => r.id === id);
    if (i >= 0) rows.splice(i, 1);
    return i >= 0;
  });
}
