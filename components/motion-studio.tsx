"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Sparkles, Plus, Trash2, Play, Pause } from "lucide-react";
import type { Project } from "@/lib/types";
import { TEXT_TRACK_ASSET } from "@/lib/types";
import type { Track } from "@/lib/composition";
import {
  animationPresets,
  type AnimationPresetId,
} from "@/lib/animation-presets";
import {
  buildMotionTitlePreset,
  motionTitlePresets,
  sampleMotionLayers,
  applyPresetToTrack,
  type MotionTitlePresetId,
} from "@/lib/motion-presets";
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
  const [preset, setPreset] = useState<MotionTitlePresetId>("lower-third");
  const [anim, setAnim] = useState<AnimationPresetId>("fade-in");
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const raf = useRef<number | null>(null);
  const last = useRef(0);

  const selectedTrack = tracks.find((t) => t.id === selected);
  const duration = Math.max(3, ...tracks.map((t) => t.at + t.length), 0.1);

  function syncFromClip(pid: string, cid: string) {
    const p = withClips.find((x) => x.id === pid);
    const c = p?.clips.find((x) => x.id === cid);
    setTracks(
      c?.settings.composition?.tracks.filter((t) =>
        ["text", "shape", "effect"].includes(t.type),
      ) || [],
    );
    setSelected(null);
    setTime(0);
  }

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const w = c.width;
    const h = c.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#0a1214";
    ctx.fillRect(0, 0, w, h);
    const samples = sampleMotionLayers(tracks, time);
    for (const s of samples) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, s.opacity));
      const cx = s.x * w;
      const cy = s.y * h;
      ctx.translate(cx, cy);
      ctx.rotate((s.rotation * Math.PI) / 180);
      if (s.type === "shape") {
        const bw = Math.max(8, w * s.size);
        const bh =
          s.shapeKind === "line"
            ? Math.max(2, h * 0.012)
            : Math.max(8, h * s.size * 0.55);
        ctx.fillStyle = s.color;
        if (s.shapeKind === "ellipse") {
          ctx.beginPath();
          ctx.ellipse(0, 0, bw / 2, bh / 2, 0, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillRect(-bw / 2, -bh / 2, bw, bh);
        }
      } else if (s.type === "text") {
        ctx.fillStyle = s.color;
        ctx.font = `600 ${Math.round(28 + s.size * 20)}px ui-sans-serif, system-ui`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(s.text || s.name, 0, 0);
      }
      ctx.restore();
    }
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.font = "12px ui-sans-serif, system-ui";
    ctx.textAlign = "left";
    ctx.fillText(`${time.toFixed(2)}s / ${duration.toFixed(1)}s`, 10, 18);
  }, [tracks, time, duration]);

  useEffect(() => {
    if (!playing) {
      if (raf.current) cancelAnimationFrame(raf.current);
      return;
    }
    last.current = performance.now();
    const tick = (now: number) => {
      const dt = (now - last.current) / 1000;
      last.current = now;
      setTime((t) => {
        const next = t + dt;
        return next >= duration ? 0 : next;
      });
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [playing, duration]);

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
            Motion graphics layers with title presets, animation recipes, and a
            live canvas preview — feeds the shared composition engine.
          </p>
        </div>
        <Badge variant="outline">
          <Sparkles size={12} /> Partial
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
            <label>
              Title preset
              <select
                value={preset}
                onChange={(e) =>
                  setPreset(e.target.value as MotionTitlePresetId)
                }
              >
                {motionTitlePresets.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <canvas
            ref={canvasRef}
            className="motion-preview"
            width={640}
            height={360}
            aria-label="Motion preview"
          />

          <div className="bar-tools">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setPlaying((p) => !p)}
            >
              {playing ? <Pause size={14} /> : <Play size={14} />}{" "}
              {playing ? "Pause" : "Preview"}
            </Button>
            <label className="motion-scrub">
              Scrub
              <input
                type="range"
                min={0}
                max={duration}
                step={0.05}
                value={time}
                onChange={(e) => {
                  setPlaying(false);
                  setTime(Number(e.target.value));
                }}
              />
            </label>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const built = buildMotionTitlePreset(
                  preset,
                  clip?.title || "Clip title",
                );
                setTracks((t) => [...t, ...built].slice(0, 16));
                setSelected(built[0]?.id || null);
                setTime(0);
                setMsg(`Added ${motionTitlePresets.find((p) => p.id === preset)?.label}`);
              }}
            >
              <Sparkles size={14} /> Insert preset
            </Button>
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
            <Button
              size="sm"
              disabled={busy || !tracks.length}
              onClick={() => void save()}
            >
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
              {!tracks.length && (
                <li className="empty">No motion layers yet.</li>
              )}
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
                  <label>
                    Animation
                    <select
                      value={anim}
                      onChange={(e) =>
                        setAnim(e.target.value as AnimationPresetId)
                      }
                    >
                      {animationPresets.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.label} ({p.kind})
                        </option>
                      ))}
                    </select>
                  </label>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setTracks((rows) =>
                        rows.map((t) =>
                          t.id === selectedTrack.id
                            ? applyPresetToTrack(t, anim)
                            : t,
                        ),
                      );
                      setMsg(`Applied ${anim}`);
                    }}
                  >
                    Apply animation
                  </Button>
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
            <div
              className="motion-playhead"
              style={{ left: `${(time / duration) * 100}%` }}
            />
            {tracks.map((t) => (
              <div
                key={t.id}
                className={`motion-block ${selected === t.id ? "current" : ""}`}
                style={{
                  marginLeft: `${(t.at / duration) * 100}%`,
                  width: `${Math.max(4, (t.length / duration) * 100)}%`,
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
