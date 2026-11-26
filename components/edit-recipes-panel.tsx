"use client";
import { useEffect, useState } from "react";
import { Play, Save, Trash2 } from "lucide-react";
import type { Settings } from "@/lib/types";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Input } from "./ui/input";

type Recipe = {
  id: string;
  name: string;
  description: string;
  operations: { op: string }[];
};

export function EditRecipesPanel({
  projectId,
  clipId,
  settings,
  onApply,
}: {
  projectId: string;
  clipId: string;
  settings: Settings;
  onApply: (s: Settings) => void;
}) {
  const [rows, setRows] = useState<Recipe[]>([]);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const r = await fetch("/api/recipes");
    const data = await r.json();
    setRows(Array.isArray(data) ? data : []);
  }

  useEffect(() => {
    void load().catch(() => setError("Could not load recipes"));
  }, []);

  return (
    <div className="edit-recipes">
      <header className="panel-head">
        <div>
          <h3>Edit recipes</h3>
          <p>
            Reusable structured operations — layout, captions, grade, encode.
            Configuration replication, not generative style transfer.
          </p>
        </div>
      </header>
      <ul className="suggestion-list">
        {rows.map((r) => (
          <li key={r.id}>
            <div>
              <strong>{r.name}</strong>
              <Badge variant="outline">{r.operations.length} ops</Badge>
              <p>{r.description || "No description"}</p>
            </div>
            <div className="bar-tools">
              <Button
                size="sm"
                disabled={busy}
                onClick={() => {
                  setBusy(true);
                  fetch("/api/recipes", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      op: "apply",
                      id: r.id,
                      project: projectId,
                      clip: clipId,
                    }),
                  })
                    .then(async (res) => {
                      const data = await res.json();
                      if (!res.ok) throw Error(data.error || "Apply failed");
                      onApply(data.settings);
                    })
                    .catch((e) =>
                      setError(e instanceof Error ? e.message : "Apply failed"),
                    )
                    .finally(() => setBusy(false));
                }}
              >
                <Play size={14} /> Apply
              </Button>
              <Button
                size="icon"
                variant="ghost"
                aria-label="Delete recipe"
                onClick={() =>
                  void fetch("/api/recipes", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ op: "delete", id: r.id }),
                  }).then(load)
                }
              >
                <Trash2 size={14} />
              </Button>
            </div>
          </li>
        ))}
      </ul>
      <div className="instant-add">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Save current settings as recipe"
        />
        <Button
          size="sm"
          disabled={busy || !name.trim()}
          onClick={() => {
            setBusy(true);
            fetch("/api/recipes", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                op: "capture",
                project: projectId,
                clip: clipId,
                name,
              }),
            })
              .then(async (r) => {
                const data = await r.json();
                if (!r.ok) throw Error(data.error || "Save failed");
                setName("");
                // settings available for capture validation
                void settings;
                return load();
              })
              .catch((e) =>
                setError(e instanceof Error ? e.message : "Save failed"),
              )
              .finally(() => setBusy(false));
          }}
        >
          <Save size={14} /> Capture
        </Button>
      </div>
      {error && <p className="error">{error}</p>}
    </div>
  );
}
