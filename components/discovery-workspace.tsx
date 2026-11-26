"use client";
import { useCallback, useEffect, useState } from "react";
import type { Creator } from "@/lib/clipping/discovery-store";
import type { Trend, TrackedVideo } from "@/lib/clipping/feeds";

type Video = TrackedVideo & { trend: Trend };
type Videos = { videos: Video[]; frequency: { last7: number; last30: number; tracked: number; withDate: number }; topics: { word: string; count: number }[] };
type Niche = { model: string; topics: { name: string; evidence: { n: number; title: string }[] }[]; patterns: string[]; basedOn: number };
type Note = { id: string; kind: string; text: string; url?: string; createdAt: string };

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, init);
  const data = await r.json();
  if (!r.ok) throw Error(data.error || "Request failed");
  return data;
}
const post = <T,>(url: string, body: unknown) => api<T>(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const ago = (h?: number) => (h === undefined ? "—" : h < 48 ? `${Math.round(h)}h` : `${Math.round(h / 24)}d`);

export function DiscoveryWorkspace() {
  const [creators, setCreators] = useState<Creator[]>([]);
  const [sel, setSel] = useState<string>("");
  const [data, setData] = useState<Videos | null>(null);
  const [niche, setNiche] = useState<Niche | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [form, setForm] = useState({ name: "", channelUrl: "", feedUrl: "", categories: "", language: "" });
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const wrap = async (fn: () => Promise<void>) => { setBusy(true); setError(""); setMessage(""); try { await fn(); } catch (e) { setError(String(e instanceof Error ? e.message : e)); } finally { setBusy(false); } };

  const loadCreators = useCallback(async () => setCreators(await api<Creator[]>("/api/creators")), []);
  const loadVideos = useCallback(async (id: string) => setData(await api<Videos>("/api/videos" + (id ? "?creator=" + id : ""))), []);
  const loadNotes = useCallback(async () => setNotes(await api<Note[]>("/api/research")), []);
  useEffect(() => { Promise.all([loadCreators(), loadNotes()]).catch((e) => setError(String(e.message || e))); }, [loadCreators, loadNotes]);
  useEffect(() => { loadVideos(sel).catch((e) => setError(String(e.message || e))); setNiche(null); }, [sel, loadVideos]);
  const current = creators.find((c) => c.id === sel);

  const add = () => wrap(async () => {
    const c = await post<Creator>("/api/creators", { ...form, categories: form.categories.split(",").map((x) => x.trim()).filter(Boolean) });
    setForm({ name: "", channelUrl: "", feedUrl: "", categories: "", language: "" });
    await loadCreators(); setSel(c.id);
  });
  const check = (force: boolean) => wrap(async () => {
    const r = await post<{ skipped: boolean; reason?: string; added?: number }>("/api/creator-check", { id: sel, force });
    setMessage(r.skipped ? r.reason! : `Checked. ${r.added} new video(s).`);
    await Promise.all([loadCreators(), loadVideos(sel)]);
  });
  const importFile = (f?: File) => wrap(async () => {
    if (!f || !sel) return;
    const r = await post<{ added: number; updated: number }>("/api/discovery-import", { creator: sel, text: await f.text() });
    setMessage(`Imported: ${r.added} new, ${r.updated} updated observation(s).`);
    await loadVideos(sel);
  });
  const remove = () => wrap(async () => {
    if (!confirm("Stop tracking this creator and delete its recorded observations?")) return;
    await api("/api/creators?id=" + sel, { method: "DELETE" }); setSel(""); await loadCreators();
  });
  const analyse = () => wrap(async () => setNiche(await post<Niche>("/api/niche", { creator: sel || undefined })));
  const saveNote = (kind: string, text: string, url?: string) => wrap(async () => { await post("/api/research", { kind, text, url }); setNote(""); await loadNotes(); });

  return (
    <div className="campaigns">
      <aside>
        <button className={sel === "" ? "selected" : ""} onClick={() => setSel("")}>All tracked</button>
        <ul>{creators.map((c) => <li key={c.id}><button className={c.id === sel ? "selected" : ""} onClick={() => setSel(c.id)}>{c.name}</button></li>)}</ul>
        <details>
          <summary>Add creator</summary>
          {(["name", "channelUrl", "feedUrl", "categories", "language"] as const).map((k) => (
            <label className="field" key={k}>{k === "channelUrl" ? "Public channel URL" : k === "feedUrl" ? "RSS/Atom feed URL (optional)" : k}
              <input value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} /></label>
          ))}
          <button className="button primary" disabled={busy || !form.name} onClick={add}>Add</button>
        </details>
      </aside>
      <section>
        <h3>Trend radar — measured from public feeds you track</h3>
        <p className="muted">
          Numbers come only from feeds and files you add, recorded when you checked. They are not worldwide rankings. Platforms without a keyless feed
          (e.g. Twitch, Kick) need a CSV/JSON import. Checking requires internet access.
        </p>
        {current && (
          <div className="moment-controls">
            <button className="button" disabled={busy} onClick={() => check(false)}>Check feed</button>
            <button className="button" disabled={busy} onClick={() => check(true)} title="Bypasses the polling interval; use sparingly">Check now (force)</button>
            <label className="field">Import CSV/JSON<input type="file" accept=".csv,.json" onChange={(e) => importFile(e.target.files?.[0])} /></label>
            <button className="button" disabled={busy} onClick={remove}>Remove creator</button>
            <span className="muted">Last checked: {current.lastChecked ? new Date(current.lastChecked).toLocaleString() : "never"} · {current.lastCheckStatus ?? "no status"} · every {current.intervalMinutes} min while the app is open</span>
          </div>
        )}
        {message && <p role="status">{message}</p>}
        {error && <p role="alert">{error}</p>}
        {data && (
          <>
            <p className="muted">
              {data.frequency.tracked} videos tracked · uploads in last 7 days: {data.frequency.last7} · last 30 days: {data.frequency.last30}
              {data.frequency.withDate < data.frequency.tracked ? ` (${data.frequency.tracked - data.frequency.withDate} without a date)` : ""}
            </p>
            <table className="moment-breakdown">
              <thead><tr><th>Video</th><th>Age</th><th>Views</th><th>Views/hour</th><th>Observed</th><th>Notes</th></tr></thead>
              <tbody>
                {data.videos.map((v) => (
                  <tr key={v.id}>
                    <td><a href={v.url} target="_blank" rel="noreferrer noopener">{v.title}</a></td>
                    <td>{ago(v.trend.ageHours)}</td>
                    <td>{v.trend.views?.toLocaleString() ?? "—"}</td>
                    <td>{v.trend.viewsPerHour === undefined ? "—" : Math.round(v.trend.viewsPerHour).toLocaleString()}</td>
                    <td>{v.trend.observedAt ? new Date(v.trend.observedAt).toLocaleDateString() : "—"} ({v.trend.observations}){v.trend.stale ? " · stale" : ""}</td>
                    <td className="muted">{v.trend.missing.length ? "missing: " + v.trend.missing.join("; ") : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!data.videos.length && <p className="muted">Nothing tracked yet. Add a creator and check its feed, or import a file.</p>}
            {data.topics.length > 0 && (
              <p><strong>Recurring title words (counted, not interpreted):</strong> {data.topics.map((t) => `${t.word} ×${t.count}`).join(" · ")}</p>
            )}
            <button className="button" disabled={busy || data.videos.length < 5} onClick={analyse}>Summarise topics with Ollama</button>
            {niche && (
              <div role="region" aria-label="AI topic interpretation">
                <p className="muted">AI interpretation by {niche.model} of {niche.basedOn} titles. Each topic lists the titles it is based on.</p>
                {niche.topics.map((t) => (
                  <details key={t.name}><summary>{t.name} ({t.evidence.length})</summary><ul>{t.evidence.map((e) => <li key={e.n}>{e.title}</li>)}</ul></details>
                ))}
                {niche.patterns.length > 0 && <p>Title patterns: {niche.patterns.join(" · ")}</p>}
              </div>
            )}
          </>
        )}
        <h3>Saved research</h3>
        <div className="moment-controls">
          <label className="field">Note or keyword<input value={note} onChange={(e) => setNote(e.target.value)} /></label>
          <button className="button" disabled={busy || !note.trim()} onClick={() => saveNote("note", note)}>Save note</button>
          <button className="button" disabled={busy || !note.trim()} onClick={() => saveNote("keyword", note)}>Watch keyword</button>
        </div>
        <ul>{notes.map((n) => (
          <li key={n.id}>[{n.kind}] {n.text} <button aria-label="Delete" onClick={() => wrap(async () => { await api("/api/research?id=" + n.id, { method: "DELETE" }); await loadNotes(); })}>×</button></li>
        ))}</ul>
      </section>
    </div>
  );
}
