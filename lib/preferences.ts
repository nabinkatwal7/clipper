import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { workspaceRoot } from "./store";
const buckets = [
  "collections",
  "workflows",
  "workspace",
  "history",
  "translations",
  "onboarding",
] as const;
function target(bucket: string) {
  if (!buckets.some((b) => b === bucket)) throw Error("Unknown settings group");
  return path.join(workspaceRoot(), bucket + ".json");
}
export async function preferences(
  bucket: string,
): Promise<Record<string, unknown>> {
  const t = target(bucket);
  try {
    const v = JSON.parse(await fs.readFile(t, "utf8"));
    if (v.version !== 1) throw Error("Unsupported preference version");
    return v.entries;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw e;
  }
}
const pending = new Map<string, Promise<unknown>>();
export async function preference(bucket: string, name: string, value: unknown) {
  if (
    typeof name !== "string" ||
    !name.trim() ||
    name.length > 160 ||
    ["__proto__", "prototype", "constructor"].includes(name) ||
    JSON.stringify(value ?? null).length > 300000
  )
    throw Error("Invalid preference");
  const t = target(bucket);
  const job = (pending.get(t) || Promise.resolve())
    .catch(() => {})
    .then(async () => {
      const entries = await preferences(bucket);
      if (value === null) delete entries[name];
      else entries[name] = value;
      const tmp = t + "." + randomUUID() + ".tmp";
      try {
        await fs.writeFile(tmp, JSON.stringify({ version: 1, entries }));
        await fs.rename(tmp, t);
      } finally {
        await fs.rm(tmp, { force: true });
      }
      return entries;
    });
  pending.set(t, job);
  try {
    return await job;
  } finally {
    if (pending.get(t) === job) pending.delete(t);
  }
}
