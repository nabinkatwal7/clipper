import { strict as assert } from "node:assert";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
async function main() {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "clipper-studio-qa-"));
  process.chdir(tmp);
  process.env.CLIPPER_STORAGE_DIR = path.join(tmp, "storage");
  const { handle } = await import("../lib/api"),
    { run, bin } = await import("../lib/process"),
    { busy } = await import("../lib/jobs"),
    { file, read } = await import("../lib/store");
  const { effects, gradeFilters } = await import("../lib/grading");
  for (const effect of effects) {
    const filters = gradeFilters({ effect, from: 0.1, to: 0.4 }, 128, 96);
    if (filters.length)
      await run(bin.ffmpeg, [
        "-v",
        "error",
        "-f",
        "lavfi",
        "-i",
        "testsrc2=size=128x96:rate=12:duration=0.5",
        "-vf",
        filters.join(","),
        "-f",
        "null",
        "-",
      ]);
  }
  console.log("PASS time-limited FFmpeg effects");
  const fixture = path.join(tmp, "sample.mp4");
  await run(bin.ffmpeg, [
    "-hide_banner",
    "-f",
    "lavfi",
    "-i",
    "testsrc2=size=384x216:rate=24:duration=3",
    "-f",
    "lavfi",
    "-i",
    "sine=frequency=320:duration=3",
    "-c:v",
    "libx264",
    "-c:a",
    "aac",
    "-shortest",
    fixture,
  ]);
  const req = (action: string, query: string, method = "GET", body?: any) =>
    handle(
      new NextRequest("http://127.0.0.1:4000/api/" + action + "?" + query, {
        method,
        headers: { host: "127.0.0.1:4000", "Content-Type": "application/json" },
        ...(body ? { body: JSON.stringify(body) } : {}),
      }),
      action,
    );
  const settings = {
    mode: "manual",
    resolution: "720",
    ratio: "16:9",
    captions: false,
    manualStart: 0,
    manualEnd: 2,
  };
  const result = await handle(
    new NextRequest(
      "http://127.0.0.1:4000/api/import?settings=" +
        encodeURIComponent(JSON.stringify(settings)),
      {
        method: "POST",
        headers: {
          host: "127.0.0.1:4000",
          "Content-Type": "application/octet-stream",
        },
        body: await fs.readFile(fixture),
      },
    ),
    "import",
  );
  assert.equal(result.status, 202);
  const { id } = await result.json();
  async function wait() {
    const deadline = Date.now() + 120000;
    while (busy(id) && Date.now() < deadline)
      await new Promise((r) => setTimeout(r, 80));
    const p = await read(id);
    assert.equal(p.status, "ready", p.error);
    return p;
  }
  let project = await wait(),
    clip = project.clips[0];
  const query = "project=" + id + "&clip=" + clip.id;
  for (const [act, q, mime] of [
    ["waveform", query, "image/png"],
    ["download", query + "&kind=poster", "image/jpeg"],
  ]) {
    const r = await req(act, q);
    assert.equal(
      r.status,
      200,
      await r
        .clone()
        .text()
        .then((x) => x.slice(0, 180)),
    );
    assert.equal(r.headers.get("content-type"), mime);
    assert.ok((await r.arrayBuffer()).byteLength > 150);
  }
  assert.equal((await (await req("media-info", query)).json()).fps, 24);
  assert.equal((await req("source-index", query, "POST")).status, 202);
  await wait();
  const idx = await (await req("source-index", query)).json();
  assert.equal(idx.peaks.length, 480);
  assert.ok(idx.peaks.some((v: number) => v > 0));
  console.log(
    "PASS measured waveform, poster, source frame rate and stream indexing",
  );
  const edit = await req("edit", "", "POST", {
    project: id,
    clip: clip.id,
    start: 0,
    end: 2,
    splitAt: 1,
    settings: {
      ...clip.settings,
      rotation: 8,
      opacity: 0.8,
      scale: 1.2,
      volume: 0.6,
    },
  });
  assert.equal(edit.status, 202, await edit.text());
  project = await wait();
  assert.equal(project.clips.length, 2);
  assert.equal(project.clips[0].editorialId, clip.id);
  const zip = await req(
    "export",
    project.clips.map((c) => "clip=" + c.id).join("&"),
  );
  assert.equal(zip.status, 200);
  assert.ok((await zip.arrayBuffer()).byteLength > 5000);
  console.log(
    "PASS split with transforms, preserved editorial identity and selected ZIP export",
  );
  await fs.writeFile(
    file("transcripts", id, "json"),
    JSON.stringify([{ start: 0, end: 1, text: "Hello", words: [] }]),
  );
  const body = {
    project: id,
    action: "edit",
    start: 0,
    text: "Edited",
    original: "Hello",
  };
  assert.equal((await req("transcript", "", "POST", body)).status, 200);
  assert.equal((await req("transcript", "", "POST", body)).status, 400);
  const signal = new AbortController().signal;
  const { importAsset } = await import("../lib/assets");
  const a = await importAsset(
    new Request("http://localhost/", {
      method: "POST",
      headers: { "x-file-name": "inset.mp4" },
      body: new Uint8Array(await fs.readFile(fixture)),
    }),
  );
  const { randomUUID } = await import("node:crypto");
  const track = {
    id: randomUUID(),
    name: "Inset",
    asset: a.id,
    type: "video",
    at: 0,
    length: 1,
    slip: 0,
    x: 0,
    y: 0,
    size: 0.4,
    opacity: 0.8,
    volume: 0.3,
    visible: true,
    muted: false,
    locked: false,
    solo: false,
    loop: false,
    fade: 0.1,
    keys: {
      x: [
        { time: 0, value: 0, ease: "linear" },
        { time: 0.8, value: 1, ease: "hold" },
      ],
    },
  };
  const original = project.clips[0];
  const { importCube } = await import("../lib/lut");
  const cube = await importCube(
    new Request("http://localhost/", {
      method: "POST",
      body: "LUT_3D_SIZE 2\n0 0 0\n1 0 0\n0 1 0\n1 1 0\n0 0 1\n1 0 1\n0 1 1\n1 1 1",
    }),
  );
  const variant = await req("edit", "", "POST", {
    project: id,
    clip: original.id,
    variation: true,
    title: "Inset variation",
    start: 0,
    end: 1,
    settings: {
      ...original.settings,
      cropPoints: [
        { time: 0, x: 0, y: 0.5 },
        { time: 0.8, x: 1, y: 0 },
      ],
      composition: { version: 1, tracks: [track] },
      grade: {
        lut: cube.id,
        lutIntensity: 0.7,
        effect: "sepia",
        amount: 0.5,
        from: 0,
        to: 0.8,
      },
      mix: { normalize: true, duck: true },
    },
  });
  assert.equal(variant.status, 202, await variant.text());
  project = await wait();
  assert.equal(project.clips.length, 3);
  assert.ok(project.clips.some((c) => c.id === original.id));
  const v = project.clips.find((c) => c.title === "Inset variation")!;
  assert.ok(v.qa);
  assert.equal(
    v.familyId,
    original.familyId || original.editorialId || original.id,
  );
  const { buildPackage, packageLocation } =
    await import("../lib/publishing-package");
  await buildPackage(project, [v], true, signal);
  assert.equal(
    (await fs.readFile(packageLocation(id, v.id))).subarray(0, 2).toString(),
    "PK",
  );
  const zipBytes = await fs.readFile(packageLocation(id, v.id));
  for (const name of [
    "video.mp4",
    "clean.mp4",
    "caption.txt",
    "publishing.json",
    "thumbnail.jpg",
    "subtitles.srt",
    "subtitles.vtt",
  ])
    assert.ok(zipBytes.includes(Buffer.from("/" + name)), name);
  const qa = await req("pipeline-test", "", "POST");
  assert.equal(qa.status, 200, await qa.clone().text());
  assert.equal((await qa.json()).width, 320);
  const { compilation } = await import("../lib/compilation");
  const compiled = await compilation({
    clips: [v.id, original.id],
    title: "Compilation check",
    transition: "Dissolve",
    seconds: 0.2,
    ratio: "16:9",
    normalize: true,
  });
  const until = Date.now() + 90000;
  while (busy(compiled.id) && Date.now() < until)
    await new Promise((r) => setTimeout(r, 100));
  const output = await read(compiled.id);
  assert.equal(output.status, "ready", output.error);
  assert.ok(output.clips[0].qa);
  const { snapshot, inspectBackup } = await import("../lib/backup");
  const saved = await snapshot(id, true, signal);
  const restore = await inspectBackup(saved.id, true, signal);
  assert.equal(restore.verified, saved.files);
  assert.ok(await fs.stat(path.join(restore.folder!, "uploads", id + ".mp4")));
  if (process.env.TEST_OLLAMA === "1") {
    const { localize } = await import("../lib/localization");
    const { advise } = await import("../lib/director");
    const spoken = {
      ...v,
      title: "Opening",
      postCaption: "Hello everyone",
      segments: [{ start: 0, end: 1, text: "Hello everyone", words: [] }],
    };
    const { searchContent } = await import("../lib/content-search");
    const semantic = await searchContent(
      {
        query: "greeting",
        model: "all-minilm",
        mode: "semantic",
        project: id,
        scope: "transcripts",
      },
      signal,
    );
    assert.ok(
      semantic.hits.length && Number.isFinite(semantic.hits[0].similarity),
    );
    console.log("PASS Ollama embedding search");
    const translated = await localize(id, spoken, "Spanish", signal);
    assert.equal(translated.segments.length, 1);
    assert.equal(translated.segments[0].start, 0);
    assert.ok(translated.segments[0].text.trim());
    const proposed = await advise(
      id,
      spoken,
      spoken.segments,
      3,
      "Suggest a short title based on the spoken greeting.",
      signal,
    );
    assert.ok(Array.isArray(proposed));
    console.log("PASS live Ollama translation and bounded Director request");
  }
  console.log(
    "PASS animated media layer, graded variation, original preservation, publishing ZIP, dissolve compilation, backup restore",
  );
  assert.equal((await req("cleanup", "project=" + id, "DELETE")).status, 200);
  console.log("PASS transcript edit, stale edit recovery and fixture cleanup");
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
