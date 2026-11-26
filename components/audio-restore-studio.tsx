"use client";
import { useEffect, useState } from "react";
import { AudioLines, Wand2 } from "lucide-react";
import type { Project } from "@/lib/types";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";

type Op =
  | { op: "highpass"; hz: number }
  | { op: "lowpass"; hz: number }
  | { op: "notch"; hz: number }
  | { op: "normalize"; targetDb: number }
  | { op: "compress" }
  | { op: "deesser" }
  | { op: "noise-gate" };

export function AudioRestoreStudio({ projects }: { projects: Project[] }) {
  const ready = projects.filter((p) => p.duration > 0);
  const [projectId, setProjectId] = useState(ready[0]?.id || "");
  const [ops, setOps] = useState<Op[]>([{ op: "highpass", hz: 80 }]);
  const [specUrl, setSpecUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!projectId) return;
    const url =
      "/api/audio-restore?project=" +
      encodeURIComponent(projectId) +
      "&t=" +
      Date.now();
    setSpecUrl(url);
  }, [projectId]);

  function toggleOp(op: Op) {
    setOps((rows) => {
      const exists = rows.some((r) => r.op === op.op);
      if (exists) return rows.filter((r) => r.op !== op.op);
      return [...rows, op].slice(0, 16);
    });
  }

  async function apply() {
    if (!projectId || !ops.length) return;
    setBusy(true);
    setError("");
    setMsg("");
    try {
      const r = await fetch("/api/audio-restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project: projectId,
          plan: { version: 1, ops },
        }),
      });
      const data = await r.json();
      if (!r.ok) throw Error(data.error || "Restore failed");
      setMsg(
        `Wrote restored WAV asset ${String(data.asset.id).slice(0, 8)}… — conventional attempt, not guaranteed recovery.`,
      );
      setSpecUrl(
        "/api/audio-restore?project=" +
          encodeURIComponent(projectId) +
          "&t=" +
          Date.now(),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Restore failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="audio-restore">
      <header className="panel-head">
        <div>
          <h2>Audio restoration</h2>
          <p>
            Spectrogram preview plus conventional FFmpeg filters. Results are
            restoration attempts, not guaranteed recovery.
          </p>
        </div>
        <Badge variant="outline">
          <AudioLines size={12} /> Local
        </Badge>
      </header>

      <label>
        Source
        <select
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
        >
          {ready.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </select>
      </label>

      <div className="spec-wrap">
        {specUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={specUrl}
            alt="Source spectrogram"
            width={640}
            height={220}
          />
        ) : (
          <p className="empty">Select a source to load the spectrogram.</p>
        )}
      </div>

      <fieldset>
        <legend>Restoration tools</legend>
        <div className="saved-searches">
          {(
            [
              { op: "highpass", hz: 80 },
              { op: "lowpass", hz: 12000 },
              { op: "notch", hz: 50 },
              { op: "normalize", targetDb: -16 },
              { op: "compress" },
              { op: "deesser" },
              { op: "noise-gate" },
            ] as Op[]
          ).map((op) => (
            <button
              key={op.op}
              type="button"
              className={`chip ${ops.some((o) => o.op === op.op) ? "current" : ""}`}
              onClick={() => toggleOp(op)}
            >
              {op.op}
            </button>
          ))}
        </div>
        {ops.some((o) => o.op === "highpass") && (
          <label>
            High-pass Hz
            <Input
              type="number"
              value={
                (ops.find((o) => o.op === "highpass") as { hz: number }).hz
              }
              onChange={(e) =>
                setOps((rows) =>
                  rows.map((r) =>
                    r.op === "highpass"
                      ? { ...r, hz: Number(e.target.value) || 80 }
                      : r,
                  ),
                )
              }
            />
          </label>
        )}
      </fieldset>

      <Button
        disabled={busy || !ops.length || !projectId}
        onClick={() => void apply()}
      >
        <Wand2 size={14} /> {busy ? "Processing…" : "Apply restoration"}
      </Button>
      <p className="muted">
        Output is saved as a new audio asset in the library for use in any
        studio.
      </p>
      {error && <p className="error">{error}</p>}
      {msg && <p className="notice">{msg}</p>}
    </div>
  );
}
