"use client";
import { useEffect, useState } from "react";
import { Search, BookmarkPlus, Trash2 } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";

type Hit = {
  project: string;
  clip?: string;
  title: string;
  start: number;
  end: number;
  text: string;
  similarity?: number;
};

type Saved = {
  id: string;
  name: string;
  query: string;
  mode: "exact" | "fuzzy" | "semantic";
};

export function MomentSearchPanel({
  onOpen,
}: {
  onOpen?: (project: string, clip?: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<"exact" | "fuzzy" | "semantic">("fuzzy");
  const [model, setModel] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [saved, setSaved] = useState<Saved[]>([]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function refreshSaved() {
    fetch("/api/moment-search")
      .then((r) => r.json())
      .then(setSaved)
      .catch(() => {});
  }

  useEffect(() => {
    refreshSaved();
  }, []);

  async function run(q = query, m = mode) {
    if (!q.trim()) return;
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/moment-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: q,
          mode: m,
          model: m === "semantic" ? model : undefined,
          scope: "all",
        }),
      });
      const data = await r.json();
      if (!r.ok) throw Error(data.error || "Search failed");
      setHits(data.hits || []);
      setNote(data.note || "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="moment-search">
      <header className="panel-head">
        <div>
          <h2>Moment Search</h2>
          <p>
            Find conversations across authorized transcripts and clips. Semantic
            mode needs an embedding model in Ollama.
          </p>
        </div>
      </header>
      <div className="moment-controls">
        <label className="search-field">
          <Search size={14} />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. funny Nepali moments about football"
            aria-label="Moment query"
            onKeyDown={(e) => {
              if (e.key === "Enter") void run();
            }}
          />
        </label>
        <select
          aria-label="Search mode"
          value={mode}
          onChange={(e) => setMode(e.target.value as typeof mode)}
        >
          <option value="exact">Exact</option>
          <option value="fuzzy">Fuzzy</option>
          <option value="semantic">Semantic</option>
        </select>
        {mode === "semantic" && (
          <Input
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="Embedding model name"
            aria-label="Embedding model"
          />
        )}
        <Button size="sm" disabled={busy || !query.trim()} onClick={() => void run()}>
          {busy ? "Searching…" : "Search"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={!query.trim()}
          onClick={() => {
            fetch("/api/moment-search", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                op: "save",
                name: query.slice(0, 60),
                query,
                mode,
                model: mode === "semantic" ? model : undefined,
              }),
            }).then(refreshSaved);
          }}
        >
          <BookmarkPlus size={14} /> Save
        </Button>
      </div>
      {!!saved.length && (
        <div className="saved-searches">
          {saved.map((s) => (
            <button
              key={s.id}
              type="button"
              className="chip"
              onClick={() => {
                setQuery(s.query);
                setMode(s.mode);
                void run(s.query, s.mode);
              }}
            >
              {s.name}
              <span
                role="button"
                tabIndex={0}
                aria-label="Delete saved search"
                onClick={(e) => {
                  e.stopPropagation();
                  fetch("/api/moment-search", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ op: "delete", id: s.id }),
                  }).then(refreshSaved);
                }}
              >
                <Trash2 size={12} />
              </span>
            </button>
          ))}
        </div>
      )}
      {error && <p className="error">{error}</p>}
      {note && <p className="notice">{note}</p>}
      <ul className="moment-hits">
        {hits.map((h, i) => (
          <li key={i}>
            <div>
              <strong>{h.title}</strong>
              <Badge variant="outline">
                {h.start.toFixed(1)}s–{h.end.toFixed(1)}s
              </Badge>
              {h.similarity !== undefined && (
                <Badge variant="secondary">
                  {(h.similarity * 100).toFixed(0)}%
                </Badge>
              )}
              <p>{h.text}</p>
            </div>
            {onOpen && (
              <Button size="sm" variant="ghost" onClick={() => onOpen(h.project, h.clip)}>
                Open
              </Button>
            )}
          </li>
        ))}
        {!hits.length && <li className="empty">No moments yet.</li>}
      </ul>
    </div>
  );
}
