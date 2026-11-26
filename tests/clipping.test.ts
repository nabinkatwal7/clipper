import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { robustScale, findPeaks, smooth } from "../lib/clipping/signals";
import { scoreText, selectDictionaries, normalizeText, hypeTimeline } from "../lib/clipping/hype";
import { parseChat, chatTimeline } from "../lib/clipping/chat";
import { parseReplayHeatmap, replayTimeline } from "../lib/clipping/replay";
import { combine } from "../lib/clipping/scoring";
import { DEFAULT_WEIGHTS, parseProfile, BUILTIN_PROFILES } from "../lib/clipping/profiles";
import { refineBoundaries } from "../lib/clipping/candidates";
import { computeMoments } from "../lib/clipping/engine";
import { parseAudioLines, parseSceneLines, analyzeAudioChunk, analyzeVisualChunk } from "../lib/clipping/media-analysis";
import { run, bin } from "../lib/process";

test("robustScale is baseline-relative: a uniformly loud stream is not scored high everywhere", () => {
  const quiet = Array.from({ length: 200 }, (_, i) => -40 + (i % 3));
  const loud = quiet.map((x) => x + 25);
  quiet[100] = -10;
  loud[100] = 15;
  const a = robustScale(quiet), b = robustScale(loud);
  assert.ok(a[100] > 0.9 && b[100] > 0.9);
  assert.ok(a[10] < 0.3 && b[10] < 0.3);
  assert.deepEqual(robustScale([5, 5, 5, 5]), [0, 0, 0, 0]);
});

test("findPeaks keeps one peak per plateau and respects minimum distance", () => {
  const v = [0, 1, 5, 5, 1, 0, 4, 0, 0, 0, 0, 3, 0];
  assert.deepEqual(findPeaks(v, 2, 1).map((p) => p.index), [2, 6, 11]);
  assert.deepEqual(findPeaks(v, 2, 5).map((p) => p.index), [2, 11]);
  assert.equal(smooth([0, 3, 0], 1)[1], 1);
});

test("hype dictionaries match Devanagari, romanized and mixed-language text; repeats have diminishing returns", () => {
  const d = selectDictionaries(["en", "ne", "ne-latn", "hi"]);
  assert.ok(scoreText("अरे के भयो यो?", d).hits.some((h) => h.dictionary === "ne"));
  assert.ok(scoreText("K bhayo yaar!", d).hits.some((h) => h.dictionary === "ne-latn"));
  assert.ok(scoreText("Oh my God, गजब!", d).hits.length >= 2);
  const once = scoreText("wow", d).score, ten = scoreText("wow ".repeat(10), d).score;
  assert.ok(ten > once && ten < once * 4);
  assert.equal(scoreText("snowwowing", d).score, 0, "no substring matches inside words");
  assert.equal(normalizeText("Dios MÍO!!"), "dios mio");
  assert.equal(normalizeText("क्या हुआ?"), "क्या हुआ", "Devanagari marks are preserved");
});

test("hypeTimeline places score only in bins overlapped by the matching segment", () => {
  const t = hypeTimeline([{ start: 4, end: 5, text: "no way" }, { start: 8, end: 9, text: "just talking" }], 12, 1, selectDictionaries(["en"]));
  assert.ok(t.values[4] > 0);
  assert.equal(t.values.filter((x) => x > 0).length, 1);
});

test("chat import: JSON, Twitch-style, CSV; unreadable rows are counted not invented", () => {
  assert.equal(parseChat("[1,2,3.5]").messages.length, 3);
  const tw = parseChat(JSON.stringify({ comments: [{ content_offset_seconds: 5, commenter: { name: "a" }, message: { body: "LUL" } }, { nothing: 1 }] }));
  assert.equal(tw.messages.length, 1);
  assert.equal(tw.skipped, 1);
  const csv = parseChat('time,user,message\n00:00:05,a,"hello, world"\n0:01:00,b,wow\nbad,c,x');
  assert.deepEqual(csv.messages.map((m) => m.t), [5, 60]);
  assert.equal(csv.messages[0].text, "hello, world");
  assert.throws(() => parseChat("[]"));
});

test("chat timeline applies manual offset and detects repeated phrases", () => {
  const msgs = [10, 10.5, 11, 11.2].map((t) => ({ t, text: "POGGERS pog", user: "u" + t }));
  const a = chatTimeline(msgs, 0, 30, 1);
  const b = chatTimeline(msgs, 5, 30, 1);
  assert.equal(a.rate[10], 2);
  assert.equal(b.rate[15], 2);
  assert.ok(a.repeated.some((x) => x > 0));
  assert.ok(a.reactions.some((x) => x > 0));
});

test("replay heatmap: array, yt-dlp style, and rejects bad input", () => {
  const pts = parseReplayHeatmap({ heatmap: [{ start_time: 0, end_time: 5, value: 0.1 }, { start_time: 5, end_time: 10, value: 1 }] }, 10);
  const r = replayTimeline(pts, 10, 1);
  assert.equal(r.coverage, 1);
  assert.equal(r.values[7], 1);
  assert.throws(() => parseReplayHeatmap([{ start: 5, end: 1, value: 1 }], 10));
});

test("combine redistributes weights over available informative signals", () => {
  const m = combine({ audio: [0, 1, 0], chat: [0, 0, 0] }, DEFAULT_WEIGHTS, 0);
  assert.deepEqual(m.used, ["audio"]);
  assert.deepEqual(m.uninformative, ["chat"]);
  assert.ok(m.missing.includes("replay"));
  assert.equal(m.effectiveWeights.audio, 1);
  assert.equal(m.combined[1], 1);
});

test("profiles validate; all 13 content types exist; invalid custom profile is rejected", () => {
  assert.equal(BUILTIN_PROFILES.length, 13);
  for (const p of BUILTIN_PROFILES) assert.doesNotThrow(() => parseProfile(p));
  assert.throws(() => parseProfile({ ...BUILTIN_PROFILES[0], maxDuration: 10, minDuration: 30 }));
  assert.throws(() => parseProfile({ ...BUILTIN_PROFILES[0], weights: { audio: 0, chat: 0, replay: 0, hype: 0, visual: 0, speech: 0 } }));
});

test("boundary refinement never cuts inside a subtitle line and finishes sentences", () => {
  const segments = [
    { start: 8, end: 14, text: "So here is what happened" },
    { start: 14.2, end: 19, text: "and that is the whole story." },
    { start: 25, end: 28, text: "Next topic." },
  ];
  const r = refineBoundaries({ start: 10, end: 16 }, { segments }, { minDuration: 5, maxDuration: 40, boundary: "transcript-first" }, 100);
  assert.equal(r.start, 8);
  assert.equal(r.end, 19);
  assert.equal(r.precision, "transcript");
  const none = refineBoundaries({ start: 10, end: 30 }, {}, { minDuration: 5, maxDuration: 40, boundary: "media-first" }, 100);
  assert.equal(none.precision, "duration-only");
});

test("computeMoments without transcript/chat/replay still yields candidates and reports what was skipped", () => {
  const n = 300, rms = Array.from({ length: n }, (_, i) => -35 + (i % 4)), peak = rms.map((x) => x + 6);
  for (let i = 150; i < 156; i++) (rms[i] = -8), (peak[i] = -2);
  const res = computeMoments({
    duration: n,
    signals: { version: 1, interval: 1, duration: n, audio: { rmsDb: rms, peakDb: peak, silences: [] }, visual: { motion: Array(n).fill(0.01), cuts: [] } },
    options: { count: 3 },
  });
  assert.ok(res.candidates.length >= 1);
  const c = res.candidates[0];
  assert.ok(c.start <= 150 && c.end >= 156, JSON.stringify(c));
  assert.ok(c.end - c.start >= 20 && c.end - c.start <= 60);
  assert.ok(res.warnings.some((w) => /transcript/i.test(w)));
  assert.ok(res.warnings.some((w) => /audio activity alone/i.test(w)));
  assert.ok(res.missing.includes("chat") && res.missing.includes("replay"));
  assert.ok(c.breakdown[0].signal === "audio");
  assert.equal(res.tracks.combined?.length, n);
});

test("computeMoments with no usable signals returns no candidates and says why", () => {
  const res = computeMoments({ duration: 60, signals: { version: 1, interval: 1, duration: 60 } });
  assert.equal(res.candidates.length, 0);
  assert.ok(res.warnings.some((w) => /No informative signals/.test(w)));
});

test("ffmpeg output parsers handle -inf, frame indexing and silence spans", () => {
  const a = parseAudioLines(["frame:0 pts:0 pts_time:0", "lavfi.astats.Overall.RMS_level=-inf", "frame:1 pts:1 pts_time:1", "lavfi.astats.Overall.RMS_level=-20.5", "lavfi.astats.Overall.Peak_level=-3", "[silencedetect @ x] silence_start: 0.5", "[silencedetect @ x] silence_end: 2 | silence_duration: 1.5"], 100, 3);
  assert.deepEqual(a.rmsDb, [-120, -20.5, -120]);
  assert.deepEqual(a.silences, [{ start: 100.5, end: 102 }]);
  const v = parseSceneLines(["frame:0 pts:0 pts_time:0.5", "lavfi.scene_score=0.9", "frame:1 pts:1 pts_time:3.5", "lavfi.scene_score=0.1"], 10, 5, 1);
  assert.equal(v.motion[0], 0.9);
  assert.deepEqual(v.cuts, [10.5]);
});

// ---- real media: synthesise a video with a known loud, visually busy burst and measure it.
const ffmpeg = bin.ffmpeg;
const haveFfmpeg = path.isAbsolute(ffmpeg) ? existsSync(ffmpeg) : false;
test("real media: FFmpeg analysis locates a synthetic burst and silence", { skip: !haveFfmpeg && "FFMPEG_BIN not configured" }, async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "clip-moments-"));
  const out = path.join(dir, "fixture.mp4");
  try {
    // 0-10s: quiet tone, static color. 10-14s: loud tone + noisy video. 14-20s: quiet tone. 20-24s: silence.
    await run(ffmpeg, [
      "-v", "error", "-y",
      "-f", "lavfi", "-i", "color=c=gray:s=320x180:r=10:d=24",
      "-f", "lavfi", "-i", "sine=f=300:d=24",
      "-f", "lavfi", "-i", "anoisesrc=d=4:c=white:a=0.8",
      "-f", "lavfi", "-i", "testsrc2=s=320x180:r=10:d=4",
      "-filter_complex",
      "[1:a]volume='if(lt(t,20),0.1,0)':eval=frame[q];[2:a]adelay=10000|10000,apad=whole_dur=24[b];[q][b]amix=inputs=2:duration=first:normalize=0[a];" +
        "[0:v][3:v]overlay=enable='between(t,10,14)'[v]",
      "-map", "[v]", "-map", "[a]", "-t", "24", "-c:v", "libx264", "-preset", "ultrafast", "-c:a", "aac", out,
    ]);
    const ctl = new AbortController();
    const audio = await analyzeAudioChunk(out, 0, 24, 1, ctl.signal);
    assert.equal(audio.rmsDb.length, 24);
    const loud = Math.max(...audio.rmsDb.slice(10, 14)), quiet = Math.max(...audio.rmsDb.slice(2, 8));
    assert.ok(loud - quiet > 10, `burst should be >10 dB above baseline (got ${loud} vs ${quiet})`);
    assert.ok(audio.silences.some((s) => s.start >= 19 && s.start <= 21), JSON.stringify(audio.silences));
    const visual = await analyzeVisualChunk(out, 0, 24, 1, ctl.signal);
    assert.ok(Math.max(...visual.motion.slice(10, 14)) > Math.max(...visual.motion.slice(2, 8)) * 3 + 0.01);
    const res = computeMoments({
      duration: 24,
      signals: { version: 1, interval: 1, duration: 24, audio, visual },
      options: { count: 1, minDuration: 8, maxDuration: 20 },
    });
    assert.equal(res.candidates.length, 1, JSON.stringify(res.warnings));
    const c = res.candidates[0];
    assert.ok(c.peakAt >= 9 && c.peakAt <= 15, `peak ${c.peakAt}`);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

// ---- Phase 3: Ollama layer (stubbed transport; no real model is claimed to have run)
import { enrichCandidates, excerpt, templateMetadata, type ModelPlan } from "../lib/clipping/ai";
function base() {
  const n = 200, rms = Array.from({ length: n }, (_, i) => -35 + (i % 4)), peak = rms.map((x) => x + 6);
  for (let i = 100; i < 106; i++) (rms[i] = -8), (peak[i] = -2);
  return computeMoments({ duration: n, signals: { version: 1, interval: 1, duration: n, audio: { rmsDb: rms, peakDb: peak, silences: [] } }, options: { count: 2 } });
}
const segs = [{ start: 95, end: 110, text: "You will not believe what just happened here, this is the whole point of the story.", words: [] }];
const plan: ModelPlan = { main: "m", light: "m", embed: null, installed: ["m"], reachable: true };
const good = JSON.stringify({ hook: 8, payoff: 7, completeness: 9, clarity: 8, category: "story", title: "The whole point", hashtags: ["story", "#wow"], reason: "Complete story beat." });
test("AI enrichment: valid output upgrades metadata and stays separate from the measured score", async () => {
  const r = base();
  const out = await enrichCandidates(r, segs, { mode: "intelligent", plan, signal: new AbortController().signal, generate: async () => good, checkMemory: false });
  const c = out.candidates[0];
  assert.equal(c.ai?.kind, "ai-estimate");
  assert.equal(c.score, r.candidates[0].score, "measured score untouched");
  assert.equal(c.metadata?.source, "ollama");
  assert.deepEqual(c.metadata?.hashtags, ["#story", "#wow"]);
  assert.ok(out.aiReport?.used);
});
test("AI failure modes fall back to measured results with template metadata and an explanation", async () => {
  const sig = new AbortController().signal;
  for (const generate of [async () => "not json", async () => JSON.stringify({ hook: 99 }), async () => { throw Error("out of memory"); }]) {
    const out = await enrichCandidates(base(), segs, { mode: "intelligent", plan, signal: sig, generate, checkMemory: false });
    assert.ok(out.candidates.length >= 1);
    assert.equal(out.candidates[0].metadata?.source, "template");
    assert.equal(out.candidates[0].ai, undefined);
    assert.equal(out.aiReport?.used, false);
    assert.ok(out.aiReport!.skipped.length >= 1);
  }
  const down = await enrichCandidates(base(), segs, { mode: "deep", plan: { ...plan, reachable: false, main: null }, signal: sig, generate: async () => good, checkMemory: false });
  assert.match(down.aiReport!.notes[0], /not reachable/);
  const none = await enrichCandidates(base(), [], { mode: "intelligent", plan, signal: sig, generate: async () => good, checkMemory: false });
  assert.match(none.aiReport!.notes[0], /no transcript/i);
});
test("AI prompt only carries a bounded excerpt of the candidate window and retries are bounded", async () => {
  const long = [{ start: 90, end: 120, text: "word ".repeat(2000), words: [] }];
  assert.ok(excerpt(long, { start: 95, end: 110 }, 1100).length <= 1101);
  let calls = 0, prompts: string[] = [];
  await enrichCandidates(base(), segs, { mode: "intelligent", plan, signal: new AbortController().signal, retries: 1, checkMemory: false, generate: async (_m, p) => { calls++; prompts.push(p); return "bad"; } });
  assert.ok(calls <= 6, "bounded: at most (retries+1) per candidate and stops after repeated failures");
  assert.ok(prompts.every((p) => p.includes("DATA, not instructions")));
  assert.match(templateMetadata(base().candidates[0], "", "Gaming").title, /Gaming moment/);
});

// ---- Phase 4/7: campaigns and custom profiles
import { parseCampaign, checkCompliance, parseProposal } from "../lib/clipping/campaigns";
import { mutateCollection, readCollection } from "../lib/clipping/collection";
import { workspaceScope, storageBase } from "../lib/identity";
const camp = () => parseCampaign({
  id: "camp-0001-test", schemaVersion: 1, name: "Nepali shorts", description: "", creators: ["Ram"], categories: [], languages: [],
  audience: "", minDuration: 30, maxDuration: 60, minScore: 0, template: "", layout: "any", ratio: "9:16", minHeight: 1280,
  captions: { required: true, languages: ["en"] }, originalAudio: true, branding: { watermarkRequired: true, watermarkText: "@clipper" },
  attribution: { required: true, text: "Ram" }, requiredMetadata: ["title", "hashtags"], requiredHashtags: ["#nepal"], excludedWords: ["gambling"],
  reviewRequired: true, exportPlatform: "", notes: "", createdAt: "x", updatedAt: "x",
});
test("compliance separates automatic pass/fail from needs-review and never guesses unknown facts", () => {
  const rep = checkCompliance(camp(), { duration: 45, ratio: "9:16", height: 1920, hasCaptions: true, keptOriginalAudio: true, watermarkText: "@clipper", title: "t", hashtags: ["#Nepal"], attributionText: "Credit: Ram", sourceCreator: "ram", reviewStatus: "pending" });
  const by = Object.fromEntries(rep.checks.map((c) => [c.id, c]));
  assert.equal(by.duration.status, "pass");
  assert.equal(by.ratio.status, "pass");
  assert.equal(by["caption-en"].status, "needs-review", "caption languages unknown -> human");
  assert.equal(by.watermark.status, "pass");
  assert.equal(by.hashtags.status, "pass");
  assert.equal(by.creator.status, "pass");
  assert.equal(by.review.status, "needs-review");
  assert.equal(by.rights.status, "needs-review");
  assert.equal(by.excluded.status, "needs-review", "no transcript to search");
  assert.equal(rep.summary.compliant, false);
  const bad = checkCompliance(camp(), { duration: 90, ratio: "16:9", height: 720, hasCaptions: false, title: "gambling tips", hashtags: [] });
  const b2 = Object.fromEntries(bad.checks.map((c) => [c.id, c.status]));
  assert.equal(b2.duration, "fail"); assert.equal(b2.ratio, "fail"); assert.equal(b2.resolution, "fail");
  assert.equal(b2.captions, "fail"); assert.equal(b2.excluded, "fail"); assert.equal(b2.hashtags, "fail"); assert.equal(b2["meta-hashtags"], "fail");
});
test("campaign validation rejects bad ranges; AI proposals drop invalid fields and never auto-save", () => {
  assert.throws(() => parseCampaign({ ...camp(), minDuration: 60, maxDuration: 30 }));
  assert.throws(() => parseCampaign({ ...camp(), ratio: "2:1" }));
  const { proposal, dropped } = parseProposal(JSON.stringify({ name: "X", minDuration: 30, maxDuration: 60, ratio: "banana", evil: "rm -rf", excludedWords: ["a"] }));
  assert.deepEqual(Object.keys(proposal).sort(), ["excludedWords", "maxDuration", "minDuration", "name"]);
  assert.deepEqual(dropped.sort(), ["evil", "ratio"]);
});
test("per-user collection store is atomic under concurrent writers", async () => {
  const user = "00000000-0000-4000-8000-" + String(Date.now()).padStart(12, "0");
  await workspaceScope.run(user, async () => {
    await Promise.all(Array.from({ length: 20 }, (_, i) => mutateCollection<{ id: string }, void>("campaigns", (rows) => { rows.push({ id: "r" + i }); })));
    assert.equal((await readCollection("campaigns")).length, 20);
  });
  await fs.rm(path.join(storageBase, "workspaces", user), { recursive: true, force: true });
});
test("profile include/exclude words filter candidates only when a transcript exists", () => {
  const n = 300, rms = Array.from({ length: n }, (_, i) => -35 + (i % 4)), peak = rms.map((x) => x + 6);
  for (let i = 150; i < 156; i++) (rms[i] = -8), (peak[i] = -2);
  const signals = { version: 1 as const, interval: 1, duration: n, audio: { rmsDb: rms, peakDb: peak, silences: [] } };
  const segments = [{ start: 140, end: 160, text: "this clip mentions gambling a lot", words: [] }];
  const prof = { ...BUILTIN_PROFILES[0], id: "x", excludeWords: ["gambling"] };
  const withText = computeMoments({ duration: n, signals, segments, options: { profile: "x", customProfiles: [prof] } });
  assert.equal(withText.candidates.length, 0);
  const noText = computeMoments({ duration: n, signals, options: { profile: "x", customProfiles: [prof] } });
  assert.ok(noText.candidates.length >= 1);
  assert.ok(noText.warnings.some((w) => /not applied/.test(w)));
});

// ---- Phase 7: keyless discovery
import { parseFeed, youtubeFeedUrl, trendFor, addObservation, topicFrequency, uploadFrequency, parseVideoImport, type TrackedVideo } from "../lib/clipping/feeds";
import { feedFor, fetchFeedText, parseCreator } from "../lib/clipping/discovery-store";
import { parseCsv } from "../lib/clipping/chat";
import { nicheAnalysis } from "../lib/clipping/niche";
const ATOM = `<?xml version="1.0"?><feed xmlns:yt="y" xmlns:media="m"><title>Chan &amp; Co</title>
<entry><yt:videoId>abc123</yt:videoId><title>Clutch &#x1F525; win</title><link rel="alternate" href="https://www.youtube.com/watch?v=abc123"/><author><name>Chan</name></author><published>2026-11-20T10:00:00+00:00</published>
<media:group><media:thumbnail url="https://i.ytimg.com/vi/abc123/hq.jpg"/><media:community><media:starRating count="12" average="5.0"/><media:statistics views="1500"/></media:community></media:group></entry>
<entry><yt:videoId>def456</yt:videoId><title>No stats here</title><link rel="alternate" href="https://www.youtube.com/watch?v=def456"/><published>2026-11-25T10:00:00+00:00</published></entry></feed>`;
test("feed parser reads Atom with statistics, leaves absent fields undefined, rejects non-feeds", () => {
  const f = parseFeed(ATOM);
  assert.equal(f.title, "Chan & Co");
  assert.equal(f.items.length, 2);
  assert.equal(f.items[0].views, 1500);
  assert.equal(f.items[0].title, "Clutch 🔥 win");
  assert.equal(f.items[1].views, undefined);
  assert.equal(f.items[1].thumbnail, undefined);
  const rss = parseFeed(`<rss><channel><title>R</title><item><title>One</title><link>https://e.com/1</link><pubDate>Tue, 24 Nov 2026 10:00:00 GMT</pubDate></item></channel></rss>`);
  assert.equal(rss.items[0].url, "https://e.com/1");
  assert.throws(() => parseFeed("<html></html>"));
});
test("trend measures use only recorded observations and label what is missing or stale", () => {
  const v: TrackedVideo = { id: "c:1", creatorId: "c", title: "t", url: "https://x", published: "2026-11-20T00:00:00Z", source: "s", observations: [] };
  const now = Date.parse("2026-11-26T00:00:00Z");
  assert.ok(trendFor(v, now).missing.includes("view count"));
  addObservation(v, { at: "2026-11-25T00:00:00Z", views: 1000 });
  assert.equal(trendFor(v, now).viewsPerHour, undefined);
  assert.ok(trendFor(v, now).missing.some((m) => /second observation/.test(m)));
  addObservation(v, { at: "2026-11-25T10:00:00Z", views: 1500 });
  const t = trendFor(v, Date.parse("2026-11-25T11:00:00Z"));
  assert.equal(t.viewsPerHour, 50);
  assert.equal(t.stale, false);
  assert.equal(trendFor(v, Date.parse("2026-11-27T00:00:00Z")).stale, true);
  assert.equal(addObservation(v, { at: "2026-11-25T10:30:00Z", views: 1500 }), false, "no-information repeat skipped");
  assert.equal(uploadFrequency([v], now).last7, 1);
  assert.deepEqual(topicFrequency(["Minecraft speedrun", "minecraft hardcore", "Cooking pasta"]).map((x) => x.word), ["minecraft"]);
});
test("feed discovery: only keyless feeds; handles need a feed URL; private hosts are blocked", async () => {
  assert.equal(youtubeFeedUrl("https://www.youtube.com/channel/UC1234567890123456789012"), "https://www.youtube.com/feeds/videos.xml?channel_id=UC1234567890123456789012");
  assert.equal(youtubeFeedUrl("https://www.youtube.com/@someone"), null);
  const c = parseCreator({ id: "creator-00001", name: "A", channelUrl: "https://www.twitch.tv/a" });
  assert.match(feedFor(c).unavailable ?? "", /No keyless feed/);
  await assert.rejects(fetchFeedText("http://127.0.0.1/feed.xml"));
  await assert.rejects(fetchFeedText("http://localhost/feed.xml"));
  assert.throws(() => parseCreator({ id: "creator-00001", name: "A", feedUrl: "https://u:p@e.com/f" }));
});
test("manual video import (CSV/JSON) and niche analysis keep claims tied to cited titles", async () => {
  const items = parseVideoImport("title,url,views,published\nA video,https://e.com/a,100,2026-11-01\nbad,notaurl,1,", parseCsv);
  assert.equal(items.length, 1);
  assert.equal(items[0].views, 100);
  const titles = ["speedrun one", "speedrun two", "cooking a", "cooking b", "speedrun three", "x"];
  const out = await nicheAnalysis(titles, { main: "m", light: "m", embed: null, installed: [], reachable: true }, async () => JSON.stringify({ topics: [{ name: "Speedruns", titles: [1, 2, 5, 99] }, { name: "Invented", titles: [99] }], patterns: ["numbered series"] }), new AbortController().signal);
  assert.deepEqual(out.topics.map((t) => t.name), ["Speedruns"]);
  assert.deepEqual(out.topics[0].evidence.map((e) => e.n), [1, 2, 5]);
  await assert.rejects(nicheAnalysis(["a"], { main: "m", light: "m", embed: null, installed: [], reachable: true }, async () => "{}", new AbortController().signal));
});

// ---- Phase 9: storage policy and dependency-aware cleanup
import { classify, scan, planCache, planPolicy, execute, report, REGENERABLE as REGEN } from "../lib/clipping/storage";
import type { Project } from "../lib/types";
const U1 = "11111111-1111-4111-8111-111111111111", U2 = "22222222-2222-4222-8222-222222222222";
const proj = (id: string, extra: Partial<Project> = {}, ok = true): Project => ({
  id, title: id, duration: 100, width: 1, height: 1, status: "ready", stage: "complete", detail: "", createdAt: "", updatedAt: "",
  settings: {} as Project["settings"], highlights: [],
  clips: ok ? [{ id: "c", file: "", settings: {} as Project["settings"], segments: [], start: 0, end: 1, title: "", reason: "", score: 1, qa: { duration: 1, width: 1, height: 1, fps: 30, audio: true, bytes: 1, warnings: [] } }] : [],
  ...extra,
});
test("classification protects user imports and results; caches are regenerable", () => {
  assert.equal(classify("temp", `${U1}.chat.messages.json`).category, "user-imports");
  assert.equal(classify("temp", `${U1}.moments.json`).category, "results");
  assert.equal(classify("temp", `${U1}.signals.raw.i1.all.json`).category, "analysis-cache");
  assert.equal(classify("temp", `${U1}.${"a".repeat(64)}.json`).category, "ollama-cache");
  assert.equal(classify("uploads", `${U1}.mp4`).category, "source");
  assert.equal(classify("uploads", `${U1}.proxy.mp4`).category, "proxy");
  assert.equal(classify("temp", `${U1}.x.json.tmp`).category, "partial");
});
test("cleanup previews respect dependencies, running jobs and verification; execution only deletes approved items", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "clip-storage-"));
  try {
    for (const d of ["uploads", "temp", "audio", "clips"]) await fs.mkdir(path.join(root, d));
    const old = new Date(Date.now() - 10 * 86400_000);
    const w = async (d: string, n: string, size = 1000) => { const p = path.join(root, d, n); await fs.writeFile(p, Buffer.alloc(size)); await fs.utimes(p, old, old); return p; };
    await w("uploads", `${U1}.mp4`); await w("temp", `${U1}.signals.raw.i1.all.json`); await w("temp", `${U1}.chat.messages.json`); await w("temp", `${U1}.moments.json`);
    await w("uploads", `${U2}.mp4`); await w("temp", `${U2}.${"b".repeat(64)}.json`); await w("clips", `${U1}.mp4`);
    const entries = await scan(root);
    assert.ok(report(entries).length >= 4);
    const projects = [proj(U1, { source: "https://e.com/v" }), proj(U2, { source: "https://e.com/w", settings: { note: U1 } as unknown as Project["settings"] }, false)];
    // production: sources and caches stay
    assert.equal(planPolicy("production", entries, projects, new Set()).items.filter((i) => i.category === "source").length, 0);
    // space-saver: U1 caches go (verified), U2 blocked (no verified clips); user imports/results never proposed
    const ss = planPolicy("space-saver", entries, projects, new Set());
    assert.deepEqual(ss.items.map((i) => i.category).sort(), ["analysis-cache"]);
    assert.ok(ss.blocked.some((b) => /not verified/.test(b.reason)));
    // temporary: U1 source is referenced by U2's settings -> blocked; U2 has no verified clips -> blocked
    const tmp = planPolicy("temporary", entries, projects, new Set());
    assert.equal(tmp.items.filter((i) => i.category === "source").length, 0);
    assert.ok(tmp.blocked.some((b) => /referenced by project/.test(b.reason)));
    // unreferenced + verified + downloaded -> eligible; busy -> blocked; local import -> blocked
    const free = [proj(U1, { source: "https://e.com/v" })];
    assert.equal(planPolicy("temporary", entries, free, new Set()).items.filter((i) => i.category === "source").length, 1);
    assert.ok(planPolicy("temporary", entries, free, new Set([U1])).blocked.some((b) => /running job/.test(b.reason)));
    assert.ok(planPolicy("temporary", entries, [proj(U1)], new Set()).blocked.some((b) => /cannot be downloaded again/.test(b.reason)));
    // cache sweep: age + size limit; busy skipped
    const sweep = planCache(entries, { olderThanDays: 5, busy: new Set() });
    assert.deepEqual(sweep.items.map((i) => i.category).sort(), ["analysis-cache", "ollama-cache"]);
    assert.equal(planCache(entries, { olderThanDays: 5, busy: new Set([U1, U2]) }).items.length, 0);
    // execute refuses anything outside the approved preview
    const outside = path.join(root, "clips", `${U1}.mp4`);
    const res = await execute(root, sweep, [...sweep.items.map((i) => i.path), outside]);
    assert.equal(res.removed, 2);
    assert.equal(res.failed.length, 1);
    assert.ok((await fs.stat(outside)).isFile());
    assert.ok((await fs.stat(path.join(root, "temp", `${U1}.chat.messages.json`))).isFile());
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

// ---- Phase 6: post kit and platform presets
import { postKitFiles, presetWarnings, PLATFORM_PRESETS } from "../lib/clipping/postkit";
test("post kit contains the requested files, never invents quotes, and records provenance", () => {
  const clip = { title: "Big win", postCaption: "What a finish #clutch #nepal", start: 62, end: 100, category: "gaming", settings: { ratio: "9:16" } as Project["settings"], segments: [{ start: 62, end: 66, text: "No way, that just happened", words: [] }] };
  const files = postKitFiles({ clip, sourceTitle: "Stream", sourceUrl: "https://e.com/v", rights: { permission: "permitted", creator: "Ram", license: "", attribution: "", notes: "" }, language: "en", srt: () => "1\n00:00:00,000 --> 00:00:04,000\nNo way\n" });
  assert.deepEqual(Object.keys(files).sort(), ["attribution.txt", "captions-original.srt", "description.txt", "hashtags.txt", "metadata.json", "pinned-comment.txt", "title.txt"]);
  assert.equal(files["hashtags.txt"].trim(), "#clutch #nepal");
  assert.equal(files["description.txt"].trim(), "What a finish");
  assert.match(files["attribution.txt"], /Ram/);
  const meta = JSON.parse(files["metadata.json"]);
  assert.equal(meta.source.startsAt, "1:02");
  assert.equal(meta.suggestedOpeningLine.text, "No way, that just happened");
  const bare = postKitFiles({ clip: { ...clip, segments: [] }, sourceTitle: "S", rights: { permission: "unknown", creator: "", license: "", attribution: "", notes: "" }, srt: () => "" });
  assert.equal(JSON.parse(bare["metadata.json"]).suggestedOpeningLine, null);
  assert.match(bare["attribution.txt"], /No attribution recorded/);
});
test("platform presets are advisory and warn on mismatches", () => {
  const p = PLATFORM_PRESETS.find((x) => x.id === "instagram-reels")!;
  const w = presetWarnings(p, { start: 0, end: 120, settings: { ratio: "16:9" } as Project["settings"] });
  assert.equal(w.length, 2);
  assert.match(p.note, /Verify/);
});

// ---- Phase 9: system health and hardware profiles
import { recommendProfile, canSelect, profileById, HARDWARE_PROFILES, cpuUsage, encoderChecks } from "../lib/clipping/system";
test("hardware profiles never auto-select Performance and gate it on small machines", () => {
  assert.equal(recommendProfile(8192), "balanced");
  assert.equal(recommendProfile(4096), "eco");
  assert.equal(recommendProfile(65536), "balanced", "even a big machine is only recommended Balanced");
  assert.equal(canSelect("performance", 8192, false), false);
  assert.equal(canSelect("performance", 8192, true), true);
  assert.equal(canSelect("performance", 32768, false), true);
  assert.equal(canSelect("eco", 4096, false), true);
  assert.equal(profileById("nonsense").id, "eco");
  assert.ok(HARDWARE_PROFILES.every((p) => p.heavyJobs === 1), "one heavy job in every profile");
});
test("system metrics are measured (CPU in range) and encoder claims come from a real test encode", { skip: !haveFfmpeg && "FFMPEG_BIN not configured" }, async () => {
  const cpu = await cpuUsage(200);
  assert.ok(cpu.usagePercent !== null && cpu.usagePercent >= 0 && cpu.usagePercent <= 100);
  const enc = await encoderChecks(undefined, 0);
  const x264 = enc.find((e) => e.encoder === "libx264")!;
  assert.equal(x264.verified, true, x264.detail);
  for (const e of enc) assert.ok(!e.verified || e.listed, "verified implies listed");
});

test("collection store survives constant concurrent readers while writing (Windows rename-over-open-file)", async () => {
  const user = "00000000-0000-4000-8000-" + String(Date.now() + 7).padStart(12, "0");
  await workspaceScope.run(user, async () => {
    let stop = false;
    const readers = Array.from({ length: 6 }, async () => {
      while (!stop) { await readCollection("runs"); await new Promise((r) => setImmediate(r)); }
    });
    const writes = [];
    for (let i = 0; i < 150; i++) writes.push(mutateCollection<{ id: string }, void>("runs", (rows) => { rows.push({ id: "w" + i }); }));
    try {
      await Promise.all(writes);
    } finally {
      stop = true;
      await Promise.all(readers);
    }
    assert.equal((await readCollection("runs")).length, 150);
  });
  await fs.rm(path.join(storageBase, "workspaces", user), { recursive: true, force: true });
});

test("storage keeps download-manager files out of generic cleanup (resumable partials are intentional)", () => {
  assert.equal(classify("downloads", "media.mp4").category, "downloads");
  assert.equal(classify("downloads", "media.mp4.part").category, "download-partial");
  assert.equal(REGEN.has("download-partial"), false);
  assert.equal(REGEN.has("downloads"), false);
});
