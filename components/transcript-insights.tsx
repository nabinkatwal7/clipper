"use client";
import { useEffect, useState } from "react";
import type { Project } from "@/lib/types";
import type { transcriptInsights } from "@/lib/transcript-insights";
export function TranscriptInsights({ project: p }: { project: Project }) {
  const [notes, setNotes] = useState<
      Awaited<ReturnType<typeof transcriptInsights>>
    >([]),
    [glossary, setGlossary] = useState(""),
    [from, setFrom] = useState(0),
    [to, setTo] = useState(p.duration),
    [busy, setBusy] = useState(false),
    [message, note] = useState("");
  useEffect(() => {
    fetch("/api/preferences?group=workspace")
      .then((r) => r.json())
      .then((d) =>
        setGlossary(
          typeof d["glossary-" + p.id] === "string"
            ? d["glossary-" + p.id]
            : "",
        ),
      )
      .catch(() => {});
  }, [p.id]);
  return (
    <details>
      <summary>Analyze topics, chapters and quotes</summary>
      <div className="field-grid">
        <label className="field">
          From (seconds)
          <input
            type="number"
            value={from}
            min="0"
            onChange={(e) => setFrom(+e.target.value)}
          />
        </label>
        <label className="field">
          To (seconds)
          <input
            type="number"
            value={to}
            max={p.duration}
            onChange={(e) => setTo(+e.target.value)}
          />
        </label>
      </div>
      <label className="field">
        Project glossary
        <textarea
          value={glossary}
          maxLength={2000}
          onChange={(e) => setGlossary(e.target.value)}
        />
      </label>
      <button
        className="tool"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          note("");
          try {
            const r = await fetch("/api/transcript-insights", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ project: p.id, glossary, from, to }),
            });
            const d = await r.json();
            if (!r.ok) throw Error(d.error);
            setNotes(d);
            note(d.length + " source-linked notes.");
          } catch (e) {
            note(String(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy
          ? "Analyzing transcript with Ollama…"
          : "Analyze selected transcript"}
      </button>
      <p role="status">{message}</p>
      {notes.map((n, i) => (
        <article key={i}>
          <small>
            {n.type} · {n.start.toFixed(1)}s
          </small>
          <p>{n.label}</p>
          <blockquote>{n.quote}</blockquote>
          {n.answer && <p>Transcript answer · {n.answer}</p>}
        </article>
      ))}
    </details>
  );
}
