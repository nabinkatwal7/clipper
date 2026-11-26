"use client";
import { useCallback, useEffect, useState } from "react";

type Cat = { category: string; bytes: number; count: number; regenerable: boolean };
type Report = { categories: Cat[]; settings: { policy: string; cacheLimitMb?: number; cacheDays?: number }; policies: string[]; freeBytes: number | null };
type PlanItem = { id: string; name: string; bytes: number; category: string; reason: string };
type Plan = { items: PlanItem[]; blocked: { name: string; reason: string }[]; bytes: number; totalItems: number };
type Request = { kind: "cache"; olderThanDays?: number; limitMb?: number } | { kind: "policy"; policy: string };

const mb = (n: number) => (n / 1048576).toFixed(1) + " MB";
const POLICY_TEXT: Record<string, string> = {
  preserve: "Keep everything: sources, assets and generated files.",
  production: "Keep sources. Remove incomplete temporary files and extracted audio of finished projects.",
  "space-saver": "Also remove rebuildable caches, but only for projects whose clips passed render checks.",
  temporary: "Also remove downloaded sources that can be fetched again, only when nothing else depends on them.",
  archive: "Archive mode never deletes. Use Backups to package projects.",
};

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, init);
  const data = await r.json();
  if (!r.ok) throw Error(data.error || "Request failed");
  return data;
}
const post = <T,>(url: string, body: unknown) => api<T>(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

export function StorageManager() {
  const [rep, setRep] = useState<Report | null>(null);
  const [policy, setPolicy] = useState("production");
  const [days, setDays] = useState(30);
  const [limit, setLimit] = useState(2048);
  const [req, setReq] = useState<Request | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [allowSources, setAllowSources] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const r = await api<Report>("/api/storage-report");
    setRep(r);
    setPolicy(r.settings.policy);
  }, []);
  useEffect(() => { load().catch((e) => setError(String(e.message || e))); }, [load]);
  const wrap = async (fn: () => Promise<void>) => { setBusy(true); setError(""); setMessage(""); try { await fn(); } catch (e) { setError(String(e instanceof Error ? e.message : e)); } finally { setBusy(false); } };
  const preview = (r: Request) => wrap(async () => { setReq(r); setAllowSources(false); setPlan(await post<Plan>("/api/storage-plan", r)); });
  const run = () => wrap(async () => {
    if (!req || !plan) return;
    const r = await post<{ removed: number; freed: number; failed: string[] }>("/api/storage-execute", { ...req, confirm: true, authorizeSources: allowSources });
    setMessage(`Removed ${r.removed} file(s), freed ${mb(r.freed)}.${r.failed.length ? " Not removed: " + r.failed.join("; ") : ""}`);
    setPlan(null); setReq(null);
    await load();
  });
  const hasSource = plan?.items.some((i) => i.category === "source");

  return (
    <section className="storage-manager">
      <h3>Storage policy and cache</h3>
      {rep && (
        <table className="moment-breakdown">
          <caption>Measured from files on disk{rep.freeBytes !== null ? ` · ${(rep.freeBytes / 1024 ** 3).toFixed(1)} GB free` : ""}</caption>
          <thead><tr><th>Category</th><th>Files</th><th>Size</th><th>Rebuildable</th></tr></thead>
          <tbody>{rep.categories.map((c) => <tr key={c.category}><td>{c.category}</td><td>{c.count}</td><td>{mb(c.bytes)}</td><td>{c.regenerable ? "yes" : "no"}</td></tr>)}</tbody>
        </table>
      )}
      <div className="moment-controls">
        <label className="field">Policy
          <select value={policy} onChange={(e) => setPolicy(e.target.value)}>{(rep?.policies ?? []).map((p) => <option key={p}>{p}</option>)}</select>
        </label>
        <button className="button" disabled={busy} onClick={() => wrap(async () => { await post("/api/storage-settings", { policy, cacheDays: days, cacheLimitMb: limit }); setMessage("Policy saved. Nothing is deleted until you review and confirm a preview."); await load(); })}>Save policy</button>
        <button className="button" disabled={busy} onClick={() => preview({ kind: "policy", policy })}>Preview cleanup for this policy</button>
      </div>
      <p className="muted">{POLICY_TEXT[policy]}</p>
      <div className="moment-controls">
        <label className="field">Delete caches older than (days)<input type="number" min={1} value={days} onChange={(e) => setDays(+e.target.value || 1)} /></label>
        <label className="field">Cache size limit (MB)<input type="number" min={0} value={limit} onChange={(e) => setLimit(+e.target.value || 0)} /></label>
        <button className="button" disabled={busy} onClick={() => preview({ kind: "cache", olderThanDays: days, limitMb: limit })}>Preview cache cleanup</button>
      </div>
      {message && <p role="status">{message}</p>}
      {error && <p role="alert">{error}</p>}
      {plan && (
        <div role="region" aria-label="Cleanup preview">
          <p><strong>{plan.totalItems} file(s), {mb(plan.bytes)} would be removed.</strong> Nothing has been deleted yet.</p>
          <table className="moment-breakdown">
            <tbody>{plan.items.slice(0, 100).map((i) => <tr key={i.id}><td>{i.name}</td><td>{mb(i.bytes)}</td><td>{i.reason}</td></tr>)}</tbody>
          </table>
          {plan.totalItems > 100 && <p className="muted">…and {plan.totalItems - 100} more.</p>}
          {plan.blocked.length > 0 && (
            <details><summary>{plan.blocked.length} kept because of dependencies</summary>
              <ul>{plan.blocked.slice(0, 50).map((b, i) => <li key={i}>{b.name} — {b.reason}</li>)}</ul>
            </details>
          )}
          {hasSource && <label><input type="checkbox" checked={allowSources} onChange={(e) => setAllowSources(e.target.checked)} /> I authorise deleting the downloaded sources listed above. They can be downloaded again from their URLs.</label>}
          <div className="moment-controls">
            <button className="button primary" disabled={busy || plan.totalItems === 0 || (!!hasSource && !allowSources)} onClick={run}>Delete {plan.totalItems} file(s)</button>
            <button className="button" onClick={() => { setPlan(null); setReq(null); }}>Cancel</button>
          </div>
        </div>
      )}
    </section>
  );
}
