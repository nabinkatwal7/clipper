"use client";
import { useState } from "react";
import { Plus, Trash2, Download, Scissors } from "lucide-react";
import type { Project } from "@/lib/types";
import {
  cutModeHelp,
  type CutMode,
  type CutSegment,
  type CutSession,
} from "@/lib/fast-cut-types";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";

export function InstantClipping({ projects }: { projects: Project[] }) {
  const [projectId, setProjectId] = useState(projects[0]?.id || "");
  const [mode, setMode] = useState<CutMode>("lossless");
  const [segments, setSegments] = useState<CutSegment[]>([]);
  const [start, setStart] = useState("0");
  const [end, setEnd] = useState("15");
  const [label, setLabel] = useState("Segment");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  const project = projects.find((p) => p.id === projectId);

  function add() {
    const s = Number(start),
      e = Number(end);
    if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s) {
      setError("Enter a valid start and end time");
      return;
    }
    setSegments((rows) => [
      ...rows,
      {
        id: crypto.randomUUID(),
        start: s,
        end: e,
        label: label.trim() || `Segment ${rows.length + 1}`,
      },
    ]);
    setError("");
  }

  async function exportAll() {
    if (!project || !segments.length) return;
    setBusy(true);
    setError("");
    setMsg("");
    const session: CutSession = {
      version: 1,
      sourceProject: project.id,
      mode,
      segments,
    };
    try {
      const r = await fetch("/api/fast-cut", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project: project.id, session }),
      });
      const data = await r.json();
      if (!r.ok) throw Error(data.error || "Export failed");
      setMsg(
        `Exported ${data.results?.length || 0} segment(s) with ${data.mode} mode.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="instant-clipping">
      <header className="panel-head">
        <div>
          <h2>Instant clipping</h2>
          <p>Fast segment extraction with explicit lossless vs accurate modes.</p>
        </div>
      </header>

      <div className="instant-controls">
        <label>
          Source
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            aria-label="Source project"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </label>
        <fieldset>
          <legend>Cut mode</legend>
          {(["lossless", "accurate", "smart"] as CutMode[]).map((m) => (
            <label key={m} className="mode-option">
              <input
                type="radio"
                name="cut-mode"
                checked={mode === m}
                onChange={() => setMode(m)}
              />
              <span>
                <strong>
                  {m === "lossless"
                    ? "Fast lossless"
                    : m === "accurate"
                      ? "Frame-accurate"
                      : "Smart render"}
                </strong>
                <small>{cutModeHelp(m)}</small>
              </span>
            </label>
          ))}
        </fieldset>
      </div>

      <div className="instant-add">
        <Input
          value={start}
          onChange={(e) => setStart(e.target.value)}
          aria-label="Start seconds"
          placeholder="Start"
        />
        <Input
          value={end}
          onChange={(e) => setEnd(e.target.value)}
          aria-label="End seconds"
          placeholder="End"
        />
        <Input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          aria-label="Segment label"
          placeholder="Label"
        />
        <Button size="sm" onClick={add}>
          <Plus size={14} /> Add segment
        </Button>
      </div>

      <ul className="instant-segments">
        {segments.map((s) => (
          <li key={s.id}>
            <Badge variant="outline">{s.label}</Badge>
            <span>
              {s.start.toFixed(2)}s → {s.end.toFixed(2)}s
            </span>
            <Button
              size="icon"
              variant="ghost"
              aria-label="Remove segment"
              onClick={() =>
                setSegments((rows) => rows.filter((r) => r.id !== s.id))
              }
            >
              <Trash2 size={14} />
            </Button>
          </li>
        ))}
        {!segments.length && <li className="empty">No segments yet.</li>}
      </ul>

      {error && <p className="error">{error}</p>}
      {msg && <p className="notice">{msg}</p>}

      <Button
        disabled={busy || !segments.length || !project}
        onClick={() => void exportAll()}
      >
        {busy ? (
          <Scissors size={14} />
        ) : (
          <Download size={14} />
        )}{" "}
        {busy ? "Exporting…" : "Export segments"}
      </Button>
    </div>
  );
}
