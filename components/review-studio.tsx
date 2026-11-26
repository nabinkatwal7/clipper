"use client";
import { useEffect, useMemo, useState } from "react";
import { MessageSquare, Check, Plus } from "lucide-react";
import type { Project } from "@/lib/types";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";

type ReviewStatus =
  | "draft"
  | "needs-review"
  | "approved"
  | "changes-requested";

type ReviewItem = {
  id: string;
  projectId: string;
  clipId: string;
  title: string;
  status: ReviewStatus;
  updatedAt: string;
  comments: {
    id: string;
    at: number;
    body: string;
    author: string;
    resolved: boolean;
  }[];
};

export function ReviewStudio({ projects }: { projects: Project[] }) {
  const withClips = useMemo(
    () => projects.filter((p) => p.clips.length),
    [projects],
  );
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [projectId, setProjectId] = useState(withClips[0]?.id || "");
  const project = withClips.find((p) => p.id === projectId) || withClips[0];
  const [clipId, setClipId] = useState(project?.clips[0]?.id || "");
  const [selected, setSelected] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [at, setAt] = useState("0");
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const item = items.find((i) => i.id === selected) || items[0];

  async function reload() {
    const r = await fetch("/api/review-studio");
    const data = await r.json();
    if (!r.ok) throw Error(data.error || "Load failed");
    setItems(Array.isArray(data) ? data : []);
    if (!selected && data[0]?.id) setSelected(data[0].id);
  }

  useEffect(() => {
    reload().catch(() => setError("Could not load reviews"));
  }, []);

  async function enqueue() {
    if (!project || !clipId) return;
    const clip = project.clips.find((c) => c.id === clipId);
    if (!clip) return;
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/review-studio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          op: "create",
          projectId: project.id,
          clipId: clip.id,
          title: clip.title,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw Error(data.error || "Create failed");
      await reload();
      setSelected(data.id);
      setMsg("Clip queued for review");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(status: ReviewStatus) {
    if (!item) return;
    setBusy(true);
    try {
      const r = await fetch("/api/review-studio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ op: "save", item: { ...item, status } }),
      });
      const data = await r.json();
      if (!r.ok) throw Error(data.error || "Save failed");
      await reload();
      setMsg(`Marked ${status}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function addNote() {
    if (!item || !note.trim()) return;
    setBusy(true);
    try {
      const r = await fetch("/api/review-studio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          op: "comment",
          id: item.id,
          body: note,
          at: Number(at) || 0,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw Error(data.error || "Comment failed");
      setNote("");
      await reload();
      setSelected(data.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Comment failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="review-studio">
      <header className="panel-head">
        <div>
          <h2>Review Studio</h2>
          <p>
            Local clip review queue with timestamped notes and approval states.
            Nothing leaves this machine.
          </p>
        </div>
        <Badge variant="outline">
          <MessageSquare size={12} /> Live
        </Badge>
      </header>

      <div className="reel-grid">
        <label>
          Project
          <select
            value={project?.id || ""}
            onChange={(e) => {
              setProjectId(e.target.value);
              const p = withClips.find((x) => x.id === e.target.value);
              setClipId(p?.clips[0]?.id || "");
            }}
          >
            {withClips.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          Clip
          <select value={clipId} onChange={(e) => setClipId(e.target.value)}>
            {(project?.clips || []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </label>
        <Button disabled={busy || !clipId} onClick={() => void enqueue()}>
          <Plus size={14} /> Queue for review
        </Button>
      </div>

      <div className="review-layout">
        <ul className="review-queue">
          {items.map((row) => (
            <li key={row.id}>
              <button
                type="button"
                className={item?.id === row.id ? "current" : ""}
                onClick={() => setSelected(row.id)}
              >
                <strong>{row.title}</strong>
                <small>
                  {row.status} · {row.comments.length} notes
                </small>
              </button>
            </li>
          ))}
          {!items.length && <li className="empty">No review items yet.</li>}
        </ul>

        <div className="review-detail">
          {!item ? (
            <p className="empty">Select or queue a clip.</p>
          ) : (
            <>
              <div className="bar-tools">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => void setStatus("approved")}
                >
                  <Check size={14} /> Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => void setStatus("changes-requested")}
                >
                  Request changes
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => void setStatus("needs-review")}
                >
                  Needs review
                </Button>
              </div>
              <ul className="review-comments">
                {item.comments.map((c) => (
                  <li key={c.id}>
                    <strong>{c.at.toFixed(1)}s</strong> — {c.body}
                    <small> · {c.author}</small>
                  </li>
                ))}
                {!item.comments.length && (
                  <li className="muted">No notes yet.</li>
                )}
              </ul>
              <div className="reel-grid">
                <label>
                  Time (s)
                  <Input value={at} onChange={(e) => setAt(e.target.value)} />
                </label>
                <label>
                  Note
                  <Input
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Trim the cold open…"
                  />
                </label>
              </div>
              <Button
                disabled={busy || !note.trim()}
                onClick={() => void addNote()}
              >
                Add note
              </Button>
            </>
          )}
        </div>
      </div>

      {error && <p className="error">{error}</p>}
      {msg && <p className="notice">{msg}</p>}
    </div>
  );
}
