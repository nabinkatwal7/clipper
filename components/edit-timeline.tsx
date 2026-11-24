"use client";
import { useEffect, useState } from "react";
import { ZoomIn, ZoomOut } from "lucide-react";
import { FrameStrip } from "./frame-strip";
import { duration } from "./studio-media";
import type { Segment } from "@/lib/types";
export function EditTimeline({
  overlay,
  project,
  clip,
  originalStart,
  originalEnd,
  anchor,
  length,
  start,
  end,
  now,
  seek,
  inPoint,
  outPoint,
  segments,
}: {
  overlay?: string;
  project: string;
  clip: string;
  originalStart: number;
  originalEnd: number;
  anchor: number;
  length: number;
  start: number;
  end: number;
  now: number;
  seek: (v: number) => void;
  inPoint: (v: number) => void;
  outPoint: (v: number) => void;
  segments: Segment[];
}) {
  const [zoom, setZoom] = useState(1);
  const [markers, setMarkers] = useState<number[]>([]),
    [snap, setSnap] = useState(true);
  const markerKey = "clipper-markers-" + project;
  useEffect(() => {
    try {
      setMarkers(JSON.parse(localStorage.getItem(markerKey) || "[]"));
    } catch {}
  }, [markerKey]);
  function mark() {
    const at = Math.round(now * 100) / 100;
    const next = markers.includes(at)
      ? markers.filter((m) => m !== at)
      : [...markers, at].sort((a, b) => a - b);
    setMarkers(next);
    localStorage.setItem(markerKey, JSON.stringify(next));
  }
  function snapped(at: number) {
    if (!snap) return at;
    const points = [
      originalStart,
      originalEnd,
      ...markers,
      ...segments.flatMap((s) => [s.start, s.end]),
    ];
    let best = at,
      delta = 0.12;
    for (const p of points) {
      if (Math.abs(at - p) < delta) {
        delta = Math.abs(at - p);
        best = p;
      }
    }
    return best;
  }

  const span = Math.min(
      length,
      Math.max(5, ((originalEnd - originalStart || 30) * 1.7) / zoom),
    ),
    left = Math.max(0, Math.min(length - span, anchor - span / 2)),
    right = left + span;
  const pct = (v: number) =>
    Math.max(0, Math.min(100, ((v - left) / span) * 100));
  return (
    <section className="edit-timeline" aria-label="Editing timeline">
      <div className="section-row">
        <h2>Timeline</h2>
        <div>
          <time>{duration(now)}</time>
          <button title="Add or remove marker at playhead" onClick={mark}>
            Marker
          </button>
          <button
            title="Snap trim handles to nearby markers and captions"
            aria-pressed={snap}
            onClick={() => setSnap(!snap)}
          >
            Snap {snap ? "on" : "off"}
          </button>
          <button
            title="Zoom out timeline"
            disabled={zoom <= 0.25}
            onClick={() => setZoom(zoom / 2)}
          >
            <ZoomOut size={15} />
          </button>
          <button
            title="Zoom in timeline"
            disabled={zoom >= 8}
            onClick={() => setZoom(zoom * 2)}
          >
            <ZoomIn size={15} />
          </button>
        </div>
      </div>
      <div className="time-ruler">
        {Array.from({ length: 6 }, (_, i) => (
          <time key={i}>{duration(left + (i * span) / 5)}</time>
        ))}
      </div>
      {markers.some((m) => m >= left && m <= right) && (
        <div className="marker-lane">
          {markers
            .filter((m) => m >= left && m <= right)
            .map((m) => (
              <button
                key={m}
                title={"Marker " + duration(m)}
                style={{ left: pct(m) + "%" }}
                onClick={() => seek(m)}
              >
                ◆
              </button>
            ))}
        </div>
      )}
      <div className="timeline-bed">
        <div className="frame-track">
          <FrameStrip project={project} left={left} span={span} />
          <b className="track-label">Video</b>
          <span
            className="range-band"
            style={{
              left: pct(start) + "%",
              width: pct(end) - pct(start) + "%",
            }}
          />
        </div>
        <div className="audio-track">
          <b className="track-label">Audio</b>
          <img
            alt="Clip audio waveform"
            src={`/api/waveform?project=${project}&clip=${clip}`}
            onError={(e) => (e.currentTarget.style.display = "none")}
            style={{
              left: ((originalStart - left) / span) * 100 + "%",
              width: ((originalEnd - originalStart) / span) * 100 + "%",
            }}
          />
        </div>
        <div className="caption-track">
          <b className="track-label">Subtitles</b>
          {segments
            .filter((s) => s.end > left && s.start < right)
            .map((s, i) => (
              <span
                key={i}
                title={s.text}
                style={{
                  left: pct(s.start) + "%",
                  width: pct(s.end) - pct(s.start) + "%",
                }}
              >
                {s.text}
              </span>
            ))}
        </div>
        {overlay && (
          <div className="overlay-track">
            <span
              style={{
                marginLeft: pct(start) + "%",
                width: pct(end) - pct(start) + "%",
              }}
            >
              {overlay}
            </span>
          </div>
        )}
        <i className="playhead" style={{ left: pct(now) + "%" }} />
        <input
          className="timeline-scrub"
          aria-label="Scrub source timeline"
          type="range"
          min={left}
          max={right}
          step=".01"
          value={now}
          onChange={(e) => seek(+e.target.value)}
        />
      </div>
      <div className="trim-handles">
        <label>
          In
          <input
            aria-label="Trim in point"
            type="range"
            min={left}
            max={right}
            step=".01"
            value={start}
            onChange={(e) =>
              inPoint(Math.min(snapped(+e.target.value), end - 0.05))
            }
          />
        </label>
        <label>
          Out
          <input
            aria-label="Trim out point"
            type="range"
            min={left}
            max={right}
            step=".01"
            value={end}
            onChange={(e) =>
              outPoint(Math.max(snapped(+e.target.value), start + 0.05))
            }
          />
        </label>
      </div>
    </section>
  );
}
