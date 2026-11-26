"use client";
import { useMemo, useState } from "react";
import { Sparkles, Plus, Trash2 } from "lucide-react";
import type { Project } from "@/lib/types";
import { TEXT_TRACK_ASSET } from "@/lib/types";
import type { Track } from "@/lib/composition";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";

function emptyShape(kind: "rect" | "ellipse" | "line", at: number): Track {
  return {
    id: crypto.randomUUID(),
    name: kind[0].toUpperCase() + kind.slice(1),
    type: "shape",
    shapeKind: kind,
    asset: TEXT_TRACK_ASSET,
    at,
    length: 3,
    slip: 0,
    x: 0.5,
    y: 0.5,
    size: 0.35,
    opacity: 1,
    volume: 0,
    visible: true,
    muted: true,
    locked: false,
    solo: false,
    loop: false,
    fade: 0.2,
    color: "#14b8a6",
    keys: {
      opacity: [
        { time: 0, value: 0, ease: "in-out" },
        { time: 0.4, value: 1, ease: "linear" },
      ],
    },
  };
}

function emptyText(at: number): Track {
  return {
    id: crypto.randomUUID(),
    name: "Title",
    type: "text",
    text: "Motion title",
    asset: TEXT_TRACK_ASSET,
    at,
    length: 3,
    slip: 0,
    x: 0.5,
    y: 0.2,
    size: 1,
    opacity: 1,
    volume: 0,
    visible: true,
    muted: true,
    locked: false,
    solo: false,
    loop: false,
    fade: 0.15,
    color: "#ffffff",
    fontSize: 64,
    keys: {
      y: [
        { time: 0, value: 0.35, ease: "out" },
        { time: 0.5, value: 0.2, ease: "linear" },
      ],
    },
  };
}

export function MotionStudio({
  projects,
  onSave,
}: {
  projects: Project[];
  onSave?: (projectId: string, clipId: string, tracks: Track[]) => Promise<void>;
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
  const [tracks, setTracks] = useState<Track[]>(
    () =>
      clip?.settings.composition?.tracks.filter((t) =>
        ["text", "shape", "effect"].includes(t.type),
      ) || [],
  );
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  const selectedTrack = tracks.find((t) => t.id === selected);

  function syncFromClip(pid: string, cid: string) {
    const p = withClips.find((x) => x.id === pid);
    const c = p?.clips.find((x) => x.id === cid);
    setTracks(
      c?.settings.composition?.tracks.filter((t) =>
        ["text", "shape", "effect"].includes(t.type),
      ) || [],
    );
    setSelected(null);
  }

  async function save() {
    if (!project || !clip) return;
    setBusy(true);
    setError("");
    try {
      const other =
        clip.settings.composition?.tracks.filter(
          (t) => !["text", "shape", "effect"].includes(t.type),
        ) || [];
      const composition = {
        version: 1 as const,
        tracks: [...other, ...tracks].slice(0, 16),
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
      setMsg("Motion layers saved into the clip composition.");
      await onSave?.(project.id, clip.id, tracks);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="motion-studio">
      <header className="panel-head">
        <div>
          <h2>Motion Studio</h2>
          <p>
            Lightweight motion graphics layers (text/shapes/keyframes) that feed
            the shared composition engine — not After Effects.
          </p>
        </div>
        <Badge variant="outline">
          <Sparkles size={12} /> Scaffold
        </Badge>
      </header>

      {!withClips.length ? (
        <p className="empty">Generate a clip first to attach motion layers.</p>
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
                  const c = p?.clips[0]?.id || "";
                  setClipId(c);
                  syncFromClip(e.target.value, c);
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
                onChange={(e) => {
                  setClipId(e.target.value);
                  syncFromClip(project!.id, e.target.value);
                }}
              >
                {(project?.clips || []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="bar-tools">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setTracks((t) => [...t, emptyText(0)].slice(0, 16))}
            >
              <Plus size={14} /> Text
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                setTracks((t) => [...t, emptyShape("rect", 0)].slice(0, 16))
              }
            >
              <Plus size={14} /> Rect
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                setTracks((t) => [...t, emptyShape("ellipse", 0)].slice(0, 16))
              }
            >
              <Plus size={14} /> Ellipse
            </Button>
            <Button size="sm" disabled={busy || !tracks.length} onClick={() => void save()}>
              {busy ? "Saving…" : "Save to composition"}
            </Button>
          </div>

          <div className="motion-layout">
            <ul className="motion-layers">
              {tracks.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    className={selected === t.id ? "current" : ""}
                    onClick={() => setSelected(t.id)}
                  >
                    <strong>{t.name}</strong>
                    <small>
                      {t.type} · {t.at.toFixed(1)}s
                    </small>
                  </button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Remove layer"
                    onClick={() =>
                      setTracks((rows) => rows.filter((x) => x.id !== t.id))
                    }
                  >
                    <Trash2 size={14} />
                  </Button>
                </li>
              ))}
              {!tracks.length && <li className="empty">No motion layers yet.</li>}
            </ul>
            <div className="motion-inspector">
              {selectedTrack ? (
                <>
                  <label>
                    Name
                    <Input
                      value={selectedTrack.name}
                      onChange={(e) =>
                        setTracks((rows) =>
                          rows.map((t) =>
                            t.id === selectedTrack.id
                              ? { ...t, name: e.target.value.slice(0, 100) }
                              : t,
                          ),
                        )
                      }
                    />
                  </label>
                  {selectedTrack.type === "text" && (
                    <label>
                      Text
                      <Input
                        value={selectedTrack.text || ""}
                        onChange={(e) =>
                          setTracks((rows) =>
                            rows.map((t) =>
                              t.id === selectedTrack.id
                                ? { ...t, text: e.target.value.slice(0, 200) }
                                : t,
                            ),
                          )
                        }
                      />
                    </label>
                  )}
                  <label>
                    Start
                    <Input
                      type="number"
                      step={0.1}
                      value={selectedTrack.at}
                      onChange={(e) =>
                        setTracks((rows) =>
                          rows.map((t) =>
                            t.id === selectedTrack.id
                              ? {
                                  ...t,
                                  at: Math.max(0, Number(e.target.value) || 0),
                                }
                              : t,
                          ),
                        )
                      }
                    />
                  </label>
                  <label>
                    Length
                    <Input
                      type="number"
                      step={0.1}
                      value={selectedTrack.length}
                      onChange={(e) =>
                        setTracks((rows) =>
                          rows.map((t) =>
                            t.id === selectedTrack.id
                              ? {
                                  ...t,
                                  length: Math.max(
                                    0.04,
                                    Number(e.target.value) || 0.04,
                                  ),
                                }
                              : t,
                          ),
                        )
                      }
                    />
                  </label>
                  <p className="muted">
                    Keyframes:{" "}
                    {Object.keys(selectedTrack.keys || {}).join(", ") || "none"}
                  </p>
                </>
              ) : (
                <p className="empty">Select a layer to edit properties.</p>
              )}
            </div>
          </div>
          <div className="motion-timeline" aria-label="Motion timeline">
            {tracks.map((t) => (
              <div
                key={t.id}
                className={`motion-block ${selected === t.id ? "current" : ""}`}
                style={{
                  marginLeft: `${Math.min(90, t.at * 8)}%`,
                  width: `${Math.min(40, Math.max(6, t.length * 6))}%`,
                }}
                onClick={() => setSelected(t.id)}
              >
                {t.name}
              </div>
            ))}
          </div>
        </>
      )}
      {error && <p className="error">{error}</p>}
      {msg && <p className="notice">{msg}</p>}
    </div>
  );
}
