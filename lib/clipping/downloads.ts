import { createHash, randomUUID } from "node:crypto";
import { createReadStream, promises as fs } from "node:fs";
import path from "node:path";
import { workspaceRoot, workspaceScope } from "../identity";
import { downloadProxy, validateUrl } from "../network";
import { bin, run } from "../process";
import { diskFree } from "./system";
import { mutateCollection, readCollection } from "./collection";
import { RequestSchema, buildArgs, cacheKey, canonicalUrl, describeInfo, estimateBytes, isPartial, parseProgressLine, storageCheck, type DownloadRequest, type Inspection, type Progress } from "./downloads-core";

export type DownloadStatus = "queued" | "inspecting" | "downloading" | "done" | "failed" | "cancelled";
export type DownloadFile = { name: string; bytes: number; kind: "video" | "audio" | "subtitle" | "other" };
export type DownloadItem = {
  id: string;
  request: DownloadRequest;
  canonical: string;
  cacheKey: string;
  status: DownloadStatus;
  createdAt: string;
  updatedAt: string;
  attempts: number;
  inspection?: Inspection;
  estimatedBytes?: number;
  files: DownloadFile[];
  bytes?: number;
  sha256?: string;
  duplicateOf?: string;
  error?: string;
};

export type Deps = {
  validate(url: string): Promise<URL>;
  proxy(signal: AbortSignal): Promise<{ url: string; close(): void }>;
  ytdlp(args: string[], signal: AbortSignal, onLine?: (line: string) => void): Promise<string>;
  durationOf(file: string, signal: AbortSignal): Promise<number | null>;
  freeBytes(dir: string): Promise<number | null>;
  ffmpeg?: string;
  limitBytes(): number;
  maxHours(): number;
};

export const defaultDeps: Deps = {
  validate: validateUrl,
  proxy: downloadProxy,
  ytdlp: (args, signal, onLine) => run(bin.ytdlp, args, signal, onLine, 6 * 3600_000, 2_000_000),
  durationOf: async (f, signal) => {
    try {
      const n = Number((await run(bin.ffprobe, ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", f], signal, undefined, 60_000)).trim());
      return Number.isFinite(n) && n > 0 ? n : null;
    } catch {
      return null;
    }
  },
  freeBytes: async (dir) => (await diskFree(dir))?.freeBytes ?? null,
  ffmpeg: process.env.FFMPEG_BIN ? bin.ffmpeg : undefined,
  limitBytes: () => Number(process.env.MAX_UPLOAD_MB || 5120) * 1048576,
  maxHours: () => Number(process.env.MAX_VIDEO_HOURS || 12),
};

type State = { queue: { id: string; scope: string | undefined; deps: Deps }[]; running?: { id: string; controller: AbortController; discard: boolean }; progress: Map<string, Progress & { detail?: string }>; lastClean: number };
const g = globalThis as unknown as { clipperDownloads?: State };
const state: State = (g.clipperDownloads ??= { queue: [], progress: new Map(), lastClean: 0 });

export const itemDir = (id: string) => {
  if (!/^[a-f0-9-]{36}$/.test(id)) throw Error("Invalid download id");
  return path.join(workspaceRoot(), "downloads", id);
};

const COL = "downloads";
const patch = (id: string, fn: (i: DownloadItem) => void) =>
  mutateCollection<DownloadItem, void>(COL, (rows) => {
    const i = rows.find((r) => r.id === id);
    if (i) {
      fn(i);
      i.updatedAt = new Date().toISOString();
    }
  });

const kindOf = (n: string): DownloadFile["kind"] =>
  /\.vtt$/i.test(n) ? "subtitle" : /\.(mp4|mkv|webm|mov|m4v)$/i.test(n) ? "video" : /\.(m4a|mp3|opus|ogg|aac|wav|flac)$/i.test(n) ? "audio" : "other";

export async function sha256(file: string): Promise<string> {
  const h = createHash("sha256");
  for await (const chunk of createReadStream(file)) h.update(chunk);
  return h.digest("hex");
}

/** A cached copy is valid only while every recorded file still exists at its recorded size. */
export async function cacheValid(item: DownloadItem): Promise<boolean> {
  if (item.status !== "done" || !item.files.length) return false;
  const dir = itemDir(item.id);
  for (const f of item.files) {
    const st = await fs.stat(path.join(dir, f.name)).catch(() => null);
    if (!st || st.size !== f.bytes || st.size === 0) return false;
  }
  return true;
}

/** Fetch metadata only (no media is downloaded). */
export async function inspectUrl(url: string, signal: AbortSignal, deps: Deps = defaultDeps) {
  const u = await deps.validate(url);
  const proxy = await deps.proxy(signal);
  try {
    const raw = await deps.ytdlp(["--ignore-config", "--no-plugin-dirs", "--no-playlist", "--socket-timeout", "20", "--retries", "1", "--proxy", proxy.url, "--skip-download", "--dump-single-json", "--", u.href], signal);
    const info = JSON.parse(raw);
    return { info, inspection: describeInfo(info, u.href) };
  } finally {
    proxy.close();
  }
}

/**
 * Queue a download. Returns the existing item (no new job) when an identical request is already
 * cached and intact, queued or running. A failed or cancelled identical request is resumed.
 */
export async function requestDownload(input: unknown, deps: Deps = defaultDeps): Promise<{ item: DownloadItem; reused: "cache" | "active" | "resumed" | null }> {
  const req = RequestSchema.parse(input);
  const u = await deps.validate(req.url);
  req.url = u.href;
  const key = cacheKey(req);
  const rows = await readCollection<DownloadItem>(COL);
  const same = rows.filter((r) => r.cacheKey === key);
  for (const r of same) if (await cacheValid(r)) return { item: r, reused: "cache" };
  const active = same.find((r) => ["queued", "inspecting", "downloading"].includes(r.status) && (state.running?.id === r.id || state.queue.some((q) => q.id === r.id)));
  if (active) return { item: active, reused: "active" };
  const prior = same.find((r) => r.status === "failed" || r.status === "cancelled" || r.status === "done");
  const scope = workspaceScope.getStore();
  if (prior) {
    await patch(prior.id, (i) => ((i.status = "queued"), (i.error = undefined), (i.attempts += 1), (i.files = []), (i.bytes = undefined), (i.sha256 = undefined)));
    state.queue.push({ id: prior.id, scope, deps });
    void pump();
    return { item: { ...prior, status: "queued" }, reused: "resumed" };
  }
  const now = new Date().toISOString();
  const item: DownloadItem = { id: randomUUID(), request: req, canonical: canonicalUrl(req.url), cacheKey: key, status: "queued", createdAt: now, updatedAt: now, attempts: 1, files: [] };
  await mutateCollection<DownloadItem, void>(COL, (all) => {
    if (all.length >= 1000) throw Error("Download library is full; remove old items first.");
    all.push(item);
  });
  state.queue.push({ id: item.id, scope, deps });
  void pump();
  return { item, reused: null };
}

export async function listDownloads(): Promise<(DownloadItem & { progress?: Progress & { detail?: string } })[]> {
  const rows = await readCollection<DownloadItem>(COL);
  const live = new Set([state.running?.id, ...state.queue.map((q) => q.id)]);
  const out = [];
  for (const r of rows) {
    // A record claiming to be active with no job in this process was interrupted by a restart.
    if (["queued", "inspecting", "downloading"].includes(r.status) && !live.has(r.id)) {
      await patch(r.id, (i) => ((i.status = "failed"), (i.error = "Interrupted (the server restarted). Retry resumes from the partial file.")));
      r.status = "failed";
      r.error = "Interrupted (the server restarted). Retry resumes from the partial file.";
    }
    out.push({ ...r, progress: state.progress.get(r.id) });
  }
  return out.reverse();
}

export async function cancelDownload(id: string, discard = false) {
  const q = state.queue.findIndex((x) => x.id === id);
  if (q >= 0) state.queue.splice(q, 1);
  else if (state.running?.id === id) {
    state.running.discard = discard;
    state.running.controller.abort();
    return;
  } else throw Error("That download is not active.");
  await patch(id, (i) => (i.status = "cancelled"));
  if (discard) await fs.rm(itemDir(id), { recursive: true, force: true });
}

export async function retryDownload(id: string, deps: Deps = defaultDeps) {
  const item = (await readCollection<DownloadItem>(COL)).find((r) => r.id === id);
  if (!item) throw Error("Download not found.");
  if (item.status !== "failed" && item.status !== "cancelled") throw Error("Only failed or cancelled downloads can be retried.");
  return requestDownload(item.request, deps);
}

export async function removeDownload(id: string) {
  if (state.running?.id === id || state.queue.some((q) => q.id === id)) throw Error("Cancel the download before removing it.");
  await fs.rm(itemDir(id), { recursive: true, force: true });
  return mutateCollection<DownloadItem, boolean>(COL, (rows) => {
    const i = rows.findIndex((r) => r.id === id);
    if (i >= 0) rows.splice(i, 1);
    return i >= 0;
  });
}

/**
 * Remove incomplete temporary files. Always for finished items; for failed or cancelled items only
 * once older than `keepResumableMs` (until then they let a retry resume).
 */
export async function cleanPartials(keepResumableMs = 7 * 86400_000, now = Date.now()) {
  const rows = await readCollection<DownloadItem>(COL);
  const active = new Set([state.running?.id, ...state.queue.map((q) => q.id)]);
  let removed = 0, bytes = 0;
  const base = path.join(workspaceRoot(), "downloads");
  for (const name of await fs.readdir(base).catch(() => [] as string[])) {
    if (active.has(name)) continue;
    const dir = path.join(base, name);
    const item = rows.find((r) => r.id === name);
    const files = await fs.readdir(dir).catch(() => [] as string[]);
    if (!item) { // orphan directory with no record: only temp files are removed
      for (const f of files) if (isPartial(f)) { const st = await fs.stat(path.join(dir, f)).catch(() => null); await fs.rm(path.join(dir, f), { force: true }); removed++; bytes += st?.size ?? 0; }
      continue;
    }
    const age = now - Date.parse(item.updatedAt);
    const resumable = item.status === "failed" || item.status === "cancelled";
    if (resumable && age < keepResumableMs) continue;
    for (const f of files) if (isPartial(f)) {
      const st = await fs.stat(path.join(dir, f)).catch(() => null);
      await fs.rm(path.join(dir, f), { force: true });
      removed++;
      bytes += st?.size ?? 0;
    }
  }
  return { removed, bytes };
}

async function pump() {
  if (state.running) return;
  const next = state.queue.shift();
  if (!next) return;
  const controller = new AbortController();
  state.running = { id: next.id, controller, discard: false };
  const go = () => execute(next.id, controller.signal, next.deps);
  try {
    await (next.scope ? workspaceScope.run(next.scope, go) : go());
  } catch (e) {
    const cancelled = controller.signal.aborted;
    const body = () => patch(next.id, (i) => ((i.status = cancelled ? "cancelled" : "failed"), (i.error = cancelled ? undefined : e instanceof Error ? e.message : String(e))));
    await (next.scope ? workspaceScope.run(next.scope, body) : body()).catch(() => {});
    if (cancelled && state.running?.discard) await (next.scope ? workspaceScope.run(next.scope, () => fs.rm(itemDir(next.id), { recursive: true, force: true })) : fs.rm(itemDir(next.id), { recursive: true, force: true })).catch(() => {});
  } finally {
    state.progress.delete(next.id);
    state.running = undefined;
    void pump();
  }
}

async function execute(id: string, signal: AbortSignal, deps: Deps) {
  const item = (await readCollection<DownloadItem>(COL)).find((r) => r.id === id);
  if (!item) throw Error("Download record missing.");
  const req = item.request;
  const dir = itemDir(id);
  await fs.mkdir(dir, { recursive: true });
  await patch(id, (i) => (i.status = "inspecting"));
  state.progress.set(id, { downloaded: 0, total: 0, detail: "Reading source details" });
  const { info, inspection } = await inspectUrl(req.url, signal, deps);
  if (inspection.live) throw Error("Use a completed recording; live and upcoming streams cannot be downloaded.");
  if (inspection.duration > deps.maxHours() * 3600) throw Error("This recording exceeds MAX_VIDEO_HOURS.");
  if (req.mode === "video" && !inspection.capabilities.video) throw Error("This source reports no video stream.");
  if (req.section && !inspection.capabilities.sections) throw Error("Partial downloads are not supported for this source. Download the whole file instead.");
  const estimated = estimateBytes(info, req, deps.limitBytes());
  // Bytes already on disk from a previous attempt do not need space again.
  const existing = await Promise.all((await fs.readdir(dir).catch(() => [] as string[])).map((n) => fs.stat(path.join(dir, n)).then((s) => s.size).catch(() => 0)));
  const check = storageCheck(await deps.freeBytes(dir), estimated === undefined ? undefined : Math.max(0, estimated - existing.reduce((a, b) => a + b, 0)));
  if (!check.ok) throw Error(check.message);
  await patch(id, (i) => ((i.status = "downloading"), (i.inspection = inspection), (i.estimatedBytes = estimated)));

  const proxy = await deps.proxy(signal);
  try {
    const { args } = buildArgs({ req, info: info as Parameters<typeof buildArgs>[0]["info"], outTemplate: path.join(dir, "media.%(ext)s"), proxy: proxy.url, ffmpeg: deps.ffmpeg, limitBytes: deps.limitBytes() });
    const perFile = new Map<string, { d: number; t: number }>();
    let diagnostics = "";
    await deps.ytdlp(args, signal, (line) => {
      diagnostics = (diagnostics + "\n" + line).slice(-4000);
      const p = parseProgressLine(line);
      if (p) {
        perFile.set(p.file ?? "media", { d: p.downloaded, t: p.total });
        const d = [...perFile.values()].reduce((a, x) => a + x.d, 0);
        const t = estimated ?? [...perFile.values()].reduce((a, x) => a + x.t, 0);
        state.progress.set(id, { downloaded: d, total: Math.max(t, d), speed: p.speed, eta: p.eta, detail: `${(d / 1048576).toFixed(0)} MB received` });
      } else if (/\[(Merger|VideoRemuxer|ExtractAudio|FixupM4a)\]/.test(line)) state.progress.set(id, { ...(state.progress.get(id) ?? { downloaded: 0, total: 0 }), detail: "Finishing: combining streams" });
    }).catch((e) => {
      // Keep the partial files on failure/cancel so a retry resumes. Surface the real reason.
      if (signal.aborted) throw e;
      throw Error(`${e instanceof Error ? e.message : String(e)}`.slice(0, 1500));
    });

    signal.throwIfAborted();
    const names = (await fs.readdir(dir)).filter((n) => !isPartial(n));
    const files: DownloadFile[] = [];
    for (const n of names) {
      const st = await fs.stat(path.join(dir, n));
      if (st.isFile() && st.size > 0) files.push({ name: n, bytes: st.size, kind: kindOf(n) });
    }
    const media = files.find((f) => f.kind === (req.mode === "audio" ? "audio" : "video"));
    if (req.mode !== "subtitles") {
      if (!media) throw Error(`The downloader did not produce a complete file. ${diagnostics.trim().slice(-600)}`);
      if (media.bytes > deps.limitBytes()) throw Error("The downloaded file exceeds the MAX_UPLOAD_MB limit.");
      if ((await deps.durationOf(path.join(dir, media.name), signal)) === null) throw Error("The downloaded file could not be read as media. It may be incomplete.");
    } else if (!files.some((f) => f.kind === "subtitle")) throw Error("No subtitle files were produced for the requested languages.");
    // Finished: temporary leftovers are no longer needed.
    for (const n of await fs.readdir(dir)) if (isPartial(n)) await fs.rm(path.join(dir, n), { force: true });
    const digest = media ? await sha256(path.join(dir, media.name)) : undefined;
    const others = await readCollection<DownloadItem>(COL);
    const dup = digest ? others.find((o) => o.id !== id && o.status === "done" && o.sha256 === digest) : undefined;
    await patch(id, (i) => ((i.status = "done"), (i.files = files), (i.bytes = files.reduce((a, f) => a + f.bytes, 0)), (i.sha256 = digest), (i.duplicateOf = dup?.id), (i.error = undefined)));
  } finally {
    proxy.close();
  }
}
