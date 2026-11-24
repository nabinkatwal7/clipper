import test from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { selectDownload, requireDownloadedFile } from "../lib/ingestion";
test("select a smaller video when video plus audio exceeds the import budget", () => {
  const result = selectDownload(
    {
      duration: 7200,
      formats: [
        {
          format_id: "audio",
          protocol: "https",
          vcodec: "none",
          acodec: "opus",
          filesize: 300,
        },
        {
          format_id: "720",
          protocol: "https",
          height: 720,
          vcodec: "av1",
          acodec: "none",
          filesize: 600,
        },
        {
          format_id: "1080",
          protocol: "https",
          height: 1080,
          vcodec: "av1",
          acodec: "none",
          filesize: 900,
        },
      ],
    },
    1000,
  );
  assert.equal(result.format, "720+audio");
  assert.equal(result.estimatedBytes, 900);
});
test("reject unsafe protocols and formats that exceed estimated size", () => {
  assert.throws(
    () =>
      selectDownload(
        {
          duration: 100,
          formats: [
            {
              format_id: "big",
              protocol: "https",
              vcodec: "h264",
              acodec: "aac",
              tbr: 1000,
            },
          ],
        },
        1000,
      ),
    /No supported video format fits/,
  );
  assert.throws(() =>
    selectDownload(
      { formats: [{ format_id: "local", protocol: "file", vcodec: "h264" }] },
      1000,
    ),
  );
});
test("unknown HLS audio size cannot hide an oversized video", () => {
  const result = selectDownload(
    {
      formats: [
        {
          format_id: "a",
          protocol: "https",
          vcodec: "none",
          acodec: "opus",
          filesize: 100,
        },
        {
          format_id: "unknown-a",
          protocol: "m3u8_native",
          vcodec: "none",
          acodec: "aac",
        },
        {
          format_id: "small",
          protocol: "https",
          height: 480,
          vcodec: "av1",
          acodec: "none",
          filesize: 700,
        },
        {
          format_id: "large",
          protocol: "https",
          height: 1080,
          vcodec: "av1",
          acodec: "none",
          filesize: 6000,
        },
      ],
    },
    1000,
  );
  assert.equal(result.format, "small+a");
  assert.equal(result.estimatedBytes, 800);
});
test("permit unknown direct-file sizes while keeping the download guard", () => {
  assert.equal(
    selectDownload(
      {
        formats: [
          {
            format_id: "direct",
            protocol: "https",
            vcodec: "h264",
            acodec: "aac",
          },
        ],
      },
      1000,
    ).format,
    "direct",
  );
});
test("720p imports do not download 1080p even when both fit the limit", () => {
  const info = {
    formats: [
      {
        format_id: "720",
        protocol: "https",
        height: 720,
        vcodec: "h264",
        acodec: "aac",
        filesize: 100,
      },
      {
        format_id: "1080",
        protocol: "https",
        height: 1080,
        vcodec: "h264",
        acodec: "aac",
        filesize: 200,
      },
    ],
  };
  assert.equal(selectDownload(info, 1000).format, "720");
  assert.equal(selectDownload(info, 1000, 1080).format, "1080");
});
test("a zero-exit downloader with only a partial file cannot reach FFprobe", async () => {
  const dir = await fs.mkdtemp(path.join(tmpdir(), "clipper-ingest-"));
  const target = path.join(dir, "source.mp4");
  try {
    await fs.writeFile(target + ".part", "partial");
    await assert.rejects(
      requireDownloadedFile(
        target,
        2048 * 1024 * 1024,
        "File is larger than max-filesize. Aborting.",
      ),
      /Download stopped at the 2048 MB import limit/,
    );
    await assert.rejects(
      requireDownloadedFile(target, 1000, ""),
      /did not produce a complete video/,
    );
    await fs.writeFile(target, "finished");
    await requireDownloadedFile(target, 1000, "");
    await assert.rejects(requireDownloadedFile(target, 2, ""), /exceeds/);
  } finally {
    await fs.rm(target, { force: true });
    await fs.rm(target + ".part", { force: true });
    await fs.rmdir(dir);
  }
});
