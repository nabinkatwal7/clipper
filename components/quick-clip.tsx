"use client";
import { useCallback, useEffect, useState } from "react";
import type { Project } from "@/lib/types";
import type { Run } from "@/lib/clipping/autopilot-core";
import type { ContentProfile } from "@/lib/clipping/profiles";
import type { Campaign } from "@/lib/clipping/campaigns";
import { PLATFORM_PRESETS } from "@/lib/clipping/postkit";

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, init);
  const data = await r.json();
  if (!r.ok) throw Error(data.error || "Request failed");
  return data;
}
const post = <T,>(url: string, body: unknown) => api<T>(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

const LANGS = [["auto", "Automatic"], ["en", "English"], ["ne", "Nepali"], ["hi", "Hindi"], ["ne-Latn", "Romanized Nepali"], ["hi-Latn", "Hinglish"], ["ur", "Urdu"], ["bn", "Bengali"], ["ar", "Arabic"], ["es", "Spanish"], ["pt", "Portuguese"], ["zh", "Chinese"], ["ja", "Japanese"], ["ko", "Korean"]] as const;
const DURATIONS = [["15-30", 15, 30], ["30-60", 30, 60], ["60-90", 60, 90]] as const;

/**
 * Express workflow. Same processing engine as Autopilot and the Moment finder: it imports,
 * analyses signals, selects moments and renders clips with sensible defaults.
 */
export function QuickClip({ projects, open }: { projects: Project[]; open: (id: string) => void }) {
  const [source, setSource] = useState<"url" | "path" | "project">("url");
  const [url, setUrl] = useState("");
  const [path, setPath] = useState("");
  const [projectId, setProjectId] = useState("");
  const [contentType, setContentType] = useState("general");
  const [count, setCount] = useState(5);
  const [duration, setDuration] = useState("30-60");
  const [language, setLanguage] = useState("auto");
  const [captions, setCaptions] = useState(true);
  const [mode, setMode] = useState<"instant" | "intelligent">("instant");
  const [ratio, setRatio] = useState("9:16");
  const [platform, setPlatform] = useState("generic-vertical");
  const [campaignId, setCampaignId] = useState("");
  const [profiles, setProfiles] = useState<ContentProfile[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [ollama, setOllama] = useState(false);
  const [runs, setRuns] = useState<Run[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const loadRuns = useCallback(async () => setRuns((await api<Run[]>("/api/autopilot-runs")).filter((r) => r.autopilotId === "quick-clip-default")), []);
  useEffect(() => {
    api<{ profiles: ContentProfile[]; models: { main: string | null } }>("/api/moment-profiles").then((m) => { setProfiles(m.profiles); setOllama(!!m.models.main); }).catch((e) => setError(e.message));
    api<Campaign[]>("/api/campaigns").then(setCampaigns).catch(() => {});
    loadRuns().catch(() => {});
    const t = setInterval(() => loadRuns().catch(() => {}), 3000);
    return () => clearInterval(t);
  }, [loadRuns]);

  const last = runs[0]; // the API returns newest first
  const project = last?.projectId ? projects.find((p) => p.id === last.projectId) : undefined;
  const active = last && (last.status === "running" || last.status === "awaiting-approval");
  const [, minD, maxD] = DURATIONS.find((d) => d[0] === duration) ?? DURATIONS[1];
  const preset = PLATFORM_PRESETS.find((p) => p.id === platform);
  const ready = source === "url" ? /^https?:\/\//i.test(url) : source === "path" ? path.length > 3 : !!projectId;

  async function go() {
    setBusy(true); setError("");
    try {
      await post("/api/quick-clip", {
        url: source === "url" ? url : undefined, path: source === "path" ? path : undefined, projectId: source === "project" ? projectId : undefined,
        contentType, count, minDuration: minD, maxDuration: maxD, language, captions, mode,
        ratio: preset?.settings.ratio ?? ratio, resolution: preset?.settings.resolution ?? "1080", campaignId: campaignId || undefined,
      });
      await loadRuns();
    } catch (e) { setError(String(e instanceof Error ? e.message : e)); } finally { setBusy(false); }
  }

  return (
    <div className="quick-clip">
      <h3>Quick Clip</h3>
      <p className="muted">Paste a link or choose a recording, pick a type, and get a set of vertical clips to review. Works without AI; no accounts or API keys. Only import media you own or have permission to use.</p>

      <fieldset className="moment-tracks">
        <legend>1. Source</legend>
        {(["url", "path", "project"] as const).map((k) => (
          <label key={k}><input type="radio" name="qc-source" checked={source === k} onChange={() => setSource(k)} /> {k === "url" ? "Video URL" : k === "path" ? "File on this computer" : "Already imported"}</label>
        ))}
      </fieldset>
      {source === "url" && <label className="field">URL (needs internet)<input value={url} placeholder="https://…" onChange={(e) => setUrl(e.target.value)} /></label>}
      {source === "path" && <label className="field">Full path to a video file<input value={path} placeholder="C:\Videos\stream.mp4" onChange={(e) => setPath(e.target.value)} /></label>}
      {source === "project" && (
        <label className="field">Project<select value={projectId} onChange={(e) => setProjectId(e.target.value)}><option value="">Choose…</option>{projects.filter((p) => p.duration > 0).map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</select></label>
      )}

      <div className="moment-controls">
        <label className="field">2. Content type<select value={contentType} onChange={(e) => setContentType(e.target.value)}>{profiles.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</select></label>
        <label className="field">3. Clips<input type="number" min={1} max={20} value={count} onChange={(e) => setCount(Math.max(1, Math.min(20, +e.target.value || 1)))} /></label>
        <label className="field">4. Length<select value={duration} onChange={(e) => setDuration(e.target.value)}>{DURATIONS.map((d) => <option key={d[0]} value={d[0]}>{d[0].replace("-", "–")} seconds</option>)}</select></label>
        <label className="field">5. Language<select value={language} onChange={(e) => setLanguage(e.target.value)}>{LANGS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
      </div>
      <div className="moment-controls">
        <label><input type="checkbox" checked={captions} onChange={(e) => setCaptions(e.target.checked)} /> 6. Captions from available subtitles</label>
        <label className="field">7. Mode
          <select value={mode} onChange={(e) => setMode(e.target.value as "instant" | "intelligent")}>
            <option value="instant">Instant — no AI</option>
            <option value="intelligent" disabled={!ollama}>Intelligent — local Ollama{ollama ? "" : " (not available)"}</option>
          </select>
        </label>
        <button className="button primary" disabled={busy || !!active || !ready} onClick={go}>8. Generate clips</button>
      </div>
      <details>
        <summary>Advanced</summary>
        <div className="moment-controls">
          <label className="field">Platform preset<select value={platform} onChange={(e) => setPlatform(e.target.value)}>{PLATFORM_PRESETS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</select></label>
          <label className="field">Campaign<select value={campaignId} onChange={(e) => setCampaignId(e.target.value)}><option value="">None</option>{campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          <label className="field">Aspect ratio (overridden by preset)<select value={ratio} onChange={(e) => setRatio(e.target.value)}>{["9:16", "1:1", "4:5", "16:9"].map((r) => <option key={r}>{r}</option>)}</select></label>
        </div>
        <p className="muted">{preset?.note} For signal weights, boundaries and models use the Moment finder or Autopilot.</p>
      </details>
      {error && <p role="alert">{error}</p>}

      {last && (
        <section aria-label="Progress and results">
          <h4>{active ? "Working…" : last.status === "done" ? "9. Review results" : last.status === "failed" ? "Something went wrong" : "Stopped"}</h4>
          <table className="moment-breakdown"><tbody>{last.steps.map((s) => <tr key={s.name}><td>{s.name}</td><td>{s.status}</td><td>{s.detail ?? ""}</td></tr>)}</tbody></table>
          {last.error && <p role="alert">{last.error}</p>}
          {last.status === "failed" && <button className="button" onClick={() => post("/api/autopilot-retry", { run: last.id }).then(loadRuns).catch((e) => setError(e.message))}>Retry from the failed step</button>}
          {last.status === "done" && project && (
            project.clips.length ? (
              <div className="quick-results">
                {project.clips.map((c) => (
                  <figure key={c.id}>
                    <video controls preload="metadata" poster={`/api/download?project=${project.id}&clip=${c.id}&kind=poster`} src={`/api/download?project=${project.id}&clip=${c.id}`} />
                    <figcaption>
                      <strong>{c.title}</strong>
                      <small>{Math.round(c.end - c.start)}s · source {Math.floor(c.start / 60)}:{String(Math.floor(c.start % 60)).padStart(2, "0")} · measured score {c.score ?? "—"}{c.qa?.warnings.length ? ` · ${c.qa.warnings.length} render warning(s)` : ""}</small>
                      <span className="moment-actions">
                        <a className="button" download={`${c.title}.mp4`} href={`/api/download?project=${project.id}&clip=${c.id}`}>Download</a>
                        <button onClick={() => open(project.id)}>Open in editor</button>
                      </span>
                    </figcaption>
                  </figure>
                ))}
              </div>
            ) : <p className="muted">The run finished without rendering clips: {last.steps.find((s) => s.status === "skipped" && s.detail)?.detail ?? "no moments met the requirements"}.</p>
          )}
        </section>
      )}
    </div>
  );
}
