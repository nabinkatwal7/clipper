// Offline acceptance run against a running Studio started with scripts/offline-guard.cjs.
// Env: CLIPPER_URL (default http://127.0.0.1:4177), CLIPPER_STORAGE_DIR (the server's storage dir),
//      OFFLINE_GUARD_LOG (the guard's log file), FFMPEG_BIN. Uses a throwaway account on that storage.
// Test inputs (video, transcript, chat) are synthetic and created here; nothing is downloaded.
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtempSync, readFileSync, writeFileSync, existsSync, mkdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const BASE = process.env.CLIPPER_URL || "http://127.0.0.1:4177";
const STORAGE = process.env.CLIPPER_STORAGE_DIR;
const GUARD_LOG = process.env.OFFLINE_GUARD_LOG;
const FFMPEG = process.env.FFMPEG_BIN || "ffmpeg";
if (!STORAGE || !GUARD_LOG) throw Error("Set CLIPPER_STORAGE_DIR and OFFLINE_GUARD_LOG.");
if (!["127.0.0.1", "localhost"].includes(new URL(BASE).hostname)) throw Error("Loopback only.");

let cookie = "";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function api(method, url, body, headers = {}) {
  const res = await fetch(BASE + url, {
    method,
    headers: { origin: BASE, cookie, ...(body !== undefined && !(body instanceof Buffer) ? { "Content-Type": "application/json" } : {}), ...headers },
    body: body === undefined ? undefined : body instanceof Buffer ? body : JSON.stringify(body),
  });
  const sc = res.headers.getSetCookie?.() ?? [];
  const c = sc.map((v) => v.match(/^(studio_session=[^;]+)/)?.[1]).find(Boolean);
  if (c) cookie = c;
  const ct = res.headers.get("content-type") || "";
  const data = ct.includes("json") ? await res.json().catch(() => null) : null;
  return { status: res.status, ok: res.ok, data, res };
}
async function until(fn, ms, what) {
  const end = Date.now() + ms;
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() > end) throw Error("timed out waiting for " + what);
    await sleep(500);
  }
}
const results = [];
async function step(name, fn) {
  const t = Date.now();
  try {
    const note = await fn();
    results.push({ name, pass: true, secs: Math.round((Date.now() - t) / 100) / 10, note: note || "" });
  } catch (e) {
    results.push({ name, pass: false, secs: Math.round((Date.now() - t) / 100) / 10, note: String(e.message || e).slice(0, 300) });
  }
  const r = results.at(-1);
  console.log(`${r.pass ? "PASS" : "FAIL"}  ${r.name}  (${r.secs}s)${r.note ? "  - " + r.note : ""}`);
}
const guardLines = () => (existsSync(GUARD_LOG) ? readFileSync(GUARD_LOG, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)) : []);
const project = async (id) => (await api("GET", "/api/progress?project=" + id)).data;
const settled = (id, ms = 180000) => until(async () => { const p = await project(id); return p && (p.status === "ready" || p.status === "error" || p.status === "cancelled") ? p : null; }, ms, "project " + id);

const tmp = mkdtempSync(path.join(tmpdir(), "clip-offline-"));
const user = "offline" + randomUUID().slice(0, 8);
const password = "Off-" + randomUUID() + "-aA1!";
let pid, userId, clip;

await step("create local account, sign out, sign in again", async () => {
  const r = await api("POST", "/api/auth/register", { name: "Offline Tester", email: user + "@example.test", username: user, password, confirm: password, terms: true });
  if (!r.ok) throw Error(r.data?.error || r.status);
  await api("POST", "/api/auth/logout", {});
  cookie = "";
  const l = await api("POST", "/api/auth/login", { identifier: user, password });
  if (!l.ok || !cookie) throw Error("login failed: " + (l.data?.error || l.status));
  const accounts = JSON.parse(readFileSync(path.join(STORAGE, "auth", "accounts.json"), "utf8"));
  userId = accounts.users.find((u) => u.username === user).id;
  const anon = await fetch(BASE + "/api/progress");
  if (anon.status !== 401) throw Error("API did not require sign-in");
  return "login works; unauthenticated API access is refused";
});

const fixture = path.join(tmp, "fixture.mp4");
await step("create synthetic 60 s test video (local FFmpeg)", async () => {
  const r = spawnSync(FFMPEG, ["-v", "error", "-y", "-f", "lavfi", "-i", "color=c=gray:s=640x360:r=15:d=60", "-f", "lavfi", "-i", "sine=f=300:d=60", "-f", "lavfi", "-i", "anoisesrc=d=6:c=white:a=0.6", "-f", "lavfi", "-i", "testsrc2=s=640x360:r=15:d=6",
    "-filter_complex", "[1:a]volume=0.1[q];[2:a]adelay=20000|20000,apad=whole_dur=60[b];[q][b]amix=inputs=2:duration=first:normalize=0[a];[0:v][3:v]overlay=enable='between(t,20,26)'[v]", "-map", "[v]", "-map", "[a]", "-t", "60", "-c:v", "libx264", "-preset", "ultrafast", "-c:a", "aac", fixture], { encoding: "utf8" });
  if (r.status !== 0) throw Error(r.stderr);
  return Math.round(statSync(fixture).size / 1024) + " KB";
});

await step("import local video and render a manual clip", async () => {
  const settings = encodeURIComponent(JSON.stringify({ mode: "manual", manualStart: 0, manualEnd: 8, captions: false, resolution: "720" }));
  const r = await api("POST", "/api/import?settings=" + settings, readFileSync(fixture), { "Content-Type": "application/octet-stream", "X-File-Name": "Offline fixture" });
  if (r.status !== 202) throw Error(JSON.stringify(r.data));
  pid = r.data.id;
  const p = await settled(pid);
  if (p.status !== "ready" || p.clips.length !== 1) throw Error(`status ${p.status}: ${p.error || p.detail}`);
  return `${Math.round(p.duration)} s source, clip ${p.clips[0].qa?.width}x${p.clips[0].qa?.height}`;
});

const moments = async () => (await api("GET", "/api/moments?project=" + pid)).data;
const analyse = async (opts = {}) => {
  const before = (await moments()).result?.generatedAt;
  const r = await api("POST", "/api/moments?project=" + pid, { count: 3, ...opts });
  if (r.status !== 202) throw Error(JSON.stringify(r.data));
  const res = await until(async () => { const m = await moments(); return m.result && m.result.generatedAt !== before ? m.result : null; }, 180000, "analysis");
  await settled(pid); // the job saves the project last; wait until it is idle again
  return res;
};

await step("no-AI analysis finds the known burst (audio + visual)", async () => {
  const res = await analyse();
  const c = res.candidates.find((x) => x.start <= 26 && x.end >= 20);
  if (!c) throw Error("no candidate covers the burst: " + JSON.stringify(res.candidates.map((x) => [x.start, x.end])));
  return `used ${res.used.join("+")}; candidate ${c.start}-${c.end}s`;
});

await step("import chat log and re-score", async () => {
  const times = Array.from({ length: 80 }, (_, i) => 20 + i * 0.07);
  const r = await api("POST", "/api/moments-import", { project: pid, kind: "chat", text: JSON.stringify(times.map((t, i) => ({ t, text: i % 2 ? "LUL" : "POG", user: "u" + (i % 7) }))) });
  if (!r.ok) throw Error(r.data?.error);
  const res = await analyse();
  if (!res.used.includes("chat")) throw Error("chat signal not used");
  return "chat messages imported and used";
});

await step("subtitle transcript (synthetic) adds hype and speech signals", async () => {
  const dir = path.join(STORAGE, "workspaces", userId, "transcripts");
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, pid + ".json"), JSON.stringify([
    { start: 17, end: 20, text: "So we have been trying this for an hour.", words: [] },
    { start: 20, end: 24, text: "No way, that was incredible! Let's go!", words: [] },
    { start: 24, end: 29, text: "I cannot believe it actually worked on the last try.", words: [] },
    { start: 40, end: 44, text: "Anyway, moving on to the next part of the stream.", words: [] },
  ]));
  const res = await analyse();
  for (const s of ["hype", "speech"]) if (!res.used.includes(s)) throw Error(s + " signal not used");
  const c = res.candidates.find((x) => x.start <= 26 && x.end >= 20);
  return `used ${res.used.join("+")}; edges ${c.precision}`;
});

await step("local Ollama ranking and metadata", async () => {
  const r = await api("POST", "/api/moments-ai", { project: pid, mode: "intelligent" });
  if (r.status !== 202) throw Error(JSON.stringify(r.data));
  const res = await until(async () => { const m = await moments(); return m.result?.aiReport ? m.result : null; }, 240000, "Ollama review");
  await settled(pid);
  if (!res.aiReport.used) throw Error("Ollama did not run: " + res.aiReport.notes.join(" "));
  const c = res.candidates.find((x) => x.metadata?.source === "ollama");
  return `${res.aiReport.model} reviewed ${res.aiReport.analysed}; title "${c?.metadata.title}"`;
});

await step("Quick Clip (instant mode, local file, captions from local transcript)", async () => {
  const r = await api("POST", "/api/quick-clip", { projectId: pid, contentType: "general", count: 1, minDuration: 15, maxDuration: 40, captions: true, mode: "instant", ratio: "9:16", resolution: "720" });
  if (r.status !== 202) throw Error(JSON.stringify(r.data));
  const run = await until(async () => { const rs = (await api("GET", "/api/autopilot-runs")).data.filter((x) => x.autopilotId === "quick-clip-default"); const x = rs[0]; return x && ["done", "failed", "cancelled"].includes(x.status) ? x : null; }, 240000, "quick clip run");
  if (run.status !== "done") throw Error(run.error || run.status);
  const p = await settled(pid);
  clip = p.clips.at(-1);
  if (p.clips.length < 2 || !clip.segments?.length) throw Error(`expected a captioned clip, got ${p.clips.length} clips, ${clip?.segments?.length} segments`);
  return `rendered ${Math.round(clip.end - clip.start)} s clip with ${clip.segments.length} caption segment(s)`;
});

await step("manual edit and re-render of a clip", async () => {
  const r = await api("POST", "/api/edit", { project: pid, clip: clip.id, settings: { ...clip.settings, overlayText: "Edited offline" }, start: clip.start, end: clip.end, title: "Edited offline" });
  if (r.status !== 202) throw Error(JSON.stringify(r.data));
  const p = await until(async () => {
    const q = await project(pid);
    if (q.status === "error") throw Error(q.error || "edit failed");
    return q.status === "ready" && q.clips.some((x) => x.title === "Edited offline") ? q : null;
  }, 180000, "edited clip");
  const c = p.clips.find((x) => x.title === "Edited offline");
  if (c.settings.overlayText !== "Edited offline") throw Error("edit not applied to settings");
  clip = c;
  return `re-rendered ${c.qa?.width}x${c.qa?.height}, ${c.qa?.warnings.length} warning(s)`;
});

await step("local translation of caption text with Ollama", async () => {
  const r = await api("POST", "/api/localize", { project: pid, clip: clip.id, language: "Nepali" });
  if (!r.ok) throw Error(r.data?.error || r.status);
  const text = JSON.stringify(r.data);
  if (!/[ऀ-ॿ]/.test(text)) throw Error("no Devanagari text returned: " + text.slice(0, 160));
  return "Devanagari translation returned";
});

await step("campaign compliance report", async () => {
  const c = await api("POST", "/api/campaigns", { name: "Offline check", minDuration: 10, maxDuration: 60, ratio: "9:16", layout: "any", creators: [], categories: [], languages: [], captions: { required: true, languages: [] }, reviewRequired: true, excludedWords: [], requiredHashtags: [], requiredMetadata: [], minScore: 0, minHeight: 0, originalAudio: false, branding: { watermarkRequired: false, watermarkText: "" }, attribution: { required: false, text: "" }, description: "", audience: "", template: "", exportPlatform: "", notes: "" });
  if (!c.ok) throw Error(c.data?.error);
  const r = await api("POST", "/api/campaign-compliance", { campaign: c.data.id, project: pid, clip: clip.id });
  if (!r.ok || !r.data[0]) throw Error(JSON.stringify(r.data));
  const s = r.data[0].report.summary;
  return `${s.pass} pass, ${s.fail} fail, ${s.needsReview} need review`;
});

await step("publishing package ZIP", async () => {
  const q = `project=${pid}&clip=${clip.id}`;
  const r = await api("POST", "/api/publish-package?" + q);
  if (r.status !== 202) throw Error(JSON.stringify(r.data));
  await until(async () => (await api("GET", "/api/publish-package?" + q + "&status")).data?.available, 180000, "package");
  const dl = await api("GET", "/api/publish-package?" + q);
  const zip = path.join(tmp, "pkg.zip");
  writeFileSync(zip, Buffer.from(await dl.res.arrayBuffer()));
  const py = spawnSync("python", ["-I", "-c", "import zipfile,sys;print('\\n'.join(zipfile.ZipFile(sys.argv[1]).namelist()))", zip], { encoding: "utf8" });
  const names = py.stdout.split("\n").map((s) => s.trim()).filter(Boolean).map((n) => n.split("/").pop());
  for (const need of ["video.mp4", "title.txt", "hashtags.txt", "attribution.txt", "metadata.json", "captions-original.srt", "thumbnail.jpg"]) if (!names.includes(need)) throw Error("package missing " + need + ": " + names.join(", "));
  return `${names.length} files incl. video.mp4, metadata.json, captions-original.srt`;
});

await step("local-only pages respond (storage, system health, downloads library, profiles)", async () => {
  const out = [];
  for (const u of ["/api/storage-report", "/api/system", "/api/downloads", "/api/moment-profiles", "/api/platform-presets", "/api/autopilots"]) {
    const r = await api("GET", u);
    if (!r.ok) throw Error(u + " -> " + r.status + " " + JSON.stringify(r.data).slice(0, 120));
    out.push(u.split("/").pop());
  }
  const sys = (await api("GET", "/api/system")).data;
  if (!sys.ollama.reachable) throw Error("local Ollama not reachable");
  return out.join(", ");
});

await step("studio page references no external resources (HTML and CSS)", async () => {
  const html = await (await fetch(BASE + "/app", { headers: { cookie } })).text();
  const external = (text) => [...text.matchAll(/(?:src|href)="(https?:\/\/[^"]+)"|url\(\s*['"]?(https?:\/\/[^)'"\s]+)|@import\s+(?:url\()?['"]?(https?:\/\/[^)'";\s]+)/g)]
    .map((m) => m[1] || m[2] || m[3]).filter((u) => u && !u.startsWith(BASE) && !/^https?:\/\/(www\.)?w3\.org\//.test(u));
  const found = new Set(external(html));
  const sheets = [...html.matchAll(/href="(\/_next\/static\/[^"]+\.css[^"]*)"/g)].map((m) => m[1]);
  for (const href of sheets) for (const u of external(await (await fetch(BASE + href, { headers: { cookie } })).text())) found.add(u);
  if (found.size) throw Error("external references: " + [...found].slice(0, 5).join(", "));
  return `checked the page and ${sheets.length} stylesheet(s): none`;
});

const coreAttempts = guardLines();
await step("core flows made no outbound network attempts", async () => {
  if (coreAttempts.length) throw Error(`${coreAttempts.length} blocked attempt(s): ` + [...new Set(coreAttempts.map((a) => a.target))].join(", "));
  return "0 blocked connection or DNS attempts during the steps above";
});

// Internet-dependent features: they must fail clearly, not hang or fall back silently.
const offlineMessages = {};
await step("internet-only features report a clear failure", async () => {
  const a = await api("POST", "/api/download-inspect", { url: "https://example.com/video.mp4" });
  offlineMessages.downloadInspect = a.data?.error;
  const cr = await api("POST", "/api/creators", { name: "Offline feed", feedUrl: "https://example.com/feed.xml" });
  const b = await api("POST", "/api/creator-check", { id: cr.data.id, force: true });
  offlineMessages.creatorCheck = b.data?.error;
  const imp = await api("POST", "/api/import", { url: "https://example.com/video.mp4", settings: {}, generate: false });
  offlineMessages.urlImport = imp.data?.error ?? (imp.status === 202 ? (await settled(imp.data.id ?? "", 60000).catch(() => null))?.error : undefined);
  for (const [k, v] of Object.entries(offlineMessages)) if (!v) throw Error(k + " did not fail with a message");
  return JSON.stringify(offlineMessages);
});

rmSync(tmp, { recursive: true, force: true });
const attempts = guardLines();
console.log("\nGUARD: " + attempts.length + " blocked attempt(s) in total; targets: " + ([...new Set(attempts.map((a) => a.kind + ":" + a.target))].join(", ") || "none"));
const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} steps passed`);
writeFileSync(path.join(STORAGE, "..", "offline-acceptance-result.json"), JSON.stringify({ results, offlineMessages, guard: attempts }, null, 1));
process.exit(failed.length ? 1 : 0);
