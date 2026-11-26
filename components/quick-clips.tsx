"use client";

import { useState } from "react";
import type { Project } from "@/lib/types";

type Range = { start: number; end: number; title?: string };
export function QuickClips({
  project,
  time,
  seek,
  highlighted,
}: {
  project: Project;
  time: number;
  seek: (t: number) => void;
  highlighted?: Range;
}) {
  const [start, setStart] = useState<number>();
  const [ranges, setRanges] = useState<Range[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const at = Math.round(time * 1000) / 1000;
  function add(range: Range) {
    if (
      range.start < 0 ||
      range.end > project.duration ||
      range.end - range.start < 0.25 ||
      range.end - range.start > 600
    ) {
      setMessage(
        "Choose a range inside the recording between 0.25 seconds and 10 minutes.",
      );
      return;
    }
    if (ranges.some((r) => r.start === range.start && r.end === range.end)) {
      setMessage("That range is already in the batch.");
      return;
    }
    setRanges([...ranges, range]);
    setMessage("");
  }
  async function render() {
    setBusy(true);
    setMessage("");
    try {
      const r = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project: project.id, ranges }),
      });
      const data = await r.json();
      if (!r.ok) throw Error(data.error || "Could not queue clips.");
      setMessage(
        `${ranges.length} clips queued. Follow them in Processing queue.`,
      );
      setRanges([]);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not queue clips.");
    } finally {
      setBusy(false);
    }
  }
  const full = ranges.length >= 20;
  return (
    <section className="studio-section">
      <h3>Quick clips</h3>
      <div className="candidate-actions">
        <button className="tool" disabled={busy} onClick={() => setStart(at)}>
          Mark start at {at.toFixed(2)}s
        </button>
        <button
          className="tool"
          disabled={busy || full || start === undefined || at - start < 0.25}
          onClick={() => {
            if (start !== undefined)
              add({ start, end: Math.min(at, project.duration) });
          }}
        >
          Add range to playhead
        </button>
        <button
          className="tool"
          disabled={busy || full || at < 0.25}
          onClick={() =>
            add({
              start: Math.max(0, at - 30),
              end: Math.min(at, project.duration),
            })
          }
        >
          Add previous 30 seconds
        </button>
        {highlighted && (
          <button
            className="tool"
            disabled={busy || full}
            onClick={() => add(highlighted)}
          >
            Add selected highlight
          </button>
        )}
      </div>
      {start !== undefined && <p>Start marked at {start.toFixed(2)}s</p>}
      {ranges.map((r, index) => (
        <div className="schedule-row" key={`${r.start}-${r.end}`}>
          <button className="tool" onClick={() => seek(r.start)}>
            {r.start.toFixed(2)}–{r.end.toFixed(2)}s
          </button>
          <input
            aria-label={`Clip ${index + 1} title`}
            placeholder={`Manual clip ${index + 1}`}
            maxLength={160}
            disabled={busy}
            value={r.title ?? ""}
            onChange={(e) =>
              setRanges(
                ranges.map((item, i) =>
                  i === index ? { ...item, title: e.target.value } : item,
                ),
              )
            }
          />
          <button
            className="tool"
            disabled={busy}
            onClick={() => setRanges(ranges.filter((_, i) => i !== index))}
          >
            Remove
          </button>
        </div>
      ))}
      <button
        className="button primary"
        disabled={
          busy ||
          !ranges.length ||
          ["queued", "processing"].includes(project.status)
        }
        onClick={render}
      >
        {busy
          ? "Queuing…"
          : `Render batch${ranges.length ? ` (${ranges.length})` : ""}`}
      </button>
      <p role="status">{message}</p>
    </section>
  );
}
