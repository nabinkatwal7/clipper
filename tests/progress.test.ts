import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import {
  beginProgress,
  completeProgress,
  reporter,
  ffmpegSeconds,
} from "../lib/progress";
import { init, file, read } from "../lib/store";
import { defaults, type Project } from "../lib/types";
import { readOllamaResponse } from "../lib/ollama";
test("measured progress is monotonic, bounded, persisted, and completes at the actual total", async () => {
  await init();
  const id = randomUUID(),
    now = new Date().toISOString();
  const p: Project = {
    id,
    title: "Progress test",
    duration: 120,
    width: 640,
    height: 360,
    status: "processing",
    stage: "transcribing",
    detail: "test",
    settings: defaults,
    clips: [],
    highlights: [],
    createdAt: now,
    updatedAt: now,
  };
  try {
    beginProgress(p, "transcribing", "test", 120, "seconds");
    const progress = reporter(p, "transcribing");
    progress.update(30, 120, "seconds", "Window complete");
    progress.update(25, 120, "seconds", "Overlapping window");
    await progress.flush();
    assert.equal((await read(id)).progress?.transcribing?.current, 30);
    progress.update(200, 120, "seconds", "Finished");
    await progress.flush();
    assert.equal(p.progress?.transcribing?.current, 120);
    completeProgress(p, "transcribing");
    assert.equal(p.progress?.transcribing?.state, "complete");
    assert.equal(ffmpegSeconds("out_time_us=2500000"), 2.5);
    assert.equal(ffmpegSeconds("not progress"), undefined);
  } finally {
    await fs.rm(file("projects", id, "json"), { force: true });
  }
});
test("Ollama streamed JSON is reassembled across byte boundaries and reports real output activity", async () => {
  const events = [
    JSON.stringify({ response: '{"cli' }),
    JSON.stringify({ response: 'ps":[]}' }),
    JSON.stringify({ done: true }),
  ].join("\n");
  const encoded = new TextEncoder().encode(events);
  const chunks = [
    encoded.slice(0, 11),
    encoded.slice(11, 32),
    encoded.slice(32),
  ];
  const counts: number[] = [];
  const stream = new ReadableStream({
    pull(controller) {
      const chunk = chunks.shift();
      if (chunk) controller.enqueue(chunk);
      else controller.close();
    },
  });
  const output = await readOllamaResponse(new Response(stream), (n) =>
    counts.push(n),
  );
  assert.deepEqual(JSON.parse(output), { clips: [] });
  assert.ok(counts.length >= 2);
  assert.equal(counts.at(-1), output.length);
});
test("Ollama interruption and server errors never become fabricated analysis results", async () => {
  await assert.rejects(
    readOllamaResponse(new Response('{"response":"partial"}\n'), () => {}),
    /stopped before completing/,
  );
  await assert.rejects(
    readOllamaResponse(new Response('{"error":"out of memory"}\n'), () => {}),
    /out of memory/,
  );
});
