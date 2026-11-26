"use client";
import { useMemo, useState } from "react";
import type { Segment } from "@/lib/types";
import {
  mergeCaptions,
  replaceCaptionText,
  splitCaption,
} from "@/lib/caption-track";

export function CaptionTrackEditor({
  segments,
  change,
  seek,
  now,
}: {
  segments: Segment[];
  change: (segments: Segment[]) => void;
  seek: (time: number) => void;
  now: number;
}) {
  const [query, setQuery] = useState("");
  const [replace, setReplace] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return segments.map((segment, index) => ({ segment, index }));
    return segments
      .map((segment, index) => ({ segment, index }))
      .filter(({ segment }) => segment.text.toLowerCase().includes(q));
  }, [segments, query]);

  return (
    <div className="caption-track-editor">
      <h4>Caption track</h4>
      <p className="hint">
        Edit, split, merge and search the timed caption track that feeds ASS
        export.
      </p>
      <div className="field-grid">
        <label className="field">
          Find
          <input value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <label className="field">
          Replace
          <input value={replace} onChange={(e) => setReplace(e.target.value)} />
        </label>
      </div>
      <div className="candidate-actions">
        <button
          type="button"
          className="tool"
          onClick={() => change(replaceCaptionText(segments, query, replace))}
        >
          Replace all
        </button>
      </div>
      {!segments.length && (
        <p className="hint">
          Subtitles will be transcribed when this clip is rendered, or import a
          transcript first.
        </p>
      )}
      <div className="caption-rows">
        {filtered.map(({ segment, index }) => (
          <div
            key={index + ":" + segment.start}
            className={
              "caption-row" +
              (now >= segment.start && now < segment.end ? " current" : "")
            }
          >
            <button
              type="button"
              className="tool"
              onClick={() => seek(segment.start)}
            >
              {segment.start.toFixed(2)}–{segment.end.toFixed(2)}
            </button>
            <textarea
              rows={2}
              aria-label={`Caption ${index + 1}`}
              value={segment.text}
              onChange={(e) =>
                change(
                  segments.map((entry, i) =>
                    i === index ? { ...entry, text: e.target.value } : entry,
                  ),
                )
              }
            />
            <div className="candidate-actions">
              <button
                type="button"
                className="tool"
                onClick={() => change(splitCaption(segments, index))}
              >
                Split
              </button>
              <button
                type="button"
                className="tool"
                disabled={index >= segments.length - 1}
                onClick={() => change(mergeCaptions(segments, index))}
              >
                Merge next
              </button>
              <button
                type="button"
                className="tool"
                onClick={() => change(segments.filter((_, i) => i !== index))}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
