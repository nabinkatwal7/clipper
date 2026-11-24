import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { storageBase } from "./identity";
import { audit } from "./auth";

/**
 * Legacy (pre-authentication) data lives directly under storageBase. Claiming moves it into the
 * owner's workspace. Files are renamed, never deleted, so no media is copied or lost; a journal
 * records every move and a copy of the small metadata files is written to backups/ first.
 */
const dataDirs = ["uploads", "assets", "audio", "transcripts", "projects", "clips"] as const;
const settingsFiles = [
  "browser-settings.json", "collections.json", "workflows.json", "workspace.json",
  "onboarding.json", "translations.json", "history.json",
];
const marker = path.join(storageBase, "auth", "legacy-claim.json");
const state = globalThis as typeof globalThis & { legacyClaim?: Promise<unknown> };

async function entries(dir: string) {
  try {
    return (await fs.readdir(path.join(storageBase, dir), { withFileTypes: true })).filter((e) => e.isFile()).map((e) => e.name);
  } catch {
    return [];
  }
}
export async function legacyStatus() {
  const claimed = await fs.stat(marker).then(() => true, () => false);
  const projects = await entries("projects");
  let files = 0;
  for (const d of dataDirs) files += (await entries(d)).length;
  for (const f of settingsFiles) if (await fs.stat(path.join(storageBase, f)).then(() => true, () => false)) files++;
  return { available: files > 0, claimed, projects: projects.filter((n) => n.endsWith(".json")).length, files };
}
export async function claimLegacy(ownerId: string) {
  const run = (state.legacyClaim || Promise.resolve()).catch(() => {}).then(async () => {
    const before = await legacyStatus();
    if (!before.available) throw Error("There is no legacy data to claim.");
    const { busy } = await import("./jobs");
    for (const n of await entries("projects")) if (busy(n.replace(/\.json$/, ""))) throw Error("Wait for running jobs to finish before claiming.");
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backup = path.join(storageBase, "backups", "legacy-" + stamp);
    await fs.mkdir(backup, { recursive: true, mode: 0o700 });
    for (const sub of ["projects", "transcripts"]) {
      await fs.mkdir(path.join(backup, sub), { recursive: true });
      for (const n of await entries(sub)) await fs.copyFile(path.join(storageBase, sub, n), path.join(backup, sub, n));
    }
    for (const f of settingsFiles) await fs.copyFile(path.join(storageBase, f), path.join(backup, f)).catch(() => {});
    const dest = path.join(storageBase, "workspaces", ownerId);
    const moves: [string, string][] = [];
    const move = async (rel: string) => {
      const to = path.join(dest, rel);
      await fs.mkdir(path.dirname(to), { recursive: true, mode: 0o700 });
      if (await fs.stat(to).then(() => true, () => false)) return; // never overwrite owner data
      await fs.rename(path.join(storageBase, rel), to);
      moves.push([rel, path.relative(storageBase, to)]);
    };
    for (const d of dataDirs) for (const n of await entries(d)) await move(path.join(d, n));
    for (const f of settingsFiles) if (await fs.stat(path.join(storageBase, f)).then(() => true, () => false)) await move(f);
    const journal = { version: 1, id: randomUUID(), owner: ownerId, at: new Date().toISOString(), backup: path.relative(storageBase, backup), moves };
    await fs.mkdir(path.dirname(marker), { recursive: true, mode: 0o700 });
    const tmp = marker + "." + randomUUID() + ".tmp";
    await fs.writeFile(tmp, JSON.stringify(journal, null, 2), { mode: 0o600 });
    await fs.rename(tmp, marker);
    await audit("legacy.claimed", ownerId);
    return { moved: moves.length, backup: journal.backup };
  });
  state.legacyClaim = run;
  return run;
}
