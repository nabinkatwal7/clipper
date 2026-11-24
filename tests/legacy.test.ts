import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const id = "11111111-1111-4111-8111-111111111111";
test("claiming moves legacy data into the owner workspace with a backup and runs once", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "clipper-legacy-"));
  process.env.CLIPPER_STORAGE_DIR = dir;
  for (const d of ["projects", "clips"]) await mkdir(path.join(dir, d));
  await writeFile(path.join(dir, "projects", id + ".json"), '{"id":"x"}');
  await writeFile(path.join(dir, "clips", id + ".mp4"), "video");
  const { claimLegacy, legacyStatus } = await import("../lib/legacy");
  assert.deepEqual(await legacyStatus(), { available: true, claimed: false, projects: 1, files: 2 });
  const owner = "22222222-2222-4222-8222-222222222222";
  const r = await claimLegacy(owner);
  assert.equal(r.moved, 2);
  assert.equal(await readFile(path.join(dir, "workspaces", owner, "clips", id + ".mp4"), "utf8"), "video");
  assert.equal(await readFile(path.join(dir, r.backup, "projects", id + ".json"), "utf8"), '{"id":"x"}');
  assert.deepEqual(await readdir(path.join(dir, "projects")), []);
  const s = await legacyStatus();
  assert.equal(s.available, false);
  assert.equal(s.claimed, true);
  await assert.rejects(claimLegacy(owner), /no legacy data/);
});
