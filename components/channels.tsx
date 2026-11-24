"use client";
import {studioStorage} from "@/lib/client-storage";
import { useEffect, useState } from "react";
import { RefreshCw, Plus, Star, Trash2 } from "lucide-react";
import type { Project } from "@/lib/types";
type Recording = { url: string; title: string };
type Channel = {
  id: string;
  name: string;
  url: string;
  auto: boolean;
  favorite: boolean;
  records: Recording[];
  seen: string[];
  checked?: number;
  attempted?: number;
  thumbnail?: string;
  profile?: string;
  live?: boolean;
  platform?: string;
  instructions: string;
  error?: string;
};
const key = "studio-channels";
function read(): Channel[] {
  try {
    return JSON.parse(studioStorage.getItem(key) || "[]");
  } catch {
    return [];
  }
}
function write(rows: Channel[]) {
  studioStorage.setItem(key, JSON.stringify(rows));
  window.dispatchEvent(new Event(key));
}
function update(id: string, patch: Partial<Channel>) {
  write(read().map((c) => (c.id === id ? { ...c, ...patch } : c)));
}
async function request(action: string, body: unknown) {
  const r = await fetch("/api/" + action, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await r.json();
  if (!r.ok) throw Error(data.error);
  return data;
}
async function check(id: string) {
  await navigator.locks.request(
    "clipper-channel-" + id,
    { ifAvailable: true },
    async (lock) => {
      if (!lock) return;
      const ch = read().find((c) => c.id === id);
      if (!ch) return;
      try {
        update(id, { attempted: Date.now() });
        const data = await request("inspect", { url: ch.url, channel: true });
        const records: Recording[] = data.recordings;
        const fresh = read().find((c) => c.id === id);
        if (!fresh) return;
        const seen = new Set(fresh.seen);
        if (fresh.auto && fresh.checked) {
          for (const rec of [...records].reverse()) {
            if (seen.has(rec.url) || !read().find((c) => c.id === id)?.auto)
              continue;
            await request("import", {
              url: rec.url,
              settings: { instructions: fresh.instructions },
            });
            seen.add(rec.url);
            update(id, { seen: [...seen] });
          }
        }
        records.forEach((r) => seen.add(r.url));
        update(id, {
          records,
          seen: [...seen].slice(-1000),
          checked: Date.now(),
          live: data.live,
          platform: data.platform,
          thumbnail: data.thumbnail,
          error: "",
        });
      } catch (e) {
        update(id, { error: e instanceof Error ? e.message : String(e) });
      }
    },
  );
}
export function useChannelMonitor() {
  useEffect(() => {
    const timer = setInterval(() => {
      const next = read().find(
        (c) =>
          c.auto &&
          Date.now() - (c.attempted || c.checked || 0) > 15 * 60 * 1000,
      );
      if (next) void check(next.id);
    }, 60000);
    return () => clearInterval(timer);
  }, []);
}
export function Channels({
  automation,
  projects,
  open,
  create,
}: {
  automation: boolean;
  projects: Project[];
  open: (id: string) => void;
  create: (url: string) => void;
}) {
  const [rows, setRows] = useState<Channel[]>([]),
    [name, setName] = useState(""),
    [url, setUrl] = useState(""),
    [id, setId] = useState(""),
    [busy, setBusy] = useState(""),
    [err, setErr] = useState("");
  useEffect(() => {
    setId(sessionStorage.getItem("studio-channel") || "");
    const sync = () => setRows(read());
    sync();
    window.addEventListener(key, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(key, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  const selected = rows.find((c) => c.id === id) || rows[0];
  return (
    <>
      <p className="hint">
        {automation
          ? "Enabled channels are checked every 15 minutes while this studio is open. The first check establishes a baseline. New recordings are imported into the local queue."
          : "Save channel recording feeds and check for available recordings."}
      </p>
      {!automation && (
        <form
          className="channel-form"
          onSubmit={(e) => {
            e.preventDefault();
            try {
              const valid = new URL(url);
              if (!["http:", "https:"].includes(valid.protocol)) throw Error();
              if (read().some((c) => c.url === valid.href)) {
                setErr("This feed is already saved.");
                return;
              }
              const ch: Channel = {
                id: crypto.randomUUID(),
                name: name.trim(),
                url: valid.href,
                auto: false,
                favorite: false,
                seen: [],
                records: [],
                instructions: "",
              };
              write([...read(), ch]);
              setId(ch.id);
              setName("");
              setUrl("");
              setErr("");
            } catch {
              setErr("Enter a valid channel feed URL.");
            }
          }}
        >
          <input
            aria-label="Channel name"
            placeholder="Channel name"
            required
            maxLength={80}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            aria-label="Channel feed URL"
            type="url"
            required
            placeholder="Channel recordings URL"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <button className="button primary">
            <Plus size={14} /> Add channel
          </button>
        </form>
      )}
      {err && <p role="alert">{err}</p>}
      {!rows.length ? (
        <p className="studio-empty">
          {automation
            ? "Add a channel under Streamers, then enable automatic imports here."
            : "Add your first streamer using a public channel recordings URL."}
        </p>
      ) : (
        <div className="tool-layout">
          <section>
            <h2>Channels</h2>
            {rows.map((c) => (
              <button
                className={
                  "event-row " + (selected?.id === c.id ? "current" : "")
                }
                onClick={() => setId(c.id)}
                key={c.id}
              >
                <strong>{c.name}</strong>
                <small>{c.auto ? "Auto clipping on" : "Manual import"}</small>
              </button>
            ))}
          </section>
          {selected && (
            <section>
              <div className="section-row">
                {selected.thumbnail && (
                  <img
                    className="channel-thumbnail"
                    src={selected.thumbnail}
                    alt=""
                    referrerPolicy="no-referrer"
                  />
                )}
                <h2>{selected.name}</h2>
                <button
                  title="Favorite channel"
                  aria-pressed={selected.favorite}
                  onClick={() =>
                    update(selected.id, { favorite: !selected.favorite })
                  }
                >
                  <Star
                    size={16}
                    fill={selected.favorite ? "currentColor" : "none"}
                  />
                </button>
              </div>
              <p className="hint">
                {selected.platform || new URL(selected.url).hostname} ·{" "}
                {selected.checked
                  ? "Checked " + new Date(selected.checked).toLocaleString()
                  : "Awaiting first check"}
                {selected.live ? " · Live" : ""}
              </p>
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={selected.auto}
                  onChange={(e) =>
                    update(selected.id, { auto: e.target.checked })
                  }
                />{" "}
                Automatically clip new recordings
              </label>
              <label className="field">
                Clipping instructions
                <textarea
                  maxLength={1200}
                  value={selected.instructions}
                  onChange={(e) =>
                    update(selected.id, { instructions: e.target.value })
                  }
                />
              </label>
              <button
                className="button secondary"
                disabled={busy === selected.id}
                onClick={async () => {
                  setBusy(selected.id);
                  try {
                    await check(selected.id);
                  } finally {
                    setBusy("");
                  }
                }}
              >
                <RefreshCw size={14} />
                {busy === selected.id ? "Checking feed…" : "Check recordings"}
              </button>
              {selected.error && (
                <p className="inline-error" role="alert">
                  {selected.error}
                </p>
              )}
              {selected.records.map((r) => {
                const existing = projects.find((p) => p.source === r.url);
                return (
                  <button
                    className="event-row"
                    key={r.url}
                    onClick={() =>
                      existing ? open(existing.id) : create(r.url)
                    }
                  >
                    {r.title}
                    <small>{existing ? "Open project" : "Import"}</small>
                  </button>
                );
              })}
              <button
                className="delete-clip-link"
                onClick={() => {
                  if (
                    confirm("Remove this channel and its monitoring settings?")
                  )
                    write(read().filter((c) => c.id !== selected.id));
                }}
              >
                <Trash2 size={13} /> Remove channel
              </button>
            </section>
          )}
        </div>
      )}
    </>
  );
}
