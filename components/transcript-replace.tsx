"use client";

import { useState } from "react";

type Preview = {
  count: number;
  revision: string;
  changes: { start: number; before: string; after: string }[];
};

export function TranscriptReplace({
  project,
  refresh,
}: {
  project: string;
  refresh: () => Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [replacement, setReplacement] = useState("");
  const [matchCase, setMatchCase] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function submit(apply: boolean) {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/transcript", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project,
          action: apply ? "replace-apply" : "replace-preview",
          query,
          text: replacement,
          matchCase,
          revision: preview?.revision,
        }),
      });
      const result = await response.json();
      if (!response.ok)
        throw Error(result.error || "Could not update transcript.");
      if (!apply) {
        setPreview(result);
        setMessage(result.count + " segments would change.");
      } else {
        setPreview(null);
        setMessage(result.count + " segments updated.");
        try {
          await refresh();
        } catch {
          setMessage("Changes saved. Reopen the transcript to see them.");
        }
      }
    } catch (error) {
      setPreview(null);
      setMessage(
        error instanceof Error ? error.message : "Could not update transcript.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="clip-context">
      <summary>Find and replace across this transcript</summary>
      <div className="field-grid">
        <label className="field">
          Find phrase
          <input
            disabled={busy}
            maxLength={200}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPreview(null);
            }}
          />
        </label>
        <label className="field">
          Replacement
          <input
            disabled={busy}
            maxLength={400}
            value={replacement}
            onChange={(e) => {
              setReplacement(e.target.value);
              setPreview(null);
            }}
          />
        </label>
      </div>
      <label className="check-row">
        <input
          type="checkbox"
          disabled={busy}
          checked={matchCase}
          onChange={(e) => {
            setMatchCase(e.target.checked);
            setPreview(null);
          }}
        />{" "}
        Match case
      </label>
      <div className="candidate-actions">
        <button
          className="tool"
          disabled={busy || !query.trim()}
          onClick={() => submit(false)}
        >
          Preview replacements
        </button>
        {preview && preview.count > 0 && (
          <button
            className="button primary"
            disabled={busy}
            onClick={() => submit(true)}
          >
            Apply to {preview.count} segments
          </button>
        )}
      </div>
      <p role="status">{message}</p>
      {preview && preview.changes.length > 0 && (
        <ol>
          {preview.changes.map((row, i) => (
            <li key={i}>
              <small>{row.start.toFixed(2)}s</small>
              <p>
                <del>{row.before}</del>
              </p>
              <p>
                <ins>{row.after}</ins>
              </p>
            </li>
          ))}
        </ol>
      )}
      {preview && preview.count > preview.changes.length && (
        <p>Showing the first {preview.changes.length} changes.</p>
      )}
    </details>
  );
}
