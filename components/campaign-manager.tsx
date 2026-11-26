"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Project } from "@/lib/types";
import type { Campaign, ComplianceReport } from "@/lib/clipping/campaigns";
import type { ContentProfile } from "@/lib/clipping/profiles";
import { SIGNAL_IDS } from "@/lib/clipping/profiles";

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, init);
  const data = await r.json();
  if (!r.ok) throw Error(data.error || "Request failed");
  return data;
}
const post = (url: string, body: unknown) => api<never>(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const csv = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);
const blank = (): Partial<Campaign> => ({
  name: "", description: "", creators: [], categories: [], languages: [], audience: "", minDuration: 30, maxDuration: 60, minScore: 0, template: "",
  layout: "any", ratio: "9:16", minHeight: 0, captions: { required: false, languages: [] }, originalAudio: false,
  branding: { watermarkRequired: false, watermarkText: "" }, attribution: { required: false, text: "" }, requiredMetadata: [],
  requiredHashtags: [], excludedWords: [], reviewRequired: true, exportPlatform: "", notes: "",
});

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="field">{label}{children}</label>;
}

export function CampaignManager({ projects }: { projects: Project[] }) {
  const [rows, setRows] = useState<Campaign[]>([]);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<Partial<Campaign>>(blank());
  const [brief, setBrief] = useState("");
  const [proposal, setProposal] = useState<{ model: string; proposal: Partial<Campaign>; dropped: string[] } | null>(null);
  const [project, setProject] = useState("");
  const [reports, setReports] = useState<{ clip: string; title: string; report: ComplianceReport }[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => setRows(await api<Campaign[]>("/api/campaigns")), []);
  useEffect(() => { load().catch((e) => setError(String(e.message || e))); }, [load]);
  const shown = useMemo(() => rows.filter((r) => r.name.toLowerCase().includes(query.toLowerCase())), [rows, query]);
  const set = <K extends keyof Campaign>(k: K, v: Campaign[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const wrap = async (fn: () => Promise<void>) => { setBusy(true); setError(""); setMessage(""); try { await fn(); } catch (e) { setError(String(e instanceof Error ? e.message : e)); } finally { setBusy(false); } };

  const save = () => wrap(async () => {
    const saved = await post("/api/campaigns", draft) as Campaign;
    setDraft(saved); setMessage("Campaign saved."); await load();
  });
  const del = () => wrap(async () => {
    if (!draft.id || !confirm("Delete this campaign? Generated clips are not affected.")) return;
    await api("/api/campaigns?id=" + draft.id, { method: "DELETE" });
    setDraft(blank()); await load();
  });
  const importBrief = () => wrap(async () => setProposal(await post("/api/campaign-import", { text: brief })));
  const check = () => wrap(async () => {
    if (!draft.id || !project) throw Error("Save the campaign and choose a project first.");
    setReports(await post("/api/campaign-compliance", { campaign: draft.id, project }));
  });
  const caps = draft.captions ?? { required: false, languages: [] };

  return (
    <div className="campaigns">
      <aside>
        <input type="search" placeholder="Search campaigns" aria-label="Search campaigns" value={query} onChange={(e) => setQuery(e.target.value)} />
        <button className="button" onClick={() => { setDraft(blank()); setReports([]); }}>New campaign</button>
        <ul>{shown.map((c) => (
          <li key={c.id}><button className={c.id === draft.id ? "selected" : ""} onClick={() => { setDraft(c); setReports([]); }}>{c.name}</button></li>
        ))}</ul>
        {!shown.length && <p className="muted">No campaigns yet.</p>}
      </aside>
      <section>
        <h3>{draft.id ? "Edit campaign" : "New campaign"}</h3>
        <details>
          <summary>Import from pasted instructions (uses local Ollama)</summary>
          <p className="muted">The text is treated as data. Extracted rules are shown for review and are never saved automatically.</p>
          <textarea rows={4} value={brief} onChange={(e) => setBrief(e.target.value)} aria-label="Campaign instructions" />
          <button className="button" disabled={busy || brief.trim().length < 10} onClick={importBrief}>Extract rules</button>
          {proposal && (
            <div role="region" aria-label="Proposed rules">
              <p>Proposed by {proposal.model}{proposal.dropped.length ? ` · ignored invalid fields: ${proposal.dropped.join(", ")}` : ""}</p>
              <pre>{JSON.stringify(proposal.proposal, null, 2)}</pre>
              <button className="button" onClick={() => { setDraft((d) => ({ ...d, ...proposal.proposal })); setProposal(null); setMessage("Rules copied into the form. Review, then save."); }}>Apply to form</button>
              <button className="button" onClick={() => setProposal(null)}>Discard</button>
            </div>
          )}
        </details>
        <div className="moment-controls">
          <Field label="Name"><input value={draft.name ?? ""} onChange={(e) => set("name", e.target.value)} /></Field>
          <Field label="Min duration (s)"><input type="number" value={draft.minDuration ?? 30} onChange={(e) => set("minDuration", +e.target.value)} /></Field>
          <Field label="Max duration (s)"><input type="number" value={draft.maxDuration ?? 60} onChange={(e) => set("maxDuration", +e.target.value)} /></Field>
          <Field label="Min moment score"><input type="number" min={0} max={100} value={draft.minScore ?? 0} onChange={(e) => set("minScore", +e.target.value)} /></Field>
          <Field label="Aspect ratio"><select value={draft.ratio} onChange={(e) => set("ratio", e.target.value as Campaign["ratio"])}>{["9:16", "1:1", "4:5", "16:9", "any"].map((x) => <option key={x}>{x}</option>)}</select></Field>
          <Field label="Layout"><select value={draft.layout} onChange={(e) => set("layout", e.target.value as Campaign["layout"])}>{["any", "center", "blur", "crop", "facecam", "original"].map((x) => <option key={x}>{x}</option>)}</select></Field>
          <Field label="Min height (px)"><input type="number" value={draft.minHeight ?? 0} onChange={(e) => set("minHeight", +e.target.value)} /></Field>
        </div>
        <Field label="Description"><textarea rows={2} value={draft.description ?? ""} onChange={(e) => set("description", e.target.value)} /></Field>
        <div className="moment-controls">
          <Field label="Authorized creators (comma separated)"><input value={(draft.creators ?? []).join(", ")} onChange={(e) => set("creators", csv(e.target.value))} /></Field>
          <Field label="Required hashtags"><input value={(draft.requiredHashtags ?? []).join(", ")} onChange={(e) => set("requiredHashtags", csv(e.target.value))} /></Field>
          <Field label="Excluded words"><input value={(draft.excludedWords ?? []).join(", ")} onChange={(e) => set("excludedWords", csv(e.target.value))} /></Field>
          <Field label="Caption languages"><input value={caps.languages.join(", ")} onChange={(e) => set("captions", { ...caps, languages: csv(e.target.value) })} /></Field>
          <Field label="Watermark text"><input value={draft.branding?.watermarkText ?? ""} onChange={(e) => set("branding", { watermarkRequired: !!e.target.value || !!draft.branding?.watermarkRequired, watermarkText: e.target.value })} /></Field>
          <Field label="Attribution text"><input value={draft.attribution?.text ?? ""} onChange={(e) => set("attribution", { required: !!e.target.value || !!draft.attribution?.required, text: e.target.value })} /></Field>
        </div>
        <fieldset className="moment-tracks">
          <legend>Requirements</legend>
          <label><input type="checkbox" checked={caps.required} onChange={(e) => set("captions", { ...caps, required: e.target.checked })} /> Captions</label>
          <label><input type="checkbox" checked={!!draft.originalAudio} onChange={(e) => set("originalAudio", e.target.checked)} /> Keep original audio</label>
          <label><input type="checkbox" checked={!!draft.reviewRequired} onChange={(e) => set("reviewRequired", e.target.checked)} /> Human review</label>
          {(["title", "description", "hashtags"] as const).map((m) => (
            <label key={m}><input type="checkbox" checked={(draft.requiredMetadata ?? []).includes(m)} onChange={(e) => set("requiredMetadata", e.target.checked ? [...(draft.requiredMetadata ?? []), m] : (draft.requiredMetadata ?? []).filter((x) => x !== m))} /> {m} required</label>
          ))}
        </fieldset>
        <div className="moment-controls">
          <button className="button primary" disabled={busy || !draft.name} onClick={save}>Save campaign</button>
          {draft.id && <button className="button" disabled={busy} onClick={del}>Delete</button>}
        </div>
        {message && <p role="status">{message}</p>}
        {error && <p role="alert">{error}</p>}
        {draft.id && (
          <>
            <h3>Compliance</h3>
            <div className="moment-controls">
              <Field label="Project"><select value={project} onChange={(e) => setProject(e.target.value)}><option value="">Choose…</option>{projects.filter((p) => p.clips.length).map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</select></Field>
              <button className="button" disabled={busy || !project} onClick={check}>Check clips</button>
            </div>
            {reports.map((r) => (
              <table key={r.clip} className="moment-breakdown">
                <caption>{r.title} — {r.report.summary.pass} pass · {r.report.summary.fail} fail · {r.report.summary.needsReview} need review</caption>
                <tbody>{r.report.checks.map((c) => (
                  <tr key={c.id}><td>{c.label}</td><td>{c.status}{c.automatic ? "" : " (human)"}</td><td>{c.detail}</td></tr>
                ))}</tbody>
              </table>
            ))}
          </>
        )}
      </section>
    </div>
  );
}

const blankProfile = (): ContentProfile => ({
  schemaVersion: 1, id: "my-profile", label: "My profile", version: 1,
  weights: { audio: 0.25, chat: 0.2, replay: 0.2, hype: 0.15, visual: 0.1, speech: 0.1 },
  minDuration: 20, maxDuration: 60, preContext: 6, postContext: 8, minScore: 0.3, minSpacing: 20, boundary: "transcript-first", layout: "center",
});

/** Versioned custom content profiles, saved as JSON presets in the workspace. */
export function ProfileBuilder() {
  const [rows, setRows] = useState<ContentProfile[]>([]);
  const [p, setP] = useState<ContentProfile>(blankProfile());
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const load = useCallback(async () => setRows(await api<ContentProfile[]>("/api/profiles")), []);
  useEffect(() => { load().catch((e) => setError(String(e.message || e))); }, [load]);
  const num = (k: keyof ContentProfile) => (e: React.ChangeEvent<HTMLInputElement>) => setP({ ...p, [k]: +e.target.value });
  async function save() {
    setError(""); setMessage("");
    try { const s = await post("/api/profiles", p) as ContentProfile; setP(s); setMessage(`Saved as version ${s.version}.`); await load(); }
    catch (e) { setError(String(e instanceof Error ? e.message : e)); }
  }
  return (
    <section className="profile-builder">
      <h3>Custom content profiles</h3>
      <p className="muted">Saved profiles appear in the Moment finder&apos;s content type list. Weights are redistributed over the signals actually available.</p>
      <div className="moment-controls">
        <label className="field">Load<select value="" onChange={(e) => { const f = rows.find((r) => r.id === e.target.value); if (f) setP(f); }}><option value="">Saved profiles…</option>{rows.map((r) => <option key={r.id} value={r.id}>{r.label} (v{r.version})</option>)}</select></label>
        <Field label="Id (a-z, 0-9, -)"><input value={p.id} onChange={(e) => setP({ ...p, id: e.target.value.toLowerCase() })} /></Field>
        <Field label="Name"><input value={p.label} onChange={(e) => setP({ ...p, label: e.target.value })} /></Field>
        <Field label="Boundaries"><select value={p.boundary} onChange={(e) => setP({ ...p, boundary: e.target.value as ContentProfile["boundary"] })}><option>transcript-first</option><option>media-first</option></select></Field>
      </div>
      <div className="moment-controls">
        {SIGNAL_IDS.map((s) => (
          <Field key={s} label={`${s} weight`}><input type="number" step={0.05} min={0} max={1} value={p.weights[s]} onChange={(e) => setP({ ...p, weights: { ...p.weights, [s]: +e.target.value } })} /></Field>
        ))}
      </div>
      <div className="moment-controls">
        <Field label="Min duration"><input type="number" value={p.minDuration} onChange={num("minDuration")} /></Field>
        <Field label="Max duration"><input type="number" value={p.maxDuration} onChange={num("maxDuration")} /></Field>
        <Field label="Pre-context (s)"><input type="number" value={p.preContext} onChange={num("preContext")} /></Field>
        <Field label="Post-context (s)"><input type="number" value={p.postContext} onChange={num("postContext")} /></Field>
        <Field label="Min score (0–1)"><input type="number" step={0.05} value={p.minScore} onChange={num("minScore")} /></Field>
        <Field label="Min spacing (s)"><input type="number" value={p.minSpacing} onChange={num("minSpacing")} /></Field>
        <Field label="Include words"><input value={(p.includeWords ?? []).join(", ")} onChange={(e) => setP({ ...p, includeWords: csv(e.target.value) })} /></Field>
        <Field label="Exclude words"><input value={(p.excludeWords ?? []).join(", ")} onChange={(e) => setP({ ...p, excludeWords: csv(e.target.value) })} /></Field>
      </div>
      <button className="button primary" onClick={save}>Save profile</button>
      {message && <p role="status">{message}</p>}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
