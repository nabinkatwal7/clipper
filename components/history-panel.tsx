"use client";
import { useEffect, useState } from "react";
import type { Checkpoint } from "@/lib/checkpoints";
import type { Clip } from "@/lib/types";
export function HistoryPanel({
  project,
  clip,
  restore,
}: {
  project: string;
  clip: Clip;
  restore: (v: Checkpoint["clip"]) => void;
}) {
  const [rows, setRows] = useState<Checkpoint[]>([]),
    [name, setName] = useState(""),
    [msg, setMsg] = useState("");
  const url = "/api/checkpoints?project=" + project + "&clip=" + clip.id;
  useEffect(() => {
    fetch(url)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw Error(d.error);
        setRows(d);
      })
      .catch((e) => setMsg(String(e)));
  }, [url]);
  return (
    <div className="editor-fields">
      <h3>Version history</h3>
      <label className="field">
        Checkpoint name
        <input
          value={name}
          maxLength={120}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <button
        className="tool"
        disabled={!name.trim()}
        onClick={async () => {
          try {
            const r = await fetch(url, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ name }),
            });
            const d = await r.json();
            if (!r.ok) throw Error(d.error);
            setRows([d, ...rows]);
            setName("");
          } catch (e) {
            setMsg(String(e));
          }
        }}
      >
        Checkpoint saved render
      </button>
      {msg && <p role="status">{msg}</p>}
      {rows.map((v) => (
        <details key={v.id}>
          <summary>
            {v.name} · {new Date(v.at).toLocaleString()}
          </summary>
          <p>
            {v.clip.title} · {v.clip.start}–{v.clip.end}s
          </p>
          <p>
            {Object.keys({ ...v.clip.settings, ...clip.settings })
              .filter(
                (k) =>
                  JSON.stringify(
                    v.clip.settings[k as keyof Clip["settings"]],
                  ) !==
                  JSON.stringify(clip.settings[k as keyof Clip["settings"]]),
              )
              .join(", ") || "Render settings match this version."}
          </p>
          <button className="tool" onClick={() => restore(v.clip)}>
            Restore to draft
          </button>
        </details>
      ))}
    </div>
  );
}
