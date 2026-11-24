"use client";
import { useEffect, useState } from "react";
import type { Asset } from "@/lib/assets";
import type { Project } from "@/lib/types";
export function AssetLibrary({
  projects,
  insert,
}: {
  projects?: Project[];
  insert?: (a: Asset) => void;
}) {
  const [items, setItems] = useState<Asset[]>([]),
    [q, setQ] = useState(""),
    [id, setId] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    fetch("/api/assets")
      .then(async (r) => {
        if (!r.ok) throw Error((await r.json()).error);
        setItems(await r.json());
      })
      .catch((e) => setError(String(e)));
  }, []);
  async function upload(files: File[]) {
    setBusy(true);
    setError("");
    try {
      for (const f of files) {
        const r = await fetch("/api/assets", {
          method: "POST",
          headers: {
            "Content-Type": "application/octet-stream",
            "X-File-Name": encodeURIComponent(f.name),
          },
          body: f,
        });
        const data = await r.json();
        if (!r.ok) throw Error(data.error);
        setItems((v) => [...v, data]);
        setId(data.id);
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  const selected = items.find((i) => i.id === id);
  return (
    <div
      className="asset-library"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        if (e.dataTransfer.files.length) {
          e.preventDefault();
          if (!busy) void upload([...e.dataTransfer.files]);
        }
      }}
    >
      <label className="field">
        Import local media
        <input
          aria-label="Import assets"
          disabled={busy}
          type="file"
          accept="image/*,video/*,audio/*"
          multiple
          onChange={(e) => void upload([...(e.target.files || [])])}
        />
      </label>
      <label className="field">
        Find assets
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Name, folder, description or tag"
        />
      </label>
      {busy && <p role="status">Importing and inspecting media…</p>}
      {error && <p role="alert">{error}</p>}
      <div className="asset-rows">
        {items
          .filter((a) =>
            [a.name, a.description, a.folder, ...a.tags]
              .join(" ")
              .toLowerCase()
              .includes(q.toLowerCase()),
          )
          .map((a) => (
            <div
              key={a.id}
              className="schedule-row"
              draggable
              onDragStart={(e) =>
                e.dataTransfer.setData("application/x-clipper-asset", a.id)
              }
            >
              <button onClick={() => setId(a.id)}>
                {a.favorite ? "★ " : ""}
                {a.name}
                <small> · {a.kind}</small>
              </button>
              {insert && (
                <button className="tool" onClick={() => insert(a)}>
                  Insert
                </button>
              )}
            </div>
          ))}
      </div>
      {!items.length && (
        <p className="hint">
          Drop a video, image or audio file here to reuse it across edits.
        </p>
      )}
      {selected && (
        <AssetDetail
          key={selected.id}
          a={selected}
          usage={
            projects
              ?.flatMap((p) => p.clips)
              .filter((c) =>
                c.settings.composition?.tracks.some(
                  (t) => t.asset === selected.id,
                ),
              ).length
          }
          saved={(a) =>
            setItems(items.map((item) => (item.id === a.id ? a : item)))
          }
        />
      )}
    </div>
  );
}
function AssetDetail({
  a,
  usage,
  saved,
}: {
  a: Asset;
  usage?: number;
  saved: (a: Asset) => void;
}) {
  const [d, set] = useState(a),
    [note, message] = useState("");
  const src = "/api/assets?id=" + a.id;
  return (
    <details open className="clip-context">
      <summary>{a.name}</summary>
      {a.kind === "image" ? (
        <img className="source-monitor" src={src} alt={a.name} />
      ) : a.kind === "audio" ? (
        <audio controls src={src} />
      ) : (
        <video controls className="source-monitor" src={src} />
      )}
      <p>
        {(a.bytes / 1048576).toFixed(1)} MB
        {usage !== undefined ? " · Used in " + usage + " clips" : ""}
      </p>
      {(["folder", "description"] as const).map((k) => (
        <label className="field" key={k}>
          {k}
          <input
            value={d[k]}
            onChange={(e) => set({ ...d, [k]: e.target.value })}
          />
        </label>
      ))}
      <label className="field">
        Tags
        <input
          value={d.tags.join(",")}
          onChange={(e) => set({ ...d, tags: e.target.value.split(",") })}
        />
      </label>
      <label className="check-row">
        <input
          type="checkbox"
          checked={d.favorite}
          onChange={(e) => set({ ...d, favorite: e.target.checked })}
        />
        Favorite
      </label>
      <button
        className="tool"
        onClick={async () => {
          try {
            const r = await fetch("/api/assets", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(d),
            });
            const v = await r.json();
            if (!r.ok) throw Error(v.error);
            saved(v);
            message("Saved");
          } catch (e) {
            message(String(e));
          }
        }}
      >
        Save asset details
      </button>
      <p role="status">{note}</p>
    </details>
  );
}
