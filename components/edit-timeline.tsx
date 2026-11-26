"use client";
import { studioStorage } from "@/lib/client-storage";
import { useEffect, useRef, useState } from "react";
import { ZoomIn, ZoomOut } from "lucide-react";
import { FrameStrip } from "./frame-strip";
import { duration } from "./studio-media";
import {
  dragTrack,
  type TrackGesture,
} from "@/lib/timeline-gestures";
import type { Track } from "@/lib/composition";
import type { Segment } from "@/lib/types";

export function EditTimeline({
  overlay,
  tracks = [],
  onTracks,
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
  beats = [],
  onAnalyzeBeats,
  beatBusy,
}: {
  overlay?: string;
  tracks?: Track[];
  onTracks?: (tracks: Track[]) => void;
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
  beats?: { time: number; strength: number }[];
  onAnalyzeBeats?: () => void;
  beatBusy?: boolean;
}) {
  const bed = useRef<HTMLDivElement>(null);
  const drag = useRef<{
    id: string;
    gesture: TrackGesture;
    originX: number;
    snapshot: Track[];
    selected: string[];
  } | null>(null);
  const [draftTracks, setDraftTracks] = useState<Track[] | null>(null);
  const latestDraft = useRef<Track[] | null>(null);
  const visibleTracks = draftTracks ?? tracks;
  const [selected, setSelected] = useState<string[]>([]);
  const [zoom, setZoom] = useState(1);
  const [markers, setMarkers] = useState<number[]>([]),
    [snap, setSnap] = useState(true);
  const markerKey = "clipper-markers-" + project;
  useEffect(() => {
    try {
      setMarkers(JSON.parse(studioStorage.getItem(markerKey) || "[]"));
    } catch {}
  }, [markerKey]);
  function mark() {
    const at = Math.round(now * 100) / 100;
    const next = markers.includes(at)
      ? markers.filter((m) => m !== at)
      : [...markers, at].sort((a, b) => a - b);
    setMarkers(next);
    studioStorage.setItem(markerKey, JSON.stringify(next));
  }
  function snapped(at: number) {
    if (!snap) return at;
    const points = [
      originalStart,
      originalEnd,
      ...markers,
      ...visibleTracks.flatMap((t) => [start + t.at, start + t.at + t.length]),
      ...segments.flatMap((s) => [s.start, s.end]),
      ...beats.map((b) => b.time),
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
  const clipLength = Math.max(0.04, end - start);

  function beginDrag(
    event: React.PointerEvent,
    id: string,
    gesture: TrackGesture,
  ) {
    if (!onTracks || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    let nextSelected = selected;
    if (gesture === "move") {
      if (event.shiftKey)
        nextSelected = selected.includes(id)
          ? selected.filter((x) => x !== id)
          : [...selected, id];
      else if (!selected.includes(id)) nextSelected = [id];
      if (!nextSelected.length) nextSelected = [id];
      setSelected(nextSelected);
    }
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    const snapshot = tracks.map((track) => ({
      ...track,
      keys: { ...track.keys },
    }));
    drag.current = {
      id,
      gesture,
      originX: event.clientX,
      snapshot,
      selected: nextSelected,
    };
    latestDraft.current = snapshot;
    setDraftTracks(snapshot);
  }

  function moveDrag(event: React.PointerEvent) {
    if (!drag.current || !bed.current) return;
    const width = bed.current.getBoundingClientRect().width || 1;
    const deltaSeconds = ((event.clientX - drag.current.originX) / width) * span;
    const next = dragTrack(
      drag.current.snapshot,
      drag.current.id,
      drag.current.gesture,
      deltaSeconds,
      clipLength,
      drag.current.selected,
    );
    latestDraft.current = next;
    setDraftTracks(next);
  }

  function endDrag(event: React.PointerEvent) {
    if (!drag.current) return;
    try {
      (event.currentTarget as HTMLElement).releasePointerCapture(
        event.pointerId,
      );
    } catch {}
    const finalTracks = latestDraft.current;
    const started = drag.current.snapshot;
    drag.current = null;
    latestDraft.current = null;
    setDraftTracks(null);
    if (
      onTracks &&
      finalTracks &&
      finalTracks.some(
        (track, index) =>
          track.at !== started[index]?.at ||
          track.length !== started[index]?.length ||
          track.slip !== started[index]?.slip,
      )
    )
      onTracks(finalTracks);
  }

  return (
    <section className="edit-timeline" aria-label="Editing timeline">
      <div className="section-row">
        <h2>Timeline</h2>
        <div>
          <time>{duration(now)}</time>
          <button title="Add or remove marker at playhead" onClick={mark}>
            Marker
          </button>
          {onAnalyzeBeats && (
            <button
              title="Detect beats from source audio"
              disabled={beatBusy}
              onClick={onAnalyzeBeats}
            >
              {beatBusy ? "Detecting…" : beats.length ? `Beats · ${beats.length}` : "Detect beats"}
            </button>
          )}
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
      {beats.some((m) => m.time >= left && m.time <= right) && (
        <div className="marker-lane beat-lane" aria-label="Detected beats">
          {beats
            .filter((m) => m.time >= left && m.time <= right)
            .map((m) => (
              <button
                key={"beat-" + m.time}
                title={"Beat " + duration(m.time)}
                style={{ left: pct(m.time) + "%", opacity: 0.35 + 0.65 * m.strength }}
                onClick={() => seek(m.time)}
              >
                |
              </button>
            ))}
        </div>
      )}
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
      <div className="timeline-bed" ref={bed}>
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
        {visibleTracks.map((t) => (
          <div
            key={t.id}
            className="overlay-track"
            aria-label={t.type + " track " + t.name}
          >
            <span
              className={
                "track-clip" +
                (t.locked ? " is-locked" : "") +
                (selected.includes(t.id) ? " is-selected" : "") +
                (onTracks && !t.locked ? " is-editable" : "")
              }
              style={{
                marginLeft: pct(start + t.at) + "%",
                width: pct(start + t.at + t.length) - pct(start + t.at) + "%",
                opacity: t.visible || !t.muted ? 1 : 0.5,
              }}
              title={
                t.locked
                  ? t.name + " (locked)"
                  : t.name + " — drag to move, edges to trim"
              }
              onPointerMove={moveDrag}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
            >
              {onTracks && !t.locked && (
                <i
                  className="track-trim start"
                  aria-hidden
                  onPointerDown={(e) => beginDrag(e, t.id, "trim-start")}
                />
              )}
              <b
                onPointerDown={(e) =>
                  onTracks && !t.locked
                    ? beginDrag(e, t.id, "move")
                    : undefined
                }
              >
                {t.locked ? "🔒 " : ""}
                {t.name}
              </b>
              {onTracks && !t.locked && (
                <i
                  className="track-trim end"
                  aria-hidden
                  onPointerDown={(e) => beginDrag(e, t.id, "trim-end")}
                />
              )}
            </span>
          </div>
        ))}
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
