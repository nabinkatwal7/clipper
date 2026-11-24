"use client";
import { useState } from "react";
import type { EditProposal } from "@/lib/director";
export function DirectorPanel({
  project,
  clip,
  apply,
}: {
  project: string;
  clip: string;
  apply: (p: EditProposal) => void;
}) {
  const [instruction, setInstruction] = useState(""),
    [items, setItems] = useState<EditProposal[]>([]),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  async function suggest() {
    setBusy(true);
    setMessage("");
    setItems([]);
    try {
      const r = await fetch("/api/director", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project, clip, instruction }),
      });
      const data = await r.json();
      if (!r.ok) throw Error(data.error);
      setItems(data);
      if (!data.length)
        setMessage(
          "No supported changes were suggested. Try a specific trim, title, layout, or zoom request.",
        );
    } catch (e) {
      setMessage(String(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="editor-fields">
      <h3>AI Director</h3>
      <label className="field">
        Editing instructions
        <textarea
          maxLength={1200}
          placeholder="Find a shorter opening using the transcript"
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
        />
      </label>
      <button
        className="button primary"
        disabled={busy || !instruction.trim()}
        onClick={suggest}
      >
        {busy ? "Consulting Ollama…" : "Suggest edits"}
      </button>
      <p role="status">{message}</p>
      {items.map((p, i) => (
        <article key={i}>
          <strong>
            {p.kind === "range"
              ? p.start.toFixed(2) + "–" + p.end.toFixed(2) + " s"
              : p.kind === "zoom"
                ? p.scale + "× zoom"
                : p.kind === "layout"
                  ? p.layout + " layout"
                  : p.title}
          </strong>
          <p>{p.why}</p>
          <button
            className="tool"
            onClick={() => {
              apply(p);
              setItems(items.filter((_, n) => n !== i));
            }}
          >
            Apply to draft
          </button>
          <button
            className="tool"
            onClick={() => setItems(items.filter((_, n) => n !== i))}
          >
            Reject
          </button>
        </article>
      ))}
    </section>
  );
}
