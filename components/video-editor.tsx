"use client";
import { useState, useRef, useCallback } from "react";
import { Play, Check, LoaderCircle, Scissors, Captions } from "lucide-react";
import { Modal } from "./modal";
import { FormatSettings, SubtitleSettings } from "./clip-settings";
import { Button } from "./ui/button";
import type { Clip, Project, Segment } from "@/lib/types";
export function VideoEditor({
  clip,
  project,
  onClose,
  onSaved,
}: {
  clip: Clip;
  project: Project;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [settings, setSettings] = useState(clip.settings),
    [start, setStart] = useState(clip.start),
    [end, setEnd] = useState(clip.end),
    [segments, setSegments] = useState<Segment[]>(clip.segments),
    [tab, setTab] = useState("video"),
    [saving, setSaving] = useState(false),
    [error, setError] = useState("");
  const video = useRef<HTMLVideoElement>(null);
  const close = useCallback(() => onClose(), [onClose]);
  async function save() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project: project.id,
          clip: clip.id,
          start,
          end,
          settings,
          segments,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw Error(data.error);
      await onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }
  return (
    <Modal
      title="Edit video"
      description={clip.title}
      size="wide"
      onClose={close}
      busy={saving}
    >
      <div className="editor-grid">
        <div className="editor-player-column">
          <div
            className="editor-preview"
            style={{ aspectRatio: settings.ratio.replace(":", "/") }}
          >
            <video
              ref={video}
              controls
              src={`/api/download?project=${project.id}&kind=source#t=${start}`}
              style={{
                objectFit:
                  settings.layout === "blur" || settings.layout === "original"
                    ? "contain"
                    : "cover",
                objectPosition: `${settings.crop}% center`,
              }}
              onLoadedMetadata={() => {
                if (video.current) video.current.currentTime = start;
              }}
              onTimeUpdate={() => {
                if (video.current && video.current.currentTime >= end) {
                  video.current.pause();
                  video.current.currentTime = start;
                }
              }}
            />
          </div>
          <Button
            variant="secondary"
            onClick={() => {
              if (video.current) {
                video.current.currentTime = start;
                void video.current.play();
              }
            }}
          >
            <Play size={15} />
            Preview trim
          </Button>
          <p className="hint">
            Preview shows source framing. Subtitles and layouts are applied when
            you save.
          </p>
        </div>
        <div className="editor-controls">
          <div className="segmented" role="tablist" aria-label="Editor tools">
            <button
              role="tab"
              aria-selected={tab === "video"}
              className={tab === "video" ? "selected" : ""}
              onClick={() => setTab("video")}
            >
              <Scissors size={15} />
              Trim & layout
            </button>
            <button
              role="tab"
              aria-selected={tab === "subtitles"}
              className={tab === "subtitles" ? "selected" : ""}
              onClick={() => setTab("subtitles")}
            >
              <Captions size={15} />
              Subtitles
            </button>
          </div>
          {tab === "video" ? (
            <div className="editor-fields">
              <div className="field-grid">
                <label className="field">
                  <span>Start (seconds)</span>
                  <input
                    type="number"
                    min="0"
                    max={project.duration}
                    step="0.1"
                    value={start}
                    onChange={(e) => setStart(Number(e.target.value))}
                  />
                </label>
                <label className="field">
                  <span>End (seconds)</span>
                  <input
                    type="number"
                    min="0"
                    max={project.duration}
                    step="0.1"
                    value={end}
                    onChange={(e) => setEnd(Number(e.target.value))}
                  />
                </label>
              </div>
              <FormatSettings value={settings} onChange={setSettings} />
            </div>
          ) : (
            <div className="editor-fields">
              <SubtitleSettings value={settings} onChange={setSettings} />
              {settings.captions && (
                <div className="subtitle-lines">
                  <h3>Subtitle text</h3>
                  {segments.length ? (
                    segments.map((segment, i) => (
                      <label className="subtitle-line" key={i}>
                        <span>
                          {Math.floor(segment.start / 60)}:
                          {String(Math.floor(segment.start % 60)).padStart(
                            2,
                            "0",
                          )}
                        </span>
                        <textarea
                          aria-label={`Subtitle ${i + 1}`}
                          value={segment.text}
                          onChange={(e) =>
                            setSegments(
                              segments.map((s, index) =>
                                index === i
                                  ? { ...s, text: e.target.value, words: [] }
                                  : s,
                              ),
                            )
                          }
                        />
                      </label>
                    ))
                  ) : (
                    <p className="hint">
                      Subtitles will be transcribed when this clip is rendered.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
      <footer className="modal-footer">
        <span className="muted">
          {Math.max(0, end - start).toFixed(1)} seconds selected
        </span>
        <Button
          disabled={
            saving ||
            start < 0 ||
            end <= start ||
            end > project.duration ||
            end - start > 600
          }
          onClick={() => void save()}
        >
          {saving ? (
            <LoaderCircle size={16} className="spin" />
          ) : (
            <Check size={16} />
          )}
          Save changes
        </Button>
      </footer>
    </Modal>
  );
}
