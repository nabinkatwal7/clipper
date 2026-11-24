"use client";
import { useEffect, useState } from "react";
export function FrameSuggestion({
  project,
  at,
  apply,
}: {
  project: string;
  at: number;
  apply: (v: { time: number; x: number; y: number }) => void;
}) {
  const [models, list] = useState<string[]>([]),
    [model, select] = useState(""),
    [busy, setBusy] = useState(false),
    [suggestion, setSuggestion] = useState<{
      time: number;
      x: number;
      y: number;
    } | null>(null),
    [msg, note] = useState("");
  useEffect(() => {
    const ctrl = new AbortController();
    fetch("/api/diagnostics", { signal: ctrl.signal })
      .then((r) => r.json())
      .then((d) => {
        const names = d.models
          .filter((m: { capabilities: string[] }) =>
            m.capabilities.includes("vision"),
          )
          .map((m: { name: string }) => m.name);
        list(names);
        select(
          names.includes(localStorage.getItem("studio-vision-model"))
            ? localStorage.getItem("studio-vision-model") || ""
            : names[0] || "",
        );
      })
      .catch(() => {});
    return () => ctrl.abort();
  }, []);
  if (!models.length) return null;
  return (
    <section>
      <label className="field">
        Vision model
        <select value={model} onChange={(e) => select(e.target.value)}>
          {models.map((m) => (
            <option key={m}>{m}</option>
          ))}
        </select>
      </label>
      <button
        className="tool"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          note("");
          setSuggestion(null);
          try {
            const r = await fetch("/api/vision-crop", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ project, at, model }),
            });
            const d = await r.json();
            if (!r.ok) throw Error(d.error);
            setSuggestion({ time: at, x: d.x, y: d.y });
          } catch (e) {
            note(String(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Inspecting frame…" : "Suggest crop for this frame"}
      </button>
      {suggestion && (
        <button
          onClick={() => {
            apply(suggestion);
            setSuggestion(null);
          }}
        >
          Apply focal point {Math.round(suggestion.x * 100)}%,{" "}
          {Math.round(suggestion.y * 100)}% at {suggestion.time.toFixed(2)}s
        </button>
      )}
      <p role="status">{msg}</p>
    </section>
  );
}
