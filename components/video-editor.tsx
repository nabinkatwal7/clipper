"use client";
import { useState, useRef, useCallback } from "react";
import { Play, Check, LoaderCircle, Scissors, Captions } from "lucide-react";
import { Modal } from "./modal";
import { FormatSettings, SubtitleSettings } from "./clip-settings";
import { Button } from "./ui/button";
import type { Clip, Project, Segment } from "@/lib/types";
function timecode(value: number) {
  const n = Math.round(value * 100) / 100,
    seconds = (n % 60).toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
  return n >= 3600
    ? `${Math.floor(n / 3600)}:${String(Math.floor(n / 60) % 60).padStart(2, "0")}:${seconds.replace(/^(\d)(?=\.|$)/, "0$1")}`
    : `${Math.floor(n / 60)}:${seconds.replace(/^(\d)(?=\.|$)/, "0$1")}`;
}
function seconds(value: string) {
  const parts = value.trim().split(":");
  if (
    parts.length > 3 ||
    !/^\d+(?::\d{1,2}){0,2}(?:\.\d{1,2})?$/.test(value.trim())
  )
    return NaN;
  const numbers = parts.map(Number);
  if (numbers.slice(1).some((n) => n >= 60)) return NaN;
  return numbers.reduce((total, n) => total * 60 + n, 0);
}
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
    [startText, setStartText] = useState(timecode(clip.start)),
    [endText, setEndText] = useState(timecode(clip.end)),
    [segments, setSegments] = useState<Segment[]>(clip.segments),
    [tab, setTab] = useState("video"),
    [saving, setSaving] = useState(false),
    [error, setError] = useState("");
  const video = useRef<HTMLVideoElement>(null);
  const start = seconds(startText),
    end = seconds(endText),
    valid = Number.isFinite(start) && Number.isFinite(end);
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
              src={`/api/download?project=${project.id}&kind=source#t=${valid ? start : clip.start}`}
              style={{
                objectFit:
                  settings.layout === "blur" || settings.layout === "original"
                    ? "contain"
                    : "cover",
                objectPosition: `${settings.crop}% center`,
              }}
              onLoadedMetadata={() => {
                if (video.current && valid) video.current.currentTime = start;
              }}
              onTimeUpdate={() => {
                if (
                  video.current &&
                  valid &&
                  video.current.currentTime >= end
                ) {
                  video.current.pause();
                  video.current.currentTime = start;
                }
              }}
            />
          </div>
          <Button
            variant="secondary"
            disabled={!valid}
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
                  <span>Start time</span>
                  <input
                    type="text"
                    placeholder="0:00"
                    value={startText}
                    onChange={(e) => setStartText(e.target.value)}
                  />
                </label>
                <label className="field">
                  <span>End time</span>
                  <input
                    type="text"
                    placeholder="0:30"
                    value={endText}
                    onChange={(e) => setEndText(e.target.value)}
                  />
                </label>
              </div>
              <p className="hint">
                Use minutes:seconds or hours:minutes:seconds.
              </p>
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
          {valid
            ? `${Math.max(0, end - start).toFixed(1)} seconds selected`
            : "Enter a valid time range"}
        </span>
        <Button
          disabled={
            saving ||
            !valid ||
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
