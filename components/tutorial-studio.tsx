"use client";
import { useMemo, useState } from "react";
import { BookOpen, Plus, Trash2, MousePointer2 } from "lucide-react";
import type { Project } from "@/lib/types";
import type { Track } from "@/lib/composition";
import {
  CALLOUT_KINDS,
  emptyAnnotation,
  annotationsToTracks,
  type CalloutKind,
  type TutorialAnnotation,
} from "@/lib/tutorial-annotations";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";

export function TutorialStudio({
  projects,
}: {
  projects: Project[];
}) {
  const withClips = useMemo(
    () => projects.filter((p) => p.clips.length),
    [projects],
  );
  const [projectId, setProjectId] = useState(withClips[0]?.id || "");
  const project = withClips.find((p) => p.id === projectId) || withClips[0];
  const [clipId, setClipId] = useState(project?.clips[0]?.id || "");
  const clip =
    project?.clips.find((c) => c.id === clipId) || project?.clips[0];
  const [kind, setKind] = useState<CalloutKind>("number");
  const [rows, setRows] = useState<TutorialAnnotation[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  async function applyToClip() {
    if (!project || !clip) return;
    setBusy(true);
    setError("");
    try {
      const added = annotationsToTracks(rows);
      if (!added.length) throw Error("Add at least one annotation");
      const other =
        clip.settings.composition?.tracks.filter(
          (t) => !["text", "shape"].includes(t.type),
        ) || [];
      const keepText = (clip.settings.composition?.tracks || []).filter(
        (t) =>
          ["text", "shape"].includes(t.type) &&
          !String(t.name).includes("·") &&
          t.name !== "Cursor marker" &&
          t.name !== "Cursor label" &&
          t.name !== "Arrow" &&
          t.name !== "Arrow tip",
      );
      const composition = {
        version: 1 as const,
        tracks: [...other, ...keepText, ...added].slice(0, 16) as Track[],
      };
      const r = await fetch("/api/edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project: project.id,
          clip: clip.id,
          start: clip.start,
          end: clip.end,
          title: clip.title,
          settings: { ...clip.settings, composition },
          segments: clip.segments,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw Error(data.error || "Save failed");
      setMsg(
        `Applied ${added.length} tutorial layer(s). Cursor markers are manual — not OS tracking.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Apply failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="tutorial-studio">
      <header className="panel-head">
        <div>
          <h2>Tutorial tools</h2>
          <p>
            Numbered callouts, highlights, shortcuts and manual cursor markers
            for screen tutorials. No system-wide cursor tracking from capture.
          </p>
        </div>
        <Badge variant="outline">
          <BookOpen size={12} /> Scaffold
        </Badge>
      </header>

      {!withClips.length ? (
        <p className="empty">Create a clip from a recording first.</p>
      ) : (
        <>
          <div className="reel-grid">
            <label>
              Project
              <select
                value={project?.id}
                onChange={(e) => {
                  setProjectId(e.target.value);
                  const p = withClips.find((x) => x.id === e.target.value);
                  setClipId(p?.clips[0]?.id || "");
                }}
              >
                {withClips.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Clip
              <select
                value={clip?.id}
                onChange={(e) => setClipId(e.target.value)}
              >
                {(project?.clips || []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Annotation
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value as CalloutKind)}
              >
                {CALLOUT_KINDS.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="bar-tools">
            <Button
              variant="outline"
              onClick={() =>
                setRows((r) =>
                  [...r, emptyAnnotation(kind, r.length * 0.5)].slice(0, 24),
                )
              }
            >
              <Plus size={14} /> Add
            </Button>
            {kind === "cursor" && (
              <Badge variant="secondary">
                <MousePointer2 size={12} /> Manual marker
              </Badge>
            )}
            <Button disabled={busy || !rows.length} onClick={() => void applyToClip()}>
              {busy ? "Applying…" : "Apply to clip composition"}
            </Button>
          </div>

          <ul className="tutorial-list">
            {rows.map((row, i) => (
              <li key={row.id}>
                <Badge variant="outline">{row.kind}</Badge>
                <Input
                  value={row.label}
                  onChange={(e) =>
                    setRows((list) =>
                      list.map((x, j) =>
                        j === i
                          ? { ...x, label: e.target.value.slice(0, 80) }
                          : x,
                      ),
                    )
                  }
                />
                <Input
                  type="number"
                  step={0.1}
                  value={row.at}
                  title="Start"
                  onChange={(e) =>
                    setRows((list) =>
                      list.map((x, j) =>
                        j === i
                          ? { ...x, at: Math.max(0, Number(e.target.value) || 0) }
                          : x,
                      ),
                    )
                  }
                />
                <Input
                  type="number"
                  step={0.05}
                  min={0}
                  max={1}
                  value={row.x}
                  title="X"
                  onChange={(e) =>
                    setRows((list) =>
                      list.map((x, j) =>
                        j === i
                          ? {
                              ...x,
                              x: Math.min(
                                1,
                                Math.max(0, Number(e.target.value) || 0),
                              ),
                            }
                          : x,
                      ),
                    )
                  }
                />
                <Input
                  type="number"
                  step={0.05}
                  min={0}
                  max={1}
                  value={row.y}
                  title="Y"
                  onChange={(e) =>
                    setRows((list) =>
                      list.map((x, j) =>
                        j === i
                          ? {
                              ...x,
                              y: Math.min(
                                1,
                                Math.max(0, Number(e.target.value) || 0),
                              ),
                            }
                          : x,
                      ),
                    )
                  }
                />
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Remove"
                  onClick={() =>
                    setRows((list) => list.filter((_, j) => j !== i))
                  }
                >
                  <Trash2 size={14} />
                </Button>
              </li>
            ))}
            {!rows.length && (
              <li className="empty">No annotations yet — add a callout.</li>
            )}
          </ul>
        </>
      )}

      {error && <p className="error">{error}</p>}
      {msg && <p className="notice">{msg}</p>}
    </div>
  );
}
