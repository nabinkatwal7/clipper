import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import assert from "node:assert/strict";
import { init, file } from "../lib/store";
import { run, bin } from "../lib/process";
import { render, probe } from "../lib/jobs";
import { defaults, type Project, type Settings } from "../lib/types";
async function main() {
  await init();
  const id = randomUUID();
  const now = new Date().toISOString();
  const p: Project = {
    id,
    title: "Synthetic smoke test",
    duration: 3,
    width: 640,
    height: 360,
    status: "processing",
    stage: "testing",
    detail: "test",
    createdAt: now,
    updatedAt: now,
    settings: defaults,
    clips: [],
    highlights: [],
  };
  const signal = new AbortController().signal;
  const files: string[] = [
    file("uploads", id, "mp4"),
    file("uploads", id, "jpg"),
    file("projects", id, "json"),
  ];
  try {
    await run(bin.ffmpeg, [
      "-y",
      "-f",
      "lavfi",
      "-i",
      "testsrc2=size=640x360:rate=24:duration=3",
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=440:duration=3",
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-shortest",
      file("uploads", id, "mp4"),
    ]);
    await probe(p, signal);
    assert.ok(p.duration >= 2.9);
    for (const [layout, style, ratio] of [
      ["center", "minimal", "9:16"],
      ["blur", "bold", "1:1"],
      ["crop", "highlight", "4:5"],
      ["facecam", "bold", "9:16"],
      ["original", "minimal", "16:9"],
    ] as [Settings["layout"], Settings["style"], Settings["ratio"]][]) {
      const s = {
        ...defaults,
        resolution: "720" as const,
        layout,
        style,
        ratio,
        crop: 70,
      };
      const c = await render(
        p,
        { start: 0.2, end: 2.8, title: "Smoke", reason: "test", score: null },
        s,
        [
          {
            start: 0.2,
            end: 2.8,
            text: "Real caption test",
            words: [
              { start: 0.2, end: 1, word: "Real" },
              { start: 1, end: 1.8, word: "caption" },
              { start: 1.8, end: 2.8, word: "test" },
            ],
          },
        ],
        signal,
      );
      files.push(file("clips", c.id, "mp4"));
      const meta = JSON.parse(
        await run(bin.ffprobe, [
          "-v",
          "error",
          "-show_streams",
          "-show_format",
          "-of",
          "json",
          file("clips", c.id, "mp4"),
        ]),
      );
      assert.ok(Number(meta.format.duration) > 2);
      assert.ok(
        meta.streams.some(
          (x: { codec_type: string }) => x.codec_type === "audio",
        ),
      );
      console.log(
        `PASS ${layout} / ${style} / ${ratio}: ${meta.streams[0].width}x${meta.streams[0].height}`,
      );
    }
  } finally {
    await Promise.all(files.map((f) => fs.rm(f, { force: true })));
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
