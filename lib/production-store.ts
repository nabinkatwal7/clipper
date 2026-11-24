import { importMeasurements } from "./metrics-csv";
import { promises as fs } from "node:fs";
import { randomUUID } from "node:crypto";
import { file, read } from "./store";
import {
  emptyLedger,
  metricValues,
  type Ledger,
  type Rights,
  type Review,
} from "./production";
const jobs = new Map<string, Promise<unknown>>();
export async function ledger(id: string): Promise<Ledger> {
  try {
    const d = JSON.parse(
      await fs.readFile(file("projects", id, "production.json"), "utf8"),
    );
    if (d.version !== 1) throw Error("Unsupported production schema");
    return d;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return emptyLedger();
    throw e;
  }
}
const str = (x: unknown, max: number) => {
  if (typeof x !== "string" || x.length > max)
    throw Error("Invalid text field");
  return x.trim();
};
export async function updateLedger(id: string, body: Record<string, unknown>) {
  const work = (jobs.get(id) || Promise.resolve())
    .catch(() => {})
    .then(async () => {
      const p = await read(id),
        d = await ledger(id);
      if (body.kind === "rights") {
        const r = body.value as Rights;
        if (
          !r ||
          !["unknown", "permitted", "restricted"].includes(r.permission)
        )
          throw Error("Invalid permission status");
        d.rights = {
          permission: r.permission,
          creator: str(r.creator, 200),
          license: str(r.license, 300),
          attribution: str(r.attribution, 1600),
          notes: str(r.notes, 2000),
        };
      } else if (body.kind === "analyticsCsv") {
        for (const row of importMeasurements(body.value as string)) {
          const clip = p.clips.find((c) => c.id === row.clip);
          if (!clip)
            throw Error(
              "CSV includes a clip outside this project: " + row.clip,
            );
          const key = clip.editorialId || clip.id;
          d.analytics[key] = { ...d.analytics[key], ...row.values };
        }
      } else {
        const clip = p.clips.find((c) => c.id === body.clip);
        if (!clip) throw Error("Clip not found");
        const key = clip.editorialId || clip.id;
        if (body.kind === "analytics")
          d.analytics[key] = metricValues(body.value);
        else if (body.kind === "review") {
          const r = body.value as Review;
          if (
            !r ||
            !["unreviewed", "accepted", "rejected", "changes"].includes(
              r.status,
            ) ||
            typeof r.favorite !== "boolean" ||
            (r.score !== null &&
              (!Number.isFinite(r.score) || r.score < 0 || r.score > 100))
          )
            throw Error("Invalid review");
          d.reviews[key] = {
            status: r.status,
            notes: str(r.notes, 2400),
            favorite: r.favorite,
            score: r.score,
          };
        } else throw Error("Unknown editorial operation");
      }
      const target = file("projects", id, "production.json"),
        tmp = target + "." + randomUUID() + ".tmp";
      try {
        await fs.writeFile(tmp, JSON.stringify(d));
        await fs.rename(tmp, target);
      } finally {
        await fs.rm(tmp, { force: true });
      }
      return d;
    });
  jobs.set(id, work);
  try {
    return await work;
  } finally {
    if (jobs.get(id) === work) jobs.delete(id);
  }
}
