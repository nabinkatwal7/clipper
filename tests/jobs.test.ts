import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import { enqueue, cancel, busy } from "../lib/jobs";
import { init, save, read, file } from "../lib/store";
import { run } from "../lib/process";
import { defaults, type Project } from "../lib/types";
test("worker limits concurrency and cancellation stops the active subprocess", async () => {
  await init();
  const ids = [randomUUID(), randomUUID()];
  const now = new Date().toISOString();
  for (const id of ids)
    await save({
      id,
      title: "Queue test",
      duration: 1,
      width: 1,
      height: 1,
      status: "queued",
      stage: "test",
      detail: "test",
      settings: defaults,
      clips: [],
      highlights: [],
      createdAt: now,
      updatedAt: now,
    } satisfies Project);
  let secondStarted = false;
  try {
    enqueue(ids[0], (signal) =>
      run(process.execPath, ["-e", "setTimeout(()=>{},30000)"], signal).then(
        () => {},
      ),
    );
    enqueue(ids[1], async () => {
      secondStarted = true;
      const p = await read(ids[1]);
      p.status = "ready";
      await save(p);
    });
    await new Promise((r) => setTimeout(r, 150));
    assert.equal(secondStarted, false);
    assert.equal(cancel(ids[0]), true);
    const until = Date.now() + 6000;
    while ((busy(ids[0]) || busy(ids[1])) && Date.now() < until)
      await new Promise((r) => setTimeout(r, 50));
    assert.equal(busy(ids[0]), false);
    assert.equal(secondStarted, true);
    assert.equal((await read(ids[0])).status, "cancelled");
  } finally {
    ids.forEach(cancel);
    await Promise.all(
      ids.map((id) => fs.rm(file("projects", id, "json"), { force: true })),
    );
  }
});
