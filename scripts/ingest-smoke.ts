import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import { generate, ingest, transcribe } from "../lib/jobs";
import { file, init, save, transcript } from "../lib/store";
import { defaults, type Project } from "../lib/types";
async function main() {
  await init();
  const id = randomUUID();
  const now = new Date().toISOString();
  const p: Project = {
    id,
    title: "Sintel trailer test",
    source: "https://media.w3.org/2010/05/sintel/trailer.mp4",
    duration: 0,
    width: 0,
    height: 0,
    status: "queued",
    stage: "test",
    detail: "test",
    createdAt: now,
    updatedAt: now,
    settings: defaults,
    clips: [],
    highlights: [],
  };
  await save(p);
  const signal = new AbortController().signal;
  try {
    await ingest(p, signal);
    assert.ok(p.duration > 30);
    console.log("PASS real URL ingestion:", p.title, p.duration);
    await transcribe(p, signal);
    const segments = await transcript(id);
    assert.ok(segments.length > 0);
    assert.ok(segments.some((s) => s.words.length > 0));
    console.log(
      "PASS real Faster Whisper transcription:",
      segments.length,
      "segments",
    );
    p.settings = {
      ...defaults,
      mode: "manual",
      manualStart: 10,
      manualEnd: 20,
      resolution: "720",
    };
    await generate(p, signal);
    assert.equal(p.clips.length, 1);
    assert.ok((await fs.stat(file("clips", p.clips[0].id, "mp4"))).size > 1000);
    console.log("PASS imported source → real word captions → vertical MP4");
  } finally {
    for (const clip of p.clips)
      await fs.rm(file("clips", clip.id, "mp4"), { force: true });
    for (const [dir, ext] of [
      ["uploads", "mp4"],
      ["uploads", "jpg"],
      ["projects", "json"],
      ["audio", "wav"],
      ["transcripts", "json"],
    ] as const)
      await fs.rm(file(dir, id, ext), { force: true });
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
