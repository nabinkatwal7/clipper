"use client";
import { useCallback, useEffect, useState } from "react";
import type { HardwareProfile } from "@/lib/clipping/system";

type Snap = {
  at: string;
  cpu: { logicalCores: number; model: string; usagePercent: number | null };
  memory: { totalMb: number; freeMb: number; usedPercent: number; appRssMb: number };
  disk: { freeBytes: number; totalBytes: number } | null;
  ollama: { reachable: boolean; loaded: { name: string; sizeMb: number; vramMb: number }[] };
  queue: { active: string | null; queued: string[]; processing: { id: string; title: string; stage: string; detail: string }[] };
  profiles: HardwareProfile[];
  profile: string | null;
  recommended: string;
  health: { name: string; ok: boolean; detail: string }[];
};
type Enc = { encoder: string; listed: boolean; verified: boolean; detail: string };

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, init);
  const data = await r.json();
  if (!r.ok) throw Error(data.error || "Request failed");
  return data;
}
const gb = (b: number) => (b / 1024 ** 3).toFixed(1) + " GB";

export function SystemHealth() {
  const [s, setS] = useState<Snap | null>(null);
  const [enc, setEnc] = useState<Enc[] | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const load = useCallback(async () => setS(await api<Snap>("/api/system")), []);
  useEffect(() => {
    load().catch((e) => setError(String(e.message || e)));
    const t = setInterval(() => load().catch(() => {}), 4000);
    return () => clearInterval(t);
  }, [load]);

  async function choose(id: string) {
    setError(""); setMessage("");
    try {
      const ack = id === "performance" && s && s.memory.totalMb < 12000;
      if (ack && !confirm(`Performance is not recommended with ${Math.round(s.memory.totalMb / 1024)} GB RAM. Use it anyway?`)) return;
      await api("/api/hardware-profile", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ profile: id, acknowledge: !!ack }) });
      setMessage("Profile saved."); await load();
    } catch (e) { setError(String(e instanceof Error ? e.message : e)); }
  }
  async function testEncoders() {
    setError(""); setEnc(null);
    try { setEnc(await api<Enc[]>("/api/system-encoders?refresh=1")); } catch (e) { setError(String(e instanceof Error ? e.message : e)); }
  }
  if (!s) return <p className="muted">{error || "Measuring…"}</p>;
  return (
    <section className="system-health">
      <h3>System health</h3>
      <p className="muted">Values are measured on this machine at {new Date(s.at).toLocaleTimeString()} and refresh every few seconds.</p>
      <table className="moment-breakdown"><tbody>
        <tr><td>CPU</td><td>{s.cpu.usagePercent === null ? "not measurable" : s.cpu.usagePercent + "% busy"}</td><td>{s.cpu.model}, {s.cpu.logicalCores} logical cores</td></tr>
        <tr><td>Memory</td><td>{s.memory.usedPercent}% used</td><td>{(s.memory.freeMb / 1024).toFixed(1)} GB free of {(s.memory.totalMb / 1024).toFixed(1)} GB · Studio process {s.memory.appRssMb} MB</td></tr>
        <tr><td>Disk (workspace drive)</td><td>{s.disk ? gb(s.disk.freeBytes) + " free" : "not measurable"}</td><td>{s.disk ? "of " + gb(s.disk.totalBytes) : ""}</td></tr>
        <tr><td>Ollama</td><td>{s.ollama.reachable ? "running" : "not reachable"}</td><td>{s.ollama.loaded.length ? "loaded: " + s.ollama.loaded.map((m) => `${m.name} (${m.sizeMb} MB${m.vramMb ? ", " + m.vramMb + " MB GPU" : ""})`).join(", ") : s.ollama.reachable ? "no model currently loaded" : "optional; no-AI clipping works without it"}</td></tr>
        <tr><td>Job queue</td><td>{s.queue.active ? "1 running" : "idle"}{s.queue.queued.length ? `, ${s.queue.queued.length} waiting` : ""}</td><td>{s.queue.processing.map((p) => `${p.title}: ${p.detail}`).join(" · ")}</td></tr>
      </tbody></table>

      <h4>Dependencies</h4>
      <table className="moment-breakdown"><tbody>
        {s.health.map((h) => <tr key={h.name}><td>{h.name}</td><td>{h.ok ? "ok" : "missing"}</td><td>{h.detail}</td></tr>)}
      </tbody></table>

      <h4>Hardware encoding</h4>
      <p className="muted">&quot;Listed&quot; means the FFmpeg build includes the encoder. &quot;Verified&quot; means a real test encode just succeeded here.</p>
      <button className="button" onClick={testEncoders}>Run encoder test</button>
      {enc && <table className="moment-breakdown"><tbody>{enc.map((e) => <tr key={e.encoder}><td>{e.encoder}</td><td>{e.verified ? "verified" : e.listed ? "listed, failed" : "not available"}</td><td>{e.detail}</td></tr>)}</tbody></table>}

      <h4>Hardware profile</h4>
      <p className="muted">Recommended for this machine: <strong>{s.recommended}</strong>. Performance is never selected automatically.</p>
      <div className="moment-controls">
        {s.profiles.map((p) => (
          <label key={p.id} className="field" style={{ maxWidth: 260 }}>
            <span><input type="radio" name="hw" checked={s.profile === p.id} onChange={() => choose(p.id)} /> {p.label}{s.recommended === p.id ? " (recommended)" : ""}</span>
            <small className="muted">{p.note} Analysis every {p.analysisInterval}s · preview {p.previewHeight}p · model: {p.model}</small>
          </label>
        ))}
      </div>
      {!s.profile && <p className="muted">No profile chosen yet; defaults to Eco behaviour.</p>}
      {message && <p role="status">{message}</p>}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
