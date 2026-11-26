"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Project } from "@/lib/types";
import type { MomentsResult } from "@/lib/clipping/engine";
import type { ContentProfile } from "@/lib/clipping/profiles";
import { duration as fmt } from "./studio-media";

type Meta = { profiles: ContentProfile[]; defaultWeights: Record<string, number> };
type Reply = { result: MomentsResult | null; hasChat: boolean; hasReplay: boolean };
const TRACKS = [
  ["combined", "Moment score"],
  ["audio", "Audio activity"],
  ["chat", "Chat activity"],
  ["replay", "Replay intensity"],
  ["visual", "Visual activity"],
  ["hype", "Hype words"],
  ["speech", "Speech pacing"],
] as const;
const TRACK_H = 34;

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, init);
  const data = await r.json();
  if (!r.ok) throw Error(data.error || "Request failed");
  return data;
}

/** Heatmap of the measured tracks. Draws only data returned by the analysis. */
function Heatmap({
  result,
  zoom,
  hidden,
  selected,
  onSeek,
  onPick,
}: {
  result: MomentsResult;
  zoom: number;
  hidden: Set<string>;
  selected?: string;
  onSeek: (t: number) => void;
  onPick: (id: string) => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [hover, setHover] = useState<{ x: number; text: string } | null>(null);
  const rows = TRACKS.filter(([k]) => result.tracks[k] && !hidden.has(k));
  const width = Math.max(600, Math.round(result.duration * zoom));
  const height = rows.length * TRACK_H + 14;
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = width * dpr;
    c.height = height * dpr;
    const g = c.getContext("2d")!;
    g.scale(dpr, dpr);
    g.clearRect(0, 0, width, height);
    const style = getComputedStyle(c);
    const accent = style.getPropertyValue("--accent").trim() || "#4f8cff";
    const line = style.getPropertyValue("--line").trim() || "#8884";
    const ink = style.getPropertyValue("--ink").trim() || "#888";
    rows.forEach(([key], r) => {
      const v = result.tracks[key]!;
      const y = r * TRACK_H;
      g.fillStyle = line;
      g.fillRect(0, y + TRACK_H - 1, width, 1);
      g.fillStyle = accent;
      const bw = Math.max(1, width / v.length);
      for (let i = 0; i < v.length; i++) {
        const h = Math.max(0, Math.min(1, v[i])) * (TRACK_H - 6);
        if (h > 0.5) g.fillRect(i * bw, y + TRACK_H - 3 - h, Math.max(1, bw - 0.3), h);
      }
    });
    for (const c2 of result.candidates) {
      const x = (c2.start / result.duration) * width;
      const w = ((c2.end - c2.start) / result.duration) * width;
      g.fillStyle = c2.id === selected ? "rgba(255,180,0,.28)" : "rgba(255,180,0,.12)";
      g.fillRect(x, 0, w, height - 14);
      g.strokeStyle = "rgba(255,180,0,.9)";
      g.strokeRect(x + 0.5, 0.5, w, height - 15);
    }
    g.fillStyle = ink;
    g.font = "10px system-ui";
    const step = Math.max(30, Math.ceil(60 / zoom / 10) * 10 * 10);
    for (let t = 0; t < result.duration; t += step) g.fillText(fmt(t), (t / result.duration) * width + 2, height - 3);
  }, [result, rows, width, height, selected]);

  function at(e: React.MouseEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    return { x, t: (x / width) * result.duration, row: Math.floor((e.clientY - rect.top) / TRACK_H) };
  }
  return (
    <div className="moment-heat-scroll">
      <div style={{ position: "relative", width }}>
        <canvas
          ref={ref}
          style={{ width, height, display: "block", cursor: "pointer" }}
          role="img"
          aria-label="Measured signal tracks across the recording. Click to seek; amber ranges are candidate clips."
          onClick={(e) => {
            const { t } = at(e);
            const hit = result.candidates.find((c) => t >= c.start && t <= c.end);
            if (hit) onPick(hit.id);
            onSeek(t);
          }}
          onMouseMove={(e) => {
            const { x, t, row } = at(e);
            const key = rows[row]?.[0];
            const arr = key && result.tracks[key];
            if (!arr) return setHover(null);
            const v = arr[Math.min(arr.length - 1, Math.floor(t / result.interval))];
            setHover({ x, text: `${fmt(t)} · ${rows[row][1]} ${Math.round(v * 100)}` });
          }}
          onMouseLeave={() => setHover(null)}
        />
        {hover && (
          <div className="moment-tip" style={{ left: Math.min(hover.x + 8, width - 150) }}>
            {hover.text}
          </div>
        )}
      </div>
    </div>
  );
}

export default function MomentExplorer({ project, seek }: { project: Project; seek: (s: number) => void }) {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [data, setData] = useState<Reply | null>(null);
  const [profile, setProfile] = useState("general");
  const [count, setCount] = useState(5);
  const [interval, setIntervalSec] = useState(1);
  const [chatOffset, setChatOffset] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [focus, setFocus] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const running = project.status === "processing" || project.status === "queued";

  const load = useCallback(async () => {
    try {
      setData(await api<Reply>("/api/moments?project=" + project.id));
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    }
  }, [project.id]);
  useEffect(() => {
    void load();
  }, [load, project.updatedAt]);
  useEffect(() => {
    api<Meta>("/api/moment-profiles").then(setMeta).catch((e) => setError(String(e.message || e)));
  }, []);

  async function analyze() {
    setBusy(true), setError(""), setMessage("");
    try {
      await api("/api/moments?project=" + project.id, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile, count, interval, chatOffset }),
      });
      setMessage("Analysis queued. Progress appears in the processing queue.");
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setBusy(false);
    }
  }
  async function importFile(kind: "chat" | "replay", f?: File) {
    if (!f) return;
    setError(""), setMessage("");
    try {
      const text = await f.text();
      const r = await api<{ messages?: number; points?: number; skipped?: number }>("/api/moments-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project: project.id, kind, text, format: f.name.endsWith(".csv") ? "csv" : "auto" }),
      });
      setMessage(
        kind === "chat"
          ? `Imported ${r.messages} chat messages${r.skipped ? ` (${r.skipped} unreadable rows skipped)` : ""}. Re-run analysis to use them.`
          : `Imported ${r.points} heatmap points. Re-run analysis to use them.`,
      );
      await load();
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    }
  }
  async function render() {
    const result = data?.result;
    if (!result || !picked.size) return;
    setBusy(true), setError("");
    try {
      const ranges = result.candidates
        .filter((c) => picked.has(c.id))
        .map((c) => ({ start: c.start, end: c.end, title: `Moment ${c.id.slice(1)}` }));
      await api("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project: project.id, ranges }),
      });
      setMessage(`${ranges.length} clips queued for rendering.`);
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setBusy(false);
    }
  }

  const result = data?.result;
  const chosen = useMemo(() => result?.candidates.find((c) => c.id === focus), [result, focus]);
  const visibleTracks = TRACKS.filter(([k]) => result?.tracks[k]);

  return (
    <section className="moment-explorer" aria-labelledby="moment-title">
      <h3 id="moment-title">Moment finder — no AI required</h3>
      <p className="muted">
        Scores are computed from measured audio, motion, transcript, chat and replay data, relative to this recording. They rank moments to review;
        they are not predictions of audience performance.
      </p>
      <div className="moment-controls">
        <label className="field">
          Content type
          <select value={profile} onChange={(e) => setProfile(e.target.value)}>
            {(meta?.profiles ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Clips
          <input type="number" min={1} max={20} value={count} onChange={(e) => setCount(Math.max(1, Math.min(20, +e.target.value || 1)))} />
        </label>
        <label className="field">
          Interval
          <select value={interval} onChange={(e) => setIntervalSec(+e.target.value)}>
            {[1, 2, 5, 10].map((s) => (
              <option key={s} value={s}>
                {s}s{s > 1 ? " (low resource)" : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Chat offset (s)
          <input type="number" value={chatOffset} onChange={(e) => setChatOffset(+e.target.value || 0)} />
        </label>
        <button className="button primary" disabled={busy || running || !project.duration} onClick={analyze}>
          {result ? "Re-analyze" : "Find moments"}
        </button>
      </div>
      <div className="moment-controls">
        <label className="field">
          Chat log (JSON or CSV){data?.hasChat ? " ✓ imported" : ""}
          <input type="file" accept=".json,.csv" onChange={(e) => importFile("chat", e.target.files?.[0])} />
        </label>
        <label className="field">
          Replay heatmap (JSON){data?.hasReplay ? " ✓ imported" : ""}
          <input type="file" accept=".json" onChange={(e) => importFile("replay", e.target.files?.[0])} />
        </label>
      </div>
      {message && <p role="status">{message}</p>}
      {error && <p role="alert">{error}</p>}
      {running && <p role="status">{project.detail}</p>}

      {result && (
        <>
          <div className="moment-controls">
            <label className="field">
              Zoom
              <input type="range" min={0.5} max={12} step={0.5} value={zoom} onChange={(e) => setZoom(+e.target.value)} />
            </label>
            <fieldset className="moment-tracks">
              <legend>Tracks</legend>
              {visibleTracks.map(([k, label]) => (
                <label key={k}>
                  <input
                    type="checkbox"
                    checked={!hidden.has(k)}
                    onChange={() => setHidden((h) => (h.has(k) ? new Set([...h].filter((x) => x !== k)) : new Set(h).add(k)))}
                  />{" "}
                  {label}
                </label>
              ))}
            </fieldset>
          </div>
          <div className="moment-labels" aria-hidden>
            {visibleTracks.filter(([k]) => !hidden.has(k)).map(([k, label]) => (
              <span key={k} style={{ height: TRACK_H }}>
                {label}
              </span>
            ))}
          </div>
          <Heatmap result={result} zoom={zoom} hidden={hidden} selected={focus} onSeek={seek} onPick={setFocus} />
          <p className="muted">
            Used: {result.used.join(", ") || "none"}
            {result.missing.length ? ` · not available: ${result.missing.join(", ")}` : ""}
            {result.uninformative.length ? ` · flat (ignored): ${result.uninformative.join(", ")}` : ""}
          </p>
          {result.warnings.length > 0 && (
            <ul className="moment-warnings">
              {result.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          )}
          <ol className="moment-list">
            {result.candidates.map((c) => (
              <li key={c.id} className={c.id === focus ? "selected" : ""}>
                <input
                  type="checkbox"
                  aria-label={`Select moment ${c.id.slice(1)} for rendering`}
                  checked={picked.has(c.id)}
                  onChange={() => setPicked((p) => (p.has(c.id) ? new Set([...p].filter((x) => x !== c.id)) : new Set(p).add(c.id)))}
                />
                <button
                  className="moment-row"
                  onClick={() => {
                    setFocus(c.id);
                    seek(c.start);
                  }}
                >
                  <strong>
                    {fmt(c.start)}–{fmt(c.end)}
                  </strong>{" "}
                  · {Math.round(c.end - c.start)}s · score {Math.round(c.score * 100)}
                  <small>
                    {" "}
                    · edges: {c.precision}
                    {c.notes.length ? ` (${c.notes.join("; ")})` : ""}
                  </small>
                </button>
              </li>
            ))}
            {!result.candidates.length && <li>No candidate passed the minimum score. Lower it or add transcript, chat or replay data.</li>}
          </ol>
          {chosen && (
            <table className="moment-breakdown">
              <caption>
                Score breakdown for {fmt(chosen.start)}–{fmt(chosen.end)} (measured near the peak at {fmt(chosen.peakAt)})
              </caption>
              <thead>
                <tr>
                  <th>Signal</th>
                  <th>Weight</th>
                  <th>Value</th>
                  <th>Contribution</th>
                </tr>
              </thead>
              <tbody>
                {chosen.breakdown.map((b) => (
                  <tr key={b.signal}>
                    <td>{b.signal}</td>
                    <td>{Math.round(b.weight * 100)}%</td>
                    <td>{Math.round(b.value * 100)}</td>
                    <td>{Math.round(b.contribution * 100)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <button className="button primary" disabled={!picked.size || busy || running} onClick={render}>
            Render {picked.size || ""} selected clip{picked.size === 1 ? "" : "s"}
          </button>
        </>
      )}
    </section>
  );
}
