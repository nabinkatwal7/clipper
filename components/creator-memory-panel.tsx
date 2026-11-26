"use client";
import { useEffect, useState } from "react";
import { Plus, Trash2, Save } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";

type CreatorMemory = {
  version: 1;
  id: string;
  name: string;
  topics: string[];
  languages: string[];
  feedback: string[];
  [key: string]: unknown;
};

export function CreatorMemoryPanel() {
  const [rows, setRows] = useState<CreatorMemory[]>([]);
  const [active, setActive] = useState<CreatorMemory | null>(null);
  const [topic, setTopic] = useState("");
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  async function load() {
    const r = await fetch("/api/creator-memory");
    const data = await r.json();
    setRows(Array.isArray(data) ? data : []);
  }

  useEffect(() => {
    void load().catch(() => setError("Could not load creator memory"));
  }, []);

  async function create() {
    const r = await fetch("/api/creator-memory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ op: "create", name: "New creator" }),
    });
    const data = await r.json();
    if (!r.ok) throw Error(data.error || "Create failed");
    setActive(data);
    await load();
  }

  async function save() {
    if (!active) return;
    setError("");
    const r = await fetch("/api/creator-memory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memory: active }),
    });
    const data = await r.json();
    if (!r.ok) {
      setError(data.error || "Save failed");
      return;
    }
    setActive(data);
    setMsg("Saved. This stores local evidence only — Ollama is not retrained.");
    await load();
  }

  return (
    <div className="creator-memory">
      <header className="panel-head">
        <div>
          <h2>Creator Memory</h2>
          <p>
            Local knowledge for streamers — topics, names, glossary. Editable and
            deletable. Does not retrain models.
          </p>
        </div>
        <Button size="sm" onClick={() => void create().catch((e) => setError(e.message))}>
          <Plus size={14} /> New profile
        </Button>
      </header>
      <div className="memory-layout">
        <ul className="memory-list">
          {rows.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                className={active?.id === m.id ? "current" : ""}
                onClick={() => setActive(m)}
              >
                {m.name}
              </button>
              <Button
                size="icon"
                variant="ghost"
                aria-label="Delete memory"
                onClick={() =>
                  void fetch("/api/creator-memory", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ op: "delete", id: m.id }),
                  }).then(() => {
                    if (active?.id === m.id) setActive(null);
                    return load();
                  })
                }
              >
                <Trash2 size={14} />
              </Button>
            </li>
          ))}
          {!rows.length && <li className="empty">No profiles yet.</li>}
        </ul>
        {active && (
          <div className="memory-editor">
            <label>
              Name
              <Input
                value={active.name}
                onChange={(e) =>
                  setActive({ ...active, name: e.target.value })
                }
              />
            </label>
            <label>
              Languages (comma-separated)
              <Input
                value={active.languages.join(", ")}
                onChange={(e) =>
                  setActive({
                    ...active,
                    languages: e.target.value
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean),
                  })
                }
              />
            </label>
            <div className="memory-tags">
              <h3>Topics</h3>
              <div className="tag-row">
                {active.topics.map((t) => (
                  <Badge key={t} variant="secondary">
                    {t}
                  </Badge>
                ))}
              </div>
              <div className="instant-add">
                <Input
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="Add topic from transcript evidence"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (!topic.trim()) return;
                    setActive({
                      ...active,
                      topics: [...new Set([...active.topics, topic.trim()])],
                    });
                    setTopic("");
                  }}
                >
                  Add
                </Button>
              </div>
            </div>
            <label>
              Feedback notes
              <textarea
                rows={4}
                value={active.feedback.join("\n")}
                onChange={(e) =>
                  setActive({
                    ...active,
                    feedback: e.target.value
                      .split("\n")
                      .map((s) => s.trim())
                      .filter(Boolean)
                      .slice(0, 200),
                  })
                }
              />
            </label>
            <Button size="sm" onClick={() => void save()}>
              <Save size={14} /> Save profile
            </Button>
          </div>
        )}
      </div>
      {error && <p className="error">{error}</p>}
      {msg && <p className="notice">{msg}</p>}
    </div>
  );
}
