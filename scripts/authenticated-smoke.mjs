import { strict as assert } from "node:assert";
import { studioClient } from "./studio-client.mjs";
import { readFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";

const client = await studioClient();
try {
  const jobs = await client.request("/api/progress");
  assert.equal(jobs.status, 200);
  assert.ok(Array.isArray(await jobs.json()));
  const status = await client.request("/api/health");
  assert.equal(status.status, 200);
  assert.ok(Array.isArray(await status.json()));
  console.log("Authenticated job listing and dependency checks passed.");
  if (process.env.CLIPPER_SMOKE_VIDEO) {
    const settings = encodeURIComponent(
      JSON.stringify({
        mode: "manual",
        manualStart: 0,
        manualEnd: 4,
        captions: true,
        resolution: "720",
      }),
    );
    const response = await client.request("/api/import?settings=" + settings, {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
        "X-File-Name": "Speech smoke test",
      },
      body: await readFile(process.env.CLIPPER_SMOKE_VIDEO),
    });
    assert.equal(response.status, 202, await response.clone().text());
    const { id } = await response.json();
    const next = "/api/progress?project=" + id;
    const deadline = Date.now() + 120_000;
    let project;
    do {
      const reply = await client.request(next);
      assert.equal(reply.status, 200);
      project = await reply.json();
      if (["ready", "error", "cancelled"].includes(project.status)) break;
      await delay(300);
    } while (Date.now() < deadline);
    assert.equal(project.status, "ready", project.error);
    const captions = await client.request("/api/transcript?project=" + id);
    assert.equal(captions.status, 200);
    const rows = await captions.json();
    assert.ok(
      rows.some((row) => /country/i.test(row.text) && row.end > row.start),
      "Expected timed speech from the JFK fixture.",
    );
    assert.ok(
      project.clips[0]?.segments?.length,
      "Expected recognized captions on the rendered clip.",
    );
    const media = await client.request(
      "/api/download?kind=source&project=" + id,
      { headers: { range: "bytes=0-63" } },
    );
    assert.equal(media.status, 206);
    assert.equal((await media.arrayBuffer()).byteLength, 64);
    console.log(
      "Authenticated upload, speech recognition, render, and byte-range delivery passed.",
    );
  }
} finally {
  await client.close().catch(() => {});
}
