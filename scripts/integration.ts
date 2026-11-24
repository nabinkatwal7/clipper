import assert from "node:assert/strict";
import { inflateRawSync } from "node:zlib";
import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import { NextRequest } from "next/server";
import { handle } from "../lib/api";
import { init, file, read } from "../lib/store";
import { busy } from "../lib/jobs";
import { run, bin } from "../lib/process";
import { defaults, type Project } from "../lib/types";
async function request(
  action: string,
  method = "GET",
  body?: unknown,
  query = "",
) {
  return handle(
    new NextRequest(`http://127.0.0.1:3000/api/${action}${query}`, {
      method,
      headers: { host: "127.0.0.1:3000", "Content-Type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
    }),
    action,
  );
}
async function wait(id: string) {
  const until = Date.now() + 90000;
  while (busy(id) && Date.now() < until)
    await new Promise((r) => setTimeout(r, 100));
  assert.equal(busy(id), false);
  const p = await read(id);
  assert.equal(p.status, "ready", p.error);
  return p;
}
async function main() {
  await init();
  const fixture = randomUUID();
  const temp = file("temp", fixture, "mp4");
  let project: Project | undefined;
  try {
    await run(bin.ffmpeg, [
      "-y",
      "-f",
      "lavfi",
      "-i",
      "testsrc2=size=640x360:rate=24:duration=3",
      "-c:v",
      "libx264",
      temp,
    ]);
    const s = {
      ...defaults,
      mode: "manual",
      captions: false,
      manualStart: 0,
      manualEnd: 2,
      resolution: "720",
    };
    const response = await handle(
      new NextRequest(
        `http://127.0.0.1:3000/api/import?settings=${encodeURIComponent(JSON.stringify(s))}`,
        {
          method: "POST",
          headers: {
            host: "127.0.0.1:3000",
            "Content-Type": "application/octet-stream",
            "X-File-Name": "API smoke.mp4",
          },
          body: await fs.readFile(temp),
        },
      ),
      "import",
    );
    assert.equal(response.status, 202, await response.clone().text());
    project = await response.json();
    project = await wait(project!.id);
    assert.equal(project.clips.length, 1);
    console.log("PASS streamed upload → queued manual generation");
    const clip = project.clips[0];
    const media = await handle(
      new NextRequest(
        `http://127.0.0.1:3000/api/download?project=${project.id}&clip=${clip.id}`,
        { headers: { host: "127.0.0.1:3000", range: "bytes=0-99" } },
      ),
      "download",
    );
    assert.equal(media.status, 206);
    assert.equal((await media.arrayBuffer()).byteLength, 100);
    const savedCaption = "A real moment worth sharing. 🎬\n#Video #Clips";
    const captionSaved = await request("caption", "POST", {
      project: project.id,
      clip: clip.id,
      caption: savedCaption,
    });
    assert.equal(captionSaved.status, 200);
    const txt = await request(
      "download",
      "GET",
      undefined,
      `?project=${project.id}&clip=${clip.id}&kind=caption`,
    );
    assert.equal(await txt.text(), savedCaption + "\n");
    assert.match(
      txt.headers.get("content-type") || "",
      /text\/plain; charset=utf-8/,
    );
    const zip = await request(
      "download",
      "GET",
      undefined,
      `?project=${project.id}&kind=zip`,
    );
    assert.equal(zip.status, 200);
    const buffer = Buffer.from(await zip.arrayBuffer());
    assert.equal(buffer.subarray(0, 2).toString(), "PK");
    function unzip(data: Buffer) {
      const files = new Map<string, Buffer>();
      const end = data.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
      let offset = data.readUInt32LE(end + 16);
      for (let n = 0; n < data.readUInt16LE(end + 10); n++) {
        const method = data.readUInt16LE(offset + 10),
          size = data.readUInt32LE(offset + 20),
          nameLength = data.readUInt16LE(offset + 28),
          extra = data.readUInt16LE(offset + 30),
          comment = data.readUInt16LE(offset + 32),
          local = data.readUInt32LE(offset + 42);
        const name = data
          .subarray(offset + 46, offset + 46 + nameLength)
          .toString();
        const start =
          local +
          30 +
          data.readUInt16LE(local + 26) +
          data.readUInt16LE(local + 28);
        const compressed = data.subarray(start, start + size);
        files.set(name, method === 0 ? compressed : inflateRawSync(compressed));
        offset += 46 + nameLength + extra + comment;
      }
      return files;
    }
    const allFiles = unzip(buffer);
    assert.equal(allFiles.size, 2);
    const txtName = [...allFiles.keys()].find((n) => n.endsWith(".txt"))!;
    assert.equal(allFiles.get(txtName)?.toString(), savedCaption + "\n");
    assert.ok(allFiles.has(txtName.replace(/\.txt$/, ".mp4")));
    const bundle = await request(
      "download",
      "GET",
      undefined,
      `?project=${project.id}&clip=${clip.id}&kind=bundle`,
    );
    const bundleFiles = unzip(Buffer.from(await bundle.arrayBuffer()));
    assert.equal(bundleFiles.get(txtName)?.toString(), savedCaption + "\n");
    assert.equal(bundleFiles.size, 2);
    console.log(
      "PASS post caption save, UTF-8 TXT, and matching MP4 + TXT in single/all ZIP downloads",
    );
    console.log("PASS MP4 range streaming and ZIP export");
    const edited = await request("edit", "POST", {
      project: project.id,
      clip: clip.id,
      start: 0.3,
      end: 1.7,
      settings: s,
      segments: [],
    });
    assert.equal(edited.status, 202, await edited.clone().text());
    project = await wait(project.id);
    assert.notEqual(project.clips[0].id, clip.id);
    assert.equal(project.clips[0].start, 0.3);
    console.log("PASS queued edit and atomic clip replacement");
    const bad = await request("generate", "POST", { project: "../secret" });
    assert.equal(bad.status, 400);
    const csrf = await handle(
      new NextRequest("http://127.0.0.1:3000/api/cleanup", {
        method: "DELETE",
        headers: { host: "127.0.0.1:3000", origin: "https://evil.example" },
      }),
      "cleanup",
    );
    assert.equal(csrf.status, 400);
    console.log("PASS path traversal and cross-origin rejection");
  } finally {
    await fs.rm(temp, { force: true });
    if (project) {
      const removed = await request(
        "cleanup",
        "DELETE",
        undefined,
        `?project=${project.id}`,
      );
      assert.equal(removed.status, 200);
      console.log("PASS project cleanup");
    }
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
