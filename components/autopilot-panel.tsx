"use client";
import { useCallback, useEffect, useState } from "react";
import type { Project } from "@/lib/types";
import type { Autopilot, Run } from "@/lib/clipping/autopilot-core";
import type { Campaign } from "@/lib/clipping/campaigns";
import type { Creator } from "@/lib/clipping/discovery-store";

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, init);
  const data = await r.json();
  if (!r.ok) throw Error(data.error || "Request failed");
  return data;
}
const post = <T,>(url: string, body: unknown) => api<T>(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

type Draft = {
  id?: string; name: string; kind: "manual" | "new-video" | "file-arrival"; creatorId: string; folder: string; intervalMinutes: number;
  profile: string; count: number; minScore: number; campaignId: string; useAi: boolean; requireApproval: boolean; render: boolean; requireTranscript: boolean; enabled: boolean;
};
const blank: Draft = { name: "", kind: "manual", creatorId: "", folder: "", intervalMinutes: 60, profile: "general", count: 3, minScore: 0.3, campaignId: "", useAi: false, requireApproval: true, render: true, requireTranscript: false, enabled: false };

const fromAp = (a: Autopilot): Draft => ({
  id: a.id, name: a.name, kind: a.trigger.kind,
  creatorId: a.trigger.kind === "new-video" ? a.trigger.creatorId : "", folder: a.trigger.kind === "file-arrival" ? a.trigger.folder : "",
  intervalMinutes: a.trigger.kind === "manual" ? 60 : a.trigger.intervalMinutes,
  profile: a.profile, count: a.count, minScore: a.minScore, campaignId: a.campaignId ?? "", useAi: a.useAi,
  requireApproval: a.requireApproval, render: a.render, requireTranscript: a.requireTranscript, enabled: a.enabled,
});
const toBody = (d: Draft) => ({
  id: d.id, name: d.name, enabled: d.enabled, profile: d.profile, count: d.count, minScore: d.minScore, useAi: d.useAi,
  requireApproval: d.requireApproval, render: d.render, requireTranscript: d.requireTranscript, campaignId: d.campaignId || undefined,
  trigger: d.kind === "manual" ? { kind: "manual" } : d.kind === "new-video" ? { kind: "new-video", creatorId: d.creatorId, intervalMinutes: d.intervalMinutes } : { kind: "file-arrival", folder: d.folder, intervalMinutes: d.intervalMinutes },
});

export function AutopilotPanel({ projects }: { projects: Project[] }) {
  const [aps, setAps] = useState<Autopilot[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [creators, setCreators] = useState<Creator[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [d, setD] = useState<Draft>(blank);
  const [target, setTarget] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const [a, r, c, k] = await Promise.all([api<Autopilot[]>("/api/autopilots"), api<Run[]>("/api/autopilot-runs"), api<Creator[]>("/api/creators"), api<Campaign[]>("/api/campaigns")]);
    setAps(a); setRuns(r); setCreators(c); setCampaigns(k);
  }, []);
  useEffect(() => {
    load().catch((e) => setError(String(e.message || e)));
    const t = setInterval(() => load().catch(() => {}), 5000);
    return () => clearInterval(t);
  }, [load]);
  const wrap = async (fn: () => Promise<void>) => { setBusy(true); setError(""); setMessage(""); try { await fn(); await load(); } catch (e) { setError(String(e instanceof Error ? e.message : e)); } finally { setBusy(false); } };
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));

  return (
    <div className="campaigns">
      <aside>
        <button className="button" onClick={() => setD(blank)}>New autopilot</button>
        <ul>{aps.map((a) => <li key={a.id}><button className={a.id === d.id ? "selected" : ""} onClick={() => setD(fromAp(a))}>{a.name}{a.enabled ? " ●" : ""}</button></li>)}</ul>
        {!aps.length && <p className="muted">No autopilots yet.</p>}
      </aside>
      <section>
        <h3>Autopilot</h3>
        <p className="muted">
          Imports, analyses, selects moments and renders clips, then saves them for your review. It never publishes anything. Automatic checks run only
          while Clipper Studio is running (and you have opened it since it started); nothing runs while the computer is off.
        </p>
        <div className="moment-controls">
          <label className="field">Name<input value={d.name} onChange={(e) => set("name", e.target.value)} /></label>
          <label className="field">Trigger
            <select value={d.kind} onChange={(e) => set("kind", e.target.value as Draft["kind"])}>
              <option value="manual">Manual</option><option value="new-video">New upload from a tracked creator</option><option value="file-arrival">New file in a folder</option>
            </select>
          </label>
          {d.kind === "new-video" && (
            <label className="field">Creator<select value={d.creatorId} onChange={(e) => set("creatorId", e.target.value)}><option value="">Choose…</option>{creators.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          )}
          {d.kind === "file-arrival" && <label className="field">Folder (absolute path)<input value={d.folder} onChange={(e) => set("folder", e.target.value)} /></label>}
          {d.kind !== "manual" && <label className="field">Check every (min)<input type="number" min={d.kind === "new-video" ? 30 : 1} value={d.intervalMinutes} onChange={(e) => set("intervalMinutes", +e.target.value || 1)} /></label>}
        </div>
        <div className="moment-controls">
          <label className="field">Content profile<input value={d.profile} onChange={(e) => set("profile", e.target.value)} /></label>
          <label className="field">Clips<input type="number" min={1} max={20} value={d.count} onChange={(e) => set("count", +e.target.value || 1)} /></label>
          <label className="field">Min score (0–1)<input type="number" step={0.05} min={0} max={1} value={d.minScore} onChange={(e) => set("minScore", +e.target.value)} /></label>
          <label className="field">Campaign<select value={d.campaignId} onChange={(e) => set("campaignId", e.target.value)}><option value="">None</option>{campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        </div>
        <fieldset className="moment-tracks">
          <legend>Options</legend>
          <label><input type="checkbox" checked={d.requireApproval} onChange={(e) => set("requireApproval", e.target.checked)} /> Ask me before rendering</label>
          <label><input type="checkbox" checked={d.render} onChange={(e) => set("render", e.target.checked)} /> Render clips</label>
          <label><input type="checkbox" checked={d.useAi} onChange={(e) => set("useAi", e.target.checked)} /> Rank with local Ollama</label>
          <label><input type="checkbox" checked={d.requireTranscript} onChange={(e) => set("requireTranscript", e.target.checked)} /> Stop if there is no transcript</label>
          <label><input type="checkbox" checked={d.enabled} onChange={(e) => set("enabled", e.target.checked)} /> Enabled (automatic triggers)</label>
        </fieldset>
        <div className="moment-controls">
          <button className="button primary" disabled={busy || !d.name} onClick={() => wrap(async () => { const s = await post<Autopilot>("/api/autopilots", toBody(d)); setD(fromAp(s)); setMessage("Saved. New-upload and folder triggers only process items that appear after saving."); })}>Save</button>
          {d.id && <button className="button" disabled={busy} onClick={() => wrap(async () => { if (!confirm("Delete this autopilot? Past runs and clips are kept.")) return; await api("/api/autopilots?id=" + d.id, { method: "DELETE" }); setD(blank); })}>Delete</button>}
          {d.id && (
            <>
              <label className="field">Run now on<select value={target} onChange={(e) => setTarget(e.target.value)}><option value="">Choose a project…</option>{projects.filter((p) => p.duration > 0).map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</select></label>
              <button className="button" disabled={busy || !target} onClick={() => wrap(async () => { await post("/api/autopilot-run", { id: d.id, projectId: target }); setMessage("Run started."); })}>Run</button>
            </>
          )}
          <button className="button" disabled={busy} onClick={() => wrap(async () => { const r = await post<{ id: string; started: number; note: string }[]>("/api/autopilot-check", {}); setMessage(r.length ? r.map((x) => `${x.started} started${x.note ? " — " + x.note : ""}`).join("; ") : "No autopilot is due."); })}>Check triggers now</button>
        </div>
        {message && <p role="status">{message}</p>}
        {error && <p role="alert">{error}</p>}
        <h3>Run history</h3>
        {!runs.length && <p className="muted">No runs yet.</p>}
        {runs.map((r) => (
          <details key={r.id} open={r.status === "awaiting-approval" || r.status === "running"}>
            <summary>{r.autopilotName} · {new Date(r.startedAt).toLocaleString()} · <strong>{r.status}</strong>{r.error ? ` — ${r.error}` : ""}</summary>
            <table className="moment-breakdown"><tbody>
              {r.steps.map((s) => <tr key={s.name}><td>{s.name}</td><td>{s.status}</td><td>{s.detail ?? ""}</td></tr>)}
            </tbody></table>
            {r.compliance && <p className="muted">Compliance: {r.compliance.filter((c) => c.fail === 0).length}/{r.compliance.length} clips with no failed checks; human review items remain.</p>}
            <div className="moment-controls">
              {r.status === "awaiting-approval" && (<>
                <button className="button primary" disabled={busy} onClick={() => wrap(async () => void (await post("/api/autopilot-approve", { run: r.id })))}>Approve and render</button>
                <button className="button" disabled={busy} onClick={() => wrap(async () => void (await post("/api/autopilot-approve", { run: r.id, reject: true })))}>Reject</button>
              </>)}
              {(r.status === "failed" || r.status === "cancelled") && <button className="button" disabled={busy} onClick={() => wrap(async () => void (await post("/api/autopilot-retry", { run: r.id })))}>Retry from last step</button>}
            </div>
          </details>
        ))}
      </section>
    </div>
  );
}
