#!/usr/bin/env node
/** Exhaustive filter smoke: encode lavfi → apply filters → decode 1 frame → hash. */
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

async function resolveFfmpeg() {
  if (process.env.FFMPEG_BIN || process.env.FFMPEG_PATH)
    return process.env.FFMPEG_BIN || process.env.FFMPEG_PATH;
  try {
    const env = await fs.readFile(path.join(process.cwd(), ".env.local"), "utf8");
    const line = env.split(/\r?\n/).find((l) => l.startsWith("FFMPEG_BIN="));
    if (line) return line.slice("FFMPEG_BIN=".length).trim();
  } catch {}
  return "ffmpeg";
}
const root = path.join(tmpdir(), "clipper-pixel-diff");

function run(bin, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });
    let err = "";
    child.stderr.on("data", (d) => (err += d));
    child.on("close", (code) =>
      code === 0 ? resolve() : reject(Error(err.slice(-400) || "ffmpeg failed")),
    );
  });
}

async function frameHash(bin, filter) {
  const out = path.join(
    root,
    createHash("md5").update(filter).digest("hex") + ".png",
  );
  await run(bin, [
    "-y",
    "-f",
    "lavfi",
    "-i",
    "testsrc2=size=160x90:rate=24",
    "-f",
    "lavfi",
    "-i",
    "sine=frequency=440",
    "-t",
    "0.5",
    "-filter_complex",
    `[0:v]${filter},format=rgb24[v]`,
    "-map",
    "[v]",
    "-frames:v",
    "1",
    out,
  ]);
  const buf = await fs.readFile(out);
  return createHash("sha256").update(buf).digest("hex");
}

async function main() {
  const ffmpeg = await resolveFfmpeg();
  console.log("using", ffmpeg);
  // Avoid `reverse` here — it buffers the whole stream and hangs on lavfi generators.
  const cases = [
    ["null", "null"],
    ["blur", "gblur=sigma=2"],
    ["vignette", "vignette=angle=0.4"],
    ["colorkey", "colorkey=0x00FF00:0.3:0.1"],
    ["drawtext", "drawtext=text='QA':fontsize=24:fontcolor=white:x=10:y=10"],
    ["fade", "fade=t=in:st=0:d=0.2"],
    ["eq", "eq=contrast=1.2:saturation=1.1"],
  ];
  await fs.mkdir(root, { recursive: true });
  const report = [];
  for (const [name, filter] of cases) {
    const a = await frameHash(ffmpeg, filter);
    const b = await frameHash(ffmpeg, filter);
    if (a !== b) throw Error("Unstable hash for " + name);
    if (!a || a.length !== 64) throw Error("Bad hash for " + name);
    report.push({ name, hash: a.slice(0, 12) });
    console.log("ok", name, a.slice(0, 12));
  }
  await fs.writeFile(
    path.join(root, "report.json"),
    JSON.stringify(report, null, 2),
  );
  console.log("pixel-diff passed", report.length, "filters");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
