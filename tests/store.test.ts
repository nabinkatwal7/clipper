import test from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import { randomUUID } from "node:crypto";
import { init, save, read, file } from "../lib/store";
import { defaults, type Project } from "../lib/types";
function project(): Project {
  const now = new Date().toISOString();
  return {
    id: randomUUID(),
    title: "Atomic save test",
    duration: 1,
    width: 1,
    height: 1,
    status: "processing",
    stage: "transcribing",
    detail: "test",
    settings: defaults,
    clips: [],
    highlights: [],
    createdAt: now,
    updatedAt: now,
  };
}
test("concurrent progress writes and polling keep metadata valid and preserve the latest update", async () => {
  await init();
  const p = project();
  try {
    await save(p);
    const pending = [];
    for (let i = 0; i < 40; i++) {
      p.detail = `Update ${i}`;
      pending.push(save(p));
      pending.push(read(p.id).then((value) => assert.equal(value.id, p.id)));
    }
    await Promise.all(pending);
    assert.equal((await read(p.id)).detail, "Update 39");
  } finally {
    await fs.rm(file("projects", p.id, "json"), { force: true });
  }
});
test("transient Windows rename failures are retried rather than freezing metadata", async (context) => {
  await init();
  const p = project();
  const rename = fs.rename.bind(fs);
  let calls = 0;
  const mocked = context.mock.method(
    fs,
    "rename",
    async (
      from: Parameters<typeof fs.rename>[0],
      to: Parameters<typeof fs.rename>[1],
    ) => {
      if (++calls <= 2)
        throw Object.assign(Error("File is temporarily open"), {
          code: "EPERM",
        });
      await rename(from, to);
    },
  );
  try {
    await save(p);
    assert.ok(calls >= 3);
    assert.equal((await read(p.id)).id, p.id);
  } finally {
    mocked.mock.restore();
    await fs.rm(file("projects", p.id, "json"), { force: true });
  }
});
