"use client";
import { useCallback, useEffect, useState } from "react";
import type { Inspection } from "@/lib/clipping/downloads-core";
import type { DownloadItem } from "@/lib/clipping/downloads";

type Item = DownloadItem & { progress?: { downloaded: number; total: number; speed?: number; eta?: number; detail?: string } };
type List = { items: Item[]; freeBytes: number | null; limitMb: number };

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, init);
  const data = await r.json();
  if (!r.ok) throw Error(data.error || "Request failed");
  return data;
}
const post = <T,>(url: string, body: unknown) => api<T>(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const mb = (n: number) => (n >= 1024 ** 3 ? (n / 1024 ** 3).toFixed(2) + " GB" : (n / 1048576).toFixed(1) + " MB");
const clock = (t: number) => `${Math.floor(t / 3600) ? Math.floor(t / 3600) + ":" : ""}${String(Math.floor(t / 60) % 60).padStart(2, "0")}:${String(Math.floor(t % 60)).padStart(2, "0")}`;
const secs = (s: string) => { const p = s.trim().split(":").map(Number); return p.some((x) => !Number.isFinite(x)) || !s.trim() ? NaN : p.reduce((a, b) => a * 60 + b, 0); };
const ACTIVE = ["queued", "inspecting", "downloading"];

export function DownloadManager({ openProject }: { openProject: (id: string) => void }) {
  const [url, setUrl] = useState("");
  const [info, setInfo] = useState<Inspection | null>(null);
  const [mode, setMode] = useState<"video" | "audio" | "subtitles">("video");
  const [height, setHeight] = useState(720);
  const [langs, setLangs] = useState<string[]>([]);
  const [auto, setAuto] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [data, setData] = useState<List | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => setData(await api<List>("/api/downloads")), []);
  useEffect(() => {
    load().catch((e) => setError(String(e.message || e)));
  }, [load]);
  const anyActive = data?.items.some((i) => ACTIVE.includes(i.status));
  useEffect(() => {
    if (!anyActive) return;
    const t = setInterval(() => load().catch(() => {}), 1500);
    return () => clearInterval(t);
  }, [anyActive, load]);

  const wrap = async (fn: () => Promise<void>) => { setBusy(true); setError(""); setMessage(""); try { await fn(); } catch (e) { setError(String(e instanceof Error ? e.message : e)); } finally { setBusy(false); } };
  const inspect = () => wrap(async () => {
    const i = await post<Inspection>("/api/download-inspect", { url });
    setInfo(i);
    const hs = i.resolutions.map((r) => r.height);
    setHeight(hs.filter((h) => h <= 720).at(-1) ?? hs[0] ?? 720);
    setLangs([]); setAuto(false); setFrom(""); setTo("");
    setMode(i.capabilities.video ? "video" : i.capabilities.audioOnly ? "audio" : "subtitles");
  });
  const start = () => wrap(async () => {
    const section = from || to ? { start: secs(from || "0"), end: secs(to) } : undefined;
    if (section && (!(section.end > section.start))) throw Error("Enter a valid start and end time (mm:ss) for a partial download.");
    const r = await post<{ reused: string | null }>("/api/downloads", { url, mode, maxHeight: height, subtitleLangs: langs, includeAutoSubs: auto, section });
    setMessage(r.reused === "cache" ? "You already have this download. Nothing was downloaded again." : r.reused === "active" ? "This download is already in progress." : r.reused === "resumed" ? "Resuming from the earlier attempt." : "Queued.");
    await load();
  });
  const act = (path: string, body: unknown) => wrap(async () => { await post(path, body); await load(); });

  const est = info?.resolutions.find((r) => r.height === height)?.estimatedBytes;
  return (
    <div className="download-manager">
      <p className="muted">Download only media you own or have permission to use. Online sources need internet access. Original video is kept at {height}p unless you choose higher. Public sources only; protected or login-only media is not supported.</p>
      <div className="moment-controls">
        <label className="field" style={{ flex: 1, minWidth: 260 }}>Video URL<input value={url} placeholder="https://â€¦" onChange={(e) => { setUrl(e.target.value); setInfo(null); }} /></label>
        <button className="button primary" disabled={busy || !/^https?:\/\//i.test(url)} onClick={inspect}>Inspect source</button>
      </div>
      {message && <p role="status">{message}</p>}
      {error && <p role="alert">{error}</p>}

      {info && (
        <section aria-label="Source details">
          <div className="dl-info">
            {info.thumbnail && <img src={info.thumbnail} alt="" referrerPolicy="no-referrer" width={160} />}
            <div>
              <strong>{info.title}</strong>
              <div className="muted">{[info.creator, info.platform, info.duration ? clock(info.duration) : "", info.uploadDate, info.sourceLanguage && "language " + info.sourceLanguage, "availability: " + info.availability].filter(Boolean).join(" Â· ")}</div>
              <div className="muted">Supports: {Object.entries({ video: "video", audioOnly: "audio-only", subtitles: "subtitles", sections: "partial download", resumable: "resume", liveChat: "chat replay", replayHeatmap: "replay heatmap" }).map(([k, l]) => `${l} ${info.capabilities[k as keyof Inspection["capabilities"]] ? "âœ“" : "âœ—"}`).join(" Â· ")}</div>
              {info.notes.map((n) => <div key={n} className="muted">{n}</div>)}
              {info.chapters.length > 0 && <details><summary>{info.chapters.length} chapters</summary><ul>{info.chapters.map((c, i) => <li key={i}>{clock(c.start)} {c.title} <button className="link" onClick={() => { setFrom(clock(c.start)); setTo(clock(c.end)); }}>use as range</button></li>)}</ul></details>}
              {info.audioTracks.length > 0 && <div className="muted">Audio tracks: {info.audioTracks.map((a) => [a.language, a.codec, a.bitrateKbps && a.bitrateKbps + " kbps"].filter(Boolean).join(" ")).join(" Â· ")}</div>}
            </div>
          </div>
          <div className="moment-controls">
            <fieldset className="moment-tracks"><legend>What to download</legend>
              {(["video", "audio", "subtitles"] as const).map((m) => (
                <label key={m}><input type="radio" name="dl-mode" checked={mode === m} disabled={(m === "video" && !info.capabilities.video) || (m === "audio" && !info.capabilities.audioOnly) || (m === "subtitles" && !info.capabilities.subtitles)} onChange={() => setMode(m)} /> {m === "video" ? "Video" : m === "audio" ? "Audio only" : "Subtitles only"}</label>
              ))}
            </fieldset>
            {mode === "video" && (
              <label className="field">Max resolution
                <select value={height} onChange={(e) => setHeight(+e.target.value)}>
                  {info.resolutions.map((r) => <option key={r.height} value={r.height}>{r.height}p{r.estimatedBytes ? ` Â· â‰ˆ${mb(r.estimatedBytes)}` : ""}{r.height > 720 ? " (larger)" : ""}</option>)}
                </select>
              </label>
            )}
            {mode !== "subtitles" && info.capabilities.sections && (
              <>
                <label className="field">From (mm:ss)<input value={from} placeholder="optional" onChange={(e) => setFrom(e.target.value)} /></label>
                <label className="field">To (mm:ss)<input value={to} placeholder="optional" onChange={(e) => setTo(e.target.value)} /></label>
              </>
            )}
          </div>
          {mode === "subtitles" && (
            <fieldset className="moment-tracks"><legend>Languages (none selected = all manual tracks, up to 5)</legend>
              {info.subtitleTracks.filter((t) => auto || t.kind === "manual").map((t) => (
                <label key={t.lang + t.kind}><input type="checkbox" checked={langs.includes(t.lang)} onChange={() => setLangs((l) => l.includes(t.lang) ? l.filter((x) => x !== t.lang) : [...l, t.lang])} /> {t.lang}{t.kind === "automatic" ? " (auto)" : ""}</label>
              ))}
              <label><input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} /> include automatic subtitles</label>
            </fieldset>
          )}
          <p className="muted">
            {mode === "video" && est ? `Estimated size â‰ˆ ${mb(est)}. ` : ""}
            {data?.freeBytes != null ? `${mb(data.freeBytes)} free on this drive. ` : ""}
            Import limit {mb(data?.limitMb ? data.limitMb * 1048576 : 0)}.
          </p>
          <button className="button primary" disabled={busy} onClick={start}>Download</button>
        </section>
      )}

      <h4>Library and queue</h4>
      <div className="moment-controls">
        <button className="button" disabled={busy} onClick={() => wrap(async () => { const r = await post<{ removed: number; bytes: number }>("/api/download-clean", {}); setMessage(`Removed ${r.removed} incomplete temporary file(s), ${mb(r.bytes)}. Recent failures keep their partial file for 7 days so they can resume.`); await load(); })}>Clean incomplete files</button>
      </div>
      {!data?.items.length && <p className="muted">No downloads yet.</p>}
      {data?.items.map((i) => {
        const p = i.progress;
        const pct = p && p.total > 0 ? Math.min(100, Math.round((p.downloaded / p.total) * 100)) : null;
        return (
          <div key={i.id} className="dl-item">
            <div><strong>{i.inspection?.title ?? i.request.url}</strong> <span className="muted">Â· {i.request.mode}{i.request.mode === "video" ? ` â‰¤${i.request.maxHeight}p` : ""}{i.request.section ? ` Â· ${clock(i.request.section.start)}â€“${clock(i.request.section.end)}` : ""} Â· <strong>{i.status}</strong>{i.attempts > 1 ? ` Â· attempt ${i.attempts}` : ""}</span></div>
            {ACTIVE.includes(i.status) && (
              <div>
                {pct !== null && <progress value={pct} max={100} aria-label="Download progress" />} <span className="muted">{p?.detail ?? "Waiting"}{pct !== null ? ` Â· ${pct}%` : ""}{p?.speed ? ` Â· ${mb(p.speed)}/s` : ""}{p?.eta ? ` Â· ${clock(p.eta)} left` : ""}</span>
              </div>
            )}
            {i.error && <div role="alert">{i.error}</div>}
            {i.status === "done" && <div className="muted">{i.files.map((f) => `${f.name} (${mb(f.bytes)})`).join(", ")}{i.duplicateOf ? " Â· identical to another download (kept; remove one to save space)" : ""}</div>}
            <div className="moment-actions">
              {ACTIVE.includes(i.status) && <><button onClick={() => act("/api/download-cancel", { id: i.id })}>Cancel (keep partial)</button><button onClick={() => confirm("Cancel and delete the partial file?") && act("/api/download-cancel", { id: i.id, discard: true })}>Cancel and discard</button></>}
              {(i.status === "failed" || i.status === "cancelled") && <button onClick={() => act("/api/download-retry", { id: i.id })}>Retry (resumes)</button>}
              {i.status === "done" && i.request.mode === "video" && <button onClick={() => wrap(async () => { const p2 = await post<{ id: string }>("/api/download-to-project", { id: i.id }); openProject(p2.id); })}>Use as project</button>}
              {!ACTIVE.includes(i.status) && <button onClick={() => confirm("Delete this download and its files?") && wrap(async () => { await api("/api/downloads?id=" + i.id, { method: "DELETE" }); await load(); })}>Remove</button>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
