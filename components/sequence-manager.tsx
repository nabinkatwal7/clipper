"use client";
import { useState } from "react";
import { Copy, Plus, GitBranch } from "lucide-react";
import type { Project } from "@/lib/types";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";

type SeqDoc = {
  schemaVersion: 1;
  activeSequence?: string;
  sequences: {
    id: string;
    name: string;
    nestedOf?: string;
    composition: { tracks: unknown[] };
  }[];
};

export function SequenceManager({
  project,
  clipId,
  onChanged,
}: {
  project: Project;
  clipId: string;
  onChanged: (doc?: SeqDoc) => Promise<void> | void;
}) {
  const initial = (project.settings.sequences || {
    schemaVersion: 1,
    sequences: [],
  }) as SeqDoc;
  const [doc, setDoc] = useState<SeqDoc>(initial);
  const [name, setName] = useState("Alt cut");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function run(body: Record<string, unknown>) {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/sequences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project: project.id,
          clip: clipId,
          ...body,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw Error(data.error || "Sequence update failed");
      setDoc(data.sequences);
      await onChanged(data.sequences);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sequence update failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="sequence-manager">
      <header className="panel-head">
        <div>
          <h3>Sequences</h3>
          <p>Multiple timelines per project. Nesting cannot form cycles.</p>
        </div>
        <Badge variant="outline">{doc.sequences.length || 0}</Badge>
      </header>
      <ul className="sequence-list">
        {doc.sequences.map((s) => (
          <li key={s.id} className={doc.activeSequence === s.id ? "current" : ""}>
            <button
              type="button"
              disabled={busy}
              onClick={() => void run({ op: "activate", id: s.id })}
            >
              <strong>{s.name}</strong>
              <small>
                {s.composition?.tracks?.length || 0} tracks
                {s.nestedOf ? " · nested" : ""}
              </small>
            </button>
            <Button
              size="icon"
              variant="ghost"
              disabled={busy}
              title="Duplicate"
              onClick={() => void run({ op: "duplicate", id: s.id })}
            >
              <Copy size={14} />
            </Button>
          </li>
        ))}
        {!doc.sequences.length && (
          <li className="empty">No sequences yet — create Main from composition.</li>
        )}
      </ul>
      <div className="instant-add">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Sequence name"
        />
        <Button
          size="sm"
          disabled={busy || !name.trim()}
          onClick={() => void run({ op: "add", name })}
        >
          <Plus size={14} /> Add
        </Button>
        {!doc.sequences.length && (
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => void run({ op: "ensure" })}
          >
            <GitBranch size={14} /> Initialize
          </Button>
        )}
      </div>
      {error && <p className="error">{error}</p>}
    </div>
  );
}
