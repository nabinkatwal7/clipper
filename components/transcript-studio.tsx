"use client";
import { useEffect, useMemo, useState, type MouseEvent } from "react";
import {
  Scissors,
  RotateCcw,
  Captions,
  Search,
  Clapperboard,
  Columns2,
  Sparkles,
  Check,
} from "lucide-react";
import type { Project, Segment } from "@/lib/types";
import {
  clipFromSelection,
  cutDuration,
  deleteDialogue,
  emptyCutState,
  overrideCaption,
  restoreRemoved,
  transcriptComparison,
  type TranscriptCutState,
} from "@/lib/transcript-edit";
import {
  applyApprovedRemovals,
  type DialogueLanguage,
  type DialogueSuggestion,
} from "@/lib/dialogue-suggestions-core";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Input } from "./ui/input";
import { SourceTool } from "./studio-tools";

function fmt(n: number) {
  const m = Math.floor(n / 60),
    s = Math.floor(n % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function TranscriptStudio({
  project,
  generate,
}: {
  project: Project;
  generate: (a: number, b: number) => void;
}) {
  const [rows, setRows] = useState<Segment[]>([]);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<number[]>([]);
  const [cut, setCut] = useState<TranscriptCutState>(() =>
    emptyCutState(project.duration || 0),
  );
  const [history, setHistory] = useState<TranscriptCutState[]>([]);
  const [mode, setMode] = useState<"video" | "caption">("video");
  const [compare, setCompare] = useState(false);
  const [captionDraft, setCaptionDraft] = useState("");
  const [suggestions, setSuggestions] = useState<DialogueSuggestion[]>([]);
  const [suggestBusy, setSuggestBusy] = useState(false);
  const [language, setLanguage] = useState<DialogueLanguage>("mixed");
  const [useOllama, setUseOllama] = useState(true);
  const [roughRequest, setRoughRequest] = useState(
    "Create a 45-second explanation with a clear beginning and ending.",
  );
  const [roughBusy, setRoughBusy] = useState(false);
  const [roughTitle, setRoughTitle] = useState("");

  useEffect(() => {
    const ctrl = new AbortController();
    setError("");
    fetch("/api/transcript?project=" + project.id, { signal: ctrl.signal })
      .then(async (r) => {
        if (!r.ok) throw Error("Could not load transcript");
        return r.json();
      })
      .then((data: Segment[]) => {
        setRows(Array.isArray(data) ? data : []);
        setCut(emptyCutState(project.duration || 0));
        setHistory([]);
        setSelected([]);
      })
      .catch((e) => {
        if (e.name !== "AbortError")
          setError(e.message || "Transcript unavailable");
      });
    return () => ctrl.abort();
  }, [project.id, project.duration]);

  function push(next: TranscriptCutState) {
    setHistory((h) => [...h.slice(-40), cut]);
    setCut(next);
  }

  function undo() {
    setHistory((h) => {
      if (!h.length) return h;
      const prev = h[h.length - 1];
      setCut(prev);
      return h.slice(0, -1);
    });
  }

  function toggle(i: number, e: MouseEvent) {
    if (e.shiftKey && selected.length) {
      const a = selected[selected.length - 1];
      const [lo, hi] = a < i ? [a, i] : [i, a];
      const span = Array.from({ length: hi - lo + 1 }, (_, k) => lo + k);
      setSelected([...new Set([...selected, ...span])].sort((x, y) => x - y));
      return;
    }
    setSelected((cur) =>
      cur.includes(i) ? cur.filter((x) => x !== i) : [...cur, i].sort((x, y) => x - y),
    );
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows.map((row, i) => ({ row, i }));
    return rows
      .map((row, i) => ({ row, i }))
      .filter(({ row }) => row.text.toLowerCase().includes(q));
  }, [rows, query]);

  const comparison = useMemo(
    () => transcriptComparison(rows, cut),
    [rows, cut],
  );

  const timed = rows.length > 0 && rows.every((r) => r.end > r.start);

  function removeSelected() {
    if (!timed) {
      setError("Timestamped transcript required for video cuts");
      return;
    }
    try {
      push(deleteDialogue(cut, rows, selected));
      setSelected([]);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not cut");
    }
  }

  function makeClip() {
    try {
      const h = clipFromSelection(rows, selected);
      generate(h.start, h.end);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Select dialogue first");
    }
  }

  function applyCaption() {
    if (!selected.length) {
      setError("Select a segment to edit captions");
      return;
    }
    try {
      push(overrideCaption(cut, rows[selected[0]].start, captionDraft));
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Caption edit failed");
    }
  }

  return (
    <div className="transcript-studio">
      <header className="panel-head">
        <div>
          <h2>Transcript Studio</h2>
          <p>
            Edit the rough cut by selecting dialogue. Caption fixes never remove
            audio.
          </p>
        </div>
        <div className="bar-tools">
          <Badge variant={timed ? "default" : "secondary"}>
            {timed ? "Timed transcript" : "No timestamps"}
          </Badge>
          <Badge variant="outline">
            Cut {fmt(cutDuration(cut))} / source {fmt(project.duration || 0)}
          </Badge>
        </div>
      </header>

      {!timed && (
        <p className="notice">
          Timestamped transcripts are required for transcript-based video cuts.
          You can still search text and use manual clip ranges below.
        </p>
      )}

      <div className="transcript-toolbar">
        <Button
          size="sm"
          variant={mode === "video" ? "default" : "outline"}
          onClick={() => setMode("video")}
        >
          <Scissors size={14} /> Video edit
        </Button>
        <Button
          size="sm"
          variant={mode === "caption" ? "default" : "outline"}
          onClick={() => setMode("caption")}
        >
          <Captions size={14} /> Caption edit
        </Button>
        <Button
          size="sm"
          variant={compare ? "default" : "outline"}
          onClick={() => setCompare(!compare)}
        >
          <Columns2 size={14} /> Compare
        </Button>
        <Button size="sm" variant="outline" disabled={!history.length} onClick={undo}>
          <RotateCcw size={14} /> Undo
        </Button>
        <label className="search-field">
          <Search size={14} />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search spoken content"
            aria-label="Search transcript"
          />
        </label>
      </div>

      {error && <p className="error">{error}</p>}

      <div className={`transcript-layout ${compare ? "compare" : ""}`}>
        <div className="transcript-rows" role="listbox" aria-label="Transcript">
          {filtered.map(({ row, i }) => (
            <button
              type="button"
              key={i}
              role="option"
              aria-selected={selected.includes(i)}
              className={`transcript-line ${selected.includes(i) ? "selected" : ""} ${
                cut.removed.some((r) => row.start < r.end && row.end > r.start)
                  ? "removed"
                  : ""
              }`}
              onClick={(e) => toggle(i, e)}
            >
              <time>{fmt(row.start)}</time>
              <span>{row.text}</span>
            </button>
          ))}
          {!filtered.length && <p className="empty">No transcript lines.</p>}
        </div>
        {compare && (
          <div className="transcript-compare">
            <h3>Removed dialogue</h3>
            <ul>
              {comparison.removedText.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
              {!comparison.removedText.length && <li>Nothing removed yet.</li>}
            </ul>
            <h3>Removed ranges</h3>
            <ul>
              {cut.removed.map((r, i) => (
                <li key={i}>
                  {fmt(r.start)}–{fmt(r.end)}{" "}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => push(restoreRemoved(cut, r))}
                  >
                    Restore
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="transcript-actions">
        {mode === "video" ? (
          <>
            <Button size="sm" disabled={!selected.length || !timed} onClick={removeSelected}>
              <Scissors size={14} /> Delete selected dialogue
            </Button>
            <Button size="sm" variant="secondary" disabled={!selected.length} onClick={makeClip}>
              <Clapperboard size={14} /> Create clip from selection
            </Button>
          </>
        ) : (
          <>
            <Input
              value={captionDraft}
              onChange={(e) => setCaptionDraft(e.target.value)}
              placeholder="Replacement caption text (audio unchanged)"
              aria-label="Caption override"
            />
            <Button size="sm" onClick={applyCaption}>
              <Captions size={14} /> Apply caption override
            </Button>
          </>
        )}
      </div>

      <section className="rough-cut-panel">
        <header className="panel-head">
          <div>
            <h3>Rough cut generator</h3>
            <p>
              Natural-language assembly into an editable cut — never a final
              render.
            </p>
          </div>
        </header>
        <textarea
          rows={3}
          value={roughRequest}
          onChange={(e) => setRoughRequest(e.target.value)}
          aria-label="Rough cut request"
          placeholder="Create a two-minute summary…"
        />
        <Button
          size="sm"
          disabled={!timed || roughBusy || !roughRequest.trim()}
          onClick={() => {
            setRoughBusy(true);
            setError("");
            fetch("/api/rough-cut", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                project: project.id,
                request: roughRequest,
                model: project.settings.model,
              }),
            })
              .then(async (r) => {
                const data = await r.json();
                if (!r.ok) throw Error(data.error || "Rough cut failed");
                push(data.cut);
                setRoughTitle(
                  `${data.plan.title} · ${Math.round(data.plan.estimatedDuration)}s — ${data.plan.why}`,
                );
                setCompare(true);
              })
              .catch((e) =>
                setError(e instanceof Error ? e.message : "Rough cut failed"),
              )
              .finally(() => setRoughBusy(false));
          }}
        >
          <Sparkles size={14} />
          {roughBusy ? "Building plan…" : "Generate rough cut"}
        </Button>
        {roughTitle && <p className="notice">{roughTitle}</p>}
      </section>

      <section className="dialogue-suggestions">
        <header className="panel-head">
          <div>
            <h3>Smart dialogue suggestions</h3>
            <p>Proposals only — nothing is removed until you approve.</p>
          </div>
          <div className="bar-tools">
            <select
              aria-label="Filler language"
              value={language}
              onChange={(e) =>
                setLanguage(e.target.value as DialogueLanguage)
              }
            >
              <option value="mixed">Mixed</option>
              <option value="en">English</option>
              <option value="ne">Nepali</option>
              <option value="hi">Hindi</option>
            </select>
            <label className="check-row">
              <input
                type="checkbox"
                checked={useOllama}
                onChange={(e) => setUseOllama(e.target.checked)}
              />
              Include Ollama
            </label>
            <Button
              size="sm"
              disabled={!timed || suggestBusy}
              onClick={() => {
                setSuggestBusy(true);
                setError("");
                fetch("/api/dialogue-suggestions", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    project: project.id,
                    language,
                    includeOllama: useOllama,
                    model: project.settings.model,
                  }),
                })
                  .then(async (r) => {
                    const data = await r.json();
                    if (!r.ok) throw Error(data.error || "Suggestion failed");
                    setSuggestions(
                      (data.suggestions || []).map(
                        (s: DialogueSuggestion) => ({
                          ...s,
                          approved: false,
                        }),
                      ),
                    );
                  })
                  .catch((e) =>
                    setError(
                      e instanceof Error ? e.message : "Suggestion failed",
                    ),
                  )
                  .finally(() => setSuggestBusy(false));
              }}
            >
              <Sparkles size={14} />
              {suggestBusy ? "Analyzing…" : "Suggest cuts"}
            </Button>
          </div>
        </header>
        <ul className="suggestion-list">
          {suggestions.map((s, i) => (
            <li key={s.id + i}>
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={!!s.approved}
                  onChange={(e) =>
                    setSuggestions((rows) =>
                      rows.map((row, j) =>
                        j === i
                          ? { ...row, approved: e.target.checked }
                          : row,
                      ),
                    )
                  }
                />
                <span>
                  <Badge variant="outline">{s.kind}</Badge>{" "}
                  <Badge variant="secondary">{s.source}</Badge> {s.why}
                  <small>
                    {" "}
                    {s.ranges
                      .map((r) => `${fmt(r.start)}–${fmt(r.end)}`)
                      .join(", ")}
                  </small>
                </span>
              </label>
            </li>
          ))}
          {!suggestions.length && (
            <li className="empty">No suggestions yet.</li>
          )}
        </ul>
        <Button
          size="sm"
          disabled={!suggestions.some((s) => s.approved)}
          onClick={() => {
            const approved = suggestions.filter((s) => s.approved);
            const keep = applyApprovedRemovals(cut.keep, approved);
            const removed = [
              ...cut.removed,
              ...approved.flatMap((s) =>
                s.action === "remove" ? s.ranges : [],
              ),
            ];
            push({ ...cut, keep, removed });
            setSuggestions((rows) => rows.filter((s) => !s.approved));
          }}
        >
          <Check size={14} /> Apply approved removals
        </Button>
      </section>

      <details className="transcript-manual">
        <summary>Manual clip tools</summary>
        <SourceTool project={project} thumbnail={false} generate={generate} />
      </details>
    </div>
  );
}
