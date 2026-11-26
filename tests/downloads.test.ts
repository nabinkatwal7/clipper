import test from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import { canonicalUrl, cacheKey, describeInfo, buildArgs, storageCheck, parseProgressLine, isPartial, estimateBytes, RequestSchema } from "../lib/clipping/downloads-core";
import { requestDownload, cancelDownload, retryDownload, listDownloads, cleanPartials, removeDownload, itemDir, type Deps, type DownloadItem } from "../lib/clipping/downloads";
import { readCollection, mutateCollection } from "../lib/clipping/collection";
import { workspaceScope, storageBase } from "../lib/identity";

const INFO = {
  title: "Big Match", channel: "Chan", uploader: "Chan", extractor_key: "Youtube", webpage_url: "https://www.youtube.com/watch?v=abc123def45",
  thumbnail: "https://i.ytimg.com/vi/abc/hq.jpg", duration: 600, upload_date: "20261120", language: "ne", availability: "public",
  chapters: [{ title: "Start", start_time: 0, end_time: 300 }, { title: "Finale", start_time: 300, end_time: 600 }],
  subtitles: { en: [{ ext: "vtt" }], ne: [{ ext: "vtt" }], live_chat: [{ ext: "json" }] }, automatic_captions: { hi: [{ ext: "vtt" }] },
  heatmap: [{ start_time: 0, end_time: 6, value: 1 }],
  formats: [
    { format_id: "139", protocol: "https", vcodec: "none", acodec: "mp4a", abr: 48, language: "ne", filesize: 2_000_000 },
    { format_id: "140", protocol: "https", vcodec: "none", acodec: "mp4a", abr: 128, language: "ne", filesize: 9_000_000 },
    { format_id: "135", protocol: "https", vcodec: "avc1", acodec: "none", height: 480, filesize: 40_000_000 },
    { format_id: "136", protocol: "https", vcodec: "avc1", acodec: "none", height: 720, filesize: 90_000_000 },
    { format_id: "137", protocol: "https", vcodec: "avc1", acodec: "none", height: 1080, filesize: 200_000_000 },
    { format_id: "evil;rm", protocol: "https", vcodec: "avc1", acodec: "none", height: 360, filesize: 1000 },
  ],
};

test("canonical URLs and cache keys ignore tracking and URL spelling but not what is requested", () => {
  const a = canonicalUrl("https://youtu.be/abc123def45?si=xyz");
  assert.equal(a, "https://www.youtube.com/watch?v=abc123def45");
  assert.equal(canonicalUrl("https://m.youtube.com/watch?v=abc123def45&utm_source=x&feature=share"), a);
  assert.equal(canonicalUrl("https://www.twitch.tv/videos/123?filter=archives"), "https://www.twitch.tv/videos/123");
  assert.equal(canonicalUrl("https://e.com/v.mp4?b=2&a=1&utm_x=3#frag"), "https://e.com/v.mp4?a=1&b=2");
  const r = (o: object) => RequestSchema.parse({ url: "https://youtu.be/abc123def45", ...o });
  assert.equal(cacheKey(r({})), cacheKey(RequestSchema.parse({ url: "https://www.youtube.com/watch?v=abc123def45" })));
  assert.notEqual(cacheKey(r({})), cacheKey(r({ maxHeight: 1080 })));
  assert.notEqual(cacheKey(r({})), cacheKey(r({ mode: "audio" })));
  assert.notEqual(cacheKey(r({})), cacheKey(r({ section: { start: 10, end: 60 } })));
  assert.equal(cacheKey(r({ mode: "subtitles", subtitleLangs: ["en", "ne"] })), cacheKey(r({ mode: "subtitles", subtitleLangs: ["ne", "en"] })));
  assert.throws(() => RequestSchema.parse({ url: "https://e.com/x", section: { start: 50, end: 10 } }));
  assert.throws(() => RequestSchema.parse({ url: "https://e.com/x", subtitleLangs: ["en; rm -rf"] }));
});

test("inspection reports only what the source metadata says, including capabilities and tracks", () => {
  const d = describeInfo(INFO as never, "https://www.youtube.com/watch?v=abc123def45");
  assert.equal(d.creator, "Chan");
  assert.equal(d.uploadDate, "2026-11-20");
  assert.equal(d.sourceLanguage, "ne");
  assert.deepEqual(d.resolutions.map((r) => r.height), [360, 480, 720, 1080]);
  assert.equal(d.resolutions.find((r) => r.height === 720)?.estimatedBytes, 90_000_000);
  assert.deepEqual(d.subtitleTracks, [{ lang: "en", kind: "manual" }, { lang: "ne", kind: "manual" }, { lang: "hi", kind: "automatic" }]);
  assert.equal(d.capabilities.liveChat, true);
  assert.equal(d.capabilities.replayHeatmap, true);
  assert.equal(d.capabilities.sections, true);
  assert.equal(d.chapters.length, 2);
  assert.equal(d.thumbnail, "https://i.ytimg.com/vi/abc/hq.jpg");
  const bare = describeInfo({ title: "x", thumbnail: "https://evil.example/a.jpg", formats: [] } as never, "https://e.com/v");
  assert.equal(bare.thumbnail, undefined, "thumbnail host allowlist");
  assert.equal(bare.capabilities.video, false);
  assert.equal(bare.capabilities.sections, false);
  assert.equal(bare.capabilities.liveChat, false);
  assert.ok(bare.notes.some((n) => /No downloadable formats/.test(n)));
  assert.equal(describeInfo({ ...INFO, is_live: true } as never, "https://e.com/v").live, true);
});

test("yt-dlp arguments: 720p default, audio-only, subtitles-only, sections; URL always after --; unsafe formats excluded", () => {
  const base = { info: INFO as never, outTemplate: "/d/media.%(ext)s", proxy: "http://p", limitBytes: 5 * 1024 ** 3 };
  const video = buildArgs({ ...base, req: RequestSchema.parse({ url: "https://e.com/v" }) });
  assert.equal(video.height, 720, "720p by default, not the 1080p original");
  assert.match(video.format!, /^136\+140$/);
  assert.ok(!video.args.includes("evil;rm"));
  assert.equal(video.args.at(-2), "--");
  assert.equal(video.args.at(-1), "https://e.com/v");
  assert.ok(video.args.includes("--continue"), "partial files are kept so a retry resumes");
  const hi = buildArgs({ ...base, req: RequestSchema.parse({ url: "https://e.com/v", maxHeight: 1080 }) });
  assert.equal(hi.height, 1080);
  const audio = buildArgs({ ...base, req: RequestSchema.parse({ url: "https://e.com/v", mode: "audio" }) });
  assert.equal(audio.format, "140");
  assert.ok(audio.args.includes("-x"));
  assert.ok(!audio.args.includes("--merge-output-format"));
  const subs = buildArgs({ ...base, req: RequestSchema.parse({ url: "https://e.com/v", mode: "subtitles", subtitleLangs: ["ne"] }) });
  assert.ok(subs.args.includes("--skip-download") && subs.args.includes("--write-subs"));
  assert.ok(!subs.args.includes("--write-auto-subs"));
  assert.equal(subs.args[subs.args.indexOf("--sub-langs") + 1], "ne");
  const sec = buildArgs({ ...base, req: RequestSchema.parse({ url: "https://e.com/v", section: { start: 61.5, end: 120.2 } }) });
  assert.equal(sec.args[sec.args.indexOf("--download-sections") + 1], "*61-121");
  assert.throws(() => buildArgs({ ...base, info: { ...INFO, subtitles: {}, automatic_captions: {} } as never, req: RequestSchema.parse({ url: "https://e.com/v", mode: "subtitles" }) }), /no manual subtitle/);
  assert.throws(() => buildArgs({ ...base, info: { ...INFO, formats: INFO.formats.filter((f) => f.vcodec !== "none") } as never, req: RequestSchema.parse({ url: "https://e.com/v", mode: "audio" }) }), /No audio-only/);
  assert.equal(estimateBytes(INFO as never, RequestSchema.parse({ url: "https://e.com/v", section: { start: 0, end: 300 } }), 5 * 1024 ** 3), Math.round((90_000_000 + 9_000_000) / 2));
});

test("storage check refuses before downloading; progress and temp-file recognition", () => {
  const GB = 1024 ** 3;
  assert.equal(storageCheck(10 * GB, 1 * GB).ok, true);
  const bad = storageCheck(1 * GB, 2 * GB);
  assert.equal(bad.ok, false);
  assert.match(bad.message!, /Not enough free disk space/);
  assert.equal(storageCheck(1 * GB, undefined).ok, false, "unknown size needs a safe floor");
  assert.equal(storageCheck(null, 1).ok, true);
  assert.deepEqual(parseProgressLine('CLIPPER_PROGRESS:{"downloaded_bytes":50,"total_bytes":100,"speed":10,"eta":5,"filename":"a.f136.mp4"}'), { downloaded: 50, total: 100, speed: 10, eta: 5, file: "a.f136.mp4" });
  assert.equal(parseProgressLine("[download] 5%"), null);
  for (const n of ["media.mp4.part", "media.f136.mp4", "media.f140.m4a.part", "x.ytdl", "media.mp4.part-Frag3", "a.tmp"]) assert.equal(isPartial(n), true, n);
  for (const n of ["media.mp4", "media.en.vtt", "media.m4a"]) assert.equal(isPartial(n), false, n);
});

// ---- manager with a stub downloader (no network, real files, real queue)
type Stub = Deps & { calls: { inspect: number; download: number }; sawPartialAtStart: boolean[]; hold?: Promise<void>; fail?: string; info: object; free: number | null; payload: string };
function stub(over: Partial<Stub> = {}): Stub {
  const s: Stub = {
    calls: { inspect: 0, download: 0 }, sawPartialAtStart: [], info: INFO, free: 100 * 1024 ** 3, payload: "VIDEO-BYTES",
    validate: async (u) => new URL(u),
    proxy: async () => ({ url: "http://stub", close() {} }),
    durationOf: async () => 10,
    freeBytes: async () => s.free,
    limitBytes: () => 5 * 1024 ** 3,
    maxHours: () => 12,
    ytdlp: async (args, signal, onLine) => {
      if (args.includes("--dump-single-json")) {
        s.calls.inspect++;
        return JSON.stringify(s.info);
      }
      s.calls.download++;
      const out = args[args.indexOf("-o") + 1];
      const dir = path.dirname(out);
      s.sawPartialAtStart.push((await fs.readdir(dir)).some((n) => n.endsWith(".part")));
      onLine?.('CLIPPER_PROGRESS:{"downloaded_bytes":512,"total_bytes":1024,"speed":100,"eta":3,"filename":"media.f136.mp4"}');
      await fs.writeFile(path.join(dir, "media.mp4.part"), "partial");
      if (s.hold) await Promise.race([s.hold, new Promise((_, rej) => signal.addEventListener("abort", () => rej(Error("Processing cancelled")), { once: true }))]);
      if (s.fail) throw Error(s.fail);
      if (args.includes("--write-subs")) {
        for (const l of args[args.indexOf("--sub-langs") + 1].split(",")) await fs.writeFile(path.join(dir, `media.${l}.vtt`), "WEBVTT\n\n00:00.000 --> 00:01.000\nhi\n");
      } else await fs.writeFile(path.join(dir, args.includes("-x") ? "media.m4a" : "media.mp4"), s.payload);
      await fs.rm(path.join(dir, "media.mp4.part"), { force: true });
      return "";
    },
  };
  return Object.assign(s, over);
}
async function settled(id: string, want: string[] = ["done", "failed", "cancelled"]) {
  for (let i = 0; i < 400; i++) {
    const it = (await readCollection<DownloadItem>("downloads")).find((r) => r.id === id);
    if (it && want.includes(it.status)) return it;
    await new Promise((r) => setTimeout(r, 25));
  }
  throw Error("timed out");
}
const scoped = async (fn: () => Promise<void>) => {
  const user = "00000000-0000-4000-8000-" + String(Date.now() + Math.floor(Math.random() * 1e6)).padStart(12, "0");
  try { await workspaceScope.run(user, fn); } finally { await fs.rm(path.join(storageBase, "workspaces", user), { recursive: true, force: true }); }
};
const URL1 = "https://youtu.be/abc123def45";

test("download runs end to end: progress, verified file, hash, no leftover temp files", () => scoped(async () => {
  const d = stub();
  const { item, reused } = await requestDownload({ url: URL1 }, d);
  assert.equal(reused, null);
  const done = await settled(item.id);
  assert.equal(done.status, "done", done.error);
  assert.equal(done.files.length, 1);
  assert.equal(done.files[0].kind, "video");
  assert.match(done.sha256!, /^[a-f0-9]{64}$/);
  assert.equal(done.inspection?.title, "Big Match");
  assert.equal(done.estimatedBytes, 99_000_000);
  assert.deepEqual((await fs.readdir(itemDir(item.id))).sort(), ["media.mp4"]);
  assert.equal(d.calls.download, 1);
}));

test("identical requests reuse the valid cache; a damaged cache is downloaded again", () => scoped(async () => {
  const d = stub();
  const first = await requestDownload({ url: URL1 }, d);
  await settled(first.item.id);
  const again = await requestDownload({ url: "https://www.youtube.com/watch?v=abc123def45&utm_source=x" }, d);
  assert.equal(again.reused, "cache");
  assert.equal(again.item.id, first.item.id);
  assert.equal(d.calls.download, 1, "no second download");
  assert.equal((await readCollection("downloads")).length, 1);
  await fs.writeFile(path.join(itemDir(first.item.id), "media.mp4"), "tampered-size");
  const redo = await requestDownload({ url: URL1 }, d);
  assert.equal(redo.reused, "resumed");
  const done = await settled(first.item.id);
  assert.equal(done.status, "done");
  assert.equal(d.calls.download, 2);
}));

test("cancel keeps the partial file and retry resumes; discard removes it", () => scoped(async () => {
  let release!: () => void;
  const d = stub({ hold: new Promise<void>((r) => (release = r)) });
  const { item } = await requestDownload({ url: URL1 }, d);
  const dl = await settled(item.id, ["downloading"]);
  assert.equal(dl.status, "downloading");
  await new Promise((r) => setTimeout(r, 50));
  const prog = (await listDownloads())[0].progress;
  assert.equal(prog?.downloaded, 512);
  assert.equal(prog?.total, 99_000_000, "total uses the metadata estimate");
  await cancelDownload(item.id);
  assert.equal((await settled(item.id)).status, "cancelled");
  assert.ok((await fs.readdir(itemDir(item.id))).includes("media.mp4.part"), "partial kept for resume");
  release();
  d.hold = undefined;
  const r = await retryDownload(item.id, d);
  assert.equal(r.reused, "resumed");
  assert.equal((await settled(item.id)).status, "done");
  assert.equal(d.sawPartialAtStart.at(-1), true, "the retry started with the earlier partial file present");
  // discard
  const d2 = stub({ hold: new Promise<void>(() => {}) });
  const two = await requestDownload({ url: URL1, maxHeight: 480 }, d2);
  await settled(two.item.id, ["downloading"]);
  await cancelDownload(two.item.id, true);
  assert.equal((await settled(two.item.id)).status, "cancelled");
  await new Promise((r) => setTimeout(r, 100));
  assert.equal(await fs.stat(itemDir(two.item.id)).then(() => true, () => false), false, "discard removes the folder");
}));

test("failures are reported with the reason and never leave a 'done' record", () => scoped(async () => {
  const bad = stub({ fail: "HTTP Error 403: Forbidden" });
  const a = await requestDownload({ url: URL1 }, bad);
  const failed = await settled(a.item.id);
  assert.equal(failed.status, "failed");
  assert.match(failed.error!, /403/);
  assert.deepEqual(failed.files, []);
  // not enough disk: nothing is downloaded
  const small = stub({ free: 50 * 1024 ** 2 });
  const b = await requestDownload({ url: URL1, maxHeight: 480 }, small);
  const nodisk = await settled(b.item.id);
  assert.equal(nodisk.status, "failed");
  assert.match(nodisk.error!, /Not enough free disk space/);
  assert.equal(small.calls.download, 0);
  // live stream and unsupported partial download
  const live = stub({ info: { ...INFO, is_live: true } });
  assert.match((await settled((await requestDownload({ url: URL1, mode: "audio" }, live)).item.id)).error!, /completed recording/);
  const nosec = stub({ info: { ...INFO, duration: 0 } });
  assert.match((await settled((await requestDownload({ url: URL1, section: { start: 0, end: 30 } }, nosec)).item.id)).error!, /Partial downloads are not supported/);
  // incomplete media is rejected
  const unreadable = stub({ durationOf: async () => null });
  assert.match((await settled((await requestDownload({ url: URL1, maxHeight: 1080 }, unreadable)).item.id)).error!, /could not be read as media/);
}));

test("audio-only, subtitles-only and sections are first-class; same bytes are flagged as duplicates, not deleted", () => scoped(async () => {
  const d = stub();
  const v = await settled((await requestDownload({ url: URL1 }, d)).item.id);
  const a = await settled((await requestDownload({ url: URL1, mode: "audio" }, d)).item.id);
  assert.equal(a.files[0].kind, "audio");
  const s = await settled((await requestDownload({ url: URL1, mode: "subtitles", subtitleLangs: ["ne", "en"] }, d)).item.id);
  assert.deepEqual(s.files.map((f) => f.name).sort(), ["media.en.vtt", "media.ne.vtt"]);
  const p = await settled((await requestDownload({ url: URL1, section: { start: 10, end: 70 } }, d)).item.id);
  assert.equal(p.status, "done");
  assert.equal(p.estimatedBytes, Math.round(99_000_000 * 0.1));
  assert.equal(p.duplicateOf, v.id, "identical bytes from a different request are flagged");
  assert.equal((await readCollection("downloads")).length, 4, "nothing was auto-deleted");
}));

test("incomplete temp files are cleaned: always after success, after a week for resumable failures", () => scoped(async () => {
  const d = stub({ fail: "network down" });
  const f = await settled((await requestDownload({ url: URL1 }, d)).item.id);
  assert.equal(f.status, "failed");
  assert.ok((await fs.readdir(itemDir(f.id))).includes("media.mp4.part"));
  assert.deepEqual(await cleanPartials(7 * 86400_000), { removed: 0, bytes: 0 }, "recent failure keeps its resumable partial");
  const later = await cleanPartials(7 * 86400_000, Date.now() + 8 * 86400_000);
  assert.equal(later.removed, 1);
  assert.deepEqual(await fs.readdir(itemDir(f.id)), []);
  // orphan temp files without a record are removed, real media is kept
  const orphan = itemDir("11111111-1111-4111-8111-111111111111");
  await fs.mkdir(orphan, { recursive: true });
  await fs.writeFile(path.join(orphan, "x.part"), "p");
  await fs.writeFile(path.join(orphan, "keep.mp4"), "m");
  assert.equal((await cleanPartials()).removed, 1);
  assert.deepEqual(await fs.readdir(orphan), ["keep.mp4"]);
  await removeDownload(f.id);
  assert.equal((await readCollection("downloads")).length, 0);
}));

test("records that claim to be active after a restart are shown as interrupted", () => scoped(async () => {
  await mutateCollection<DownloadItem, void>("downloads", (rows) => {
    rows.push({ id: "22222222-2222-4222-8222-222222222222", request: RequestSchema.parse({ url: URL1 }), canonical: "x", cacheKey: "k", status: "downloading", createdAt: "", updatedAt: new Date().toISOString(), attempts: 1, files: [] });
  });
  const list = await listDownloads();
  assert.equal(list[0].status, "failed");
  assert.match(list[0].error!, /Interrupted/);
}));
