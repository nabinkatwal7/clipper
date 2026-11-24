"use client";
import { useEffect, useRef, useState } from "react";
import type { Project } from "@/lib/types";
import type { SearchOptions, SearchHit } from "@/lib/content-search";
type Collection = { rule: SearchOptions } | { clips: string[] };
const initial: SearchOptions = { query: "", mode: "exact", scope: "clips" };
export function DiscoverySearch({
  projects,
  open,
}: {
  projects: Project[];
  open: (p: string, c: string) => void;
}) {
  const [s, set] = useState(initial),
    [models, setModels] = useState<string[]>([]),
    [rows, items] = useState<SearchHit[]>([]),
    [total, count] = useState(0),
    [name, setName] = useState(""),
    [collections, saveCollections] = useState<Record<string, Collection>>({}),
    [chosen, pick] = useState<string[]>([]),
    [busy, working] = useState(false),
    [message, msg] = useState("");
  const ctrl = useRef<AbortController | null>(null);
  useEffect(() => {
    fetch("/api/preferences?group=collections")
      .then((r) => r.json())
      .then(saveCollections)
      .catch(() => {});
    fetch("/api/models")
      .then((r) => r.json())
      .then((d) => setModels(Array.isArray(d) ? d : []));
    return () => ctrl.current?.abort();
  }, []);
  async function search(rule = s) {
    ctrl.current?.abort();
    const c = new AbortController();
    ctrl.current = c;
    working(true);
    msg("");
    try {
      const r = await fetch("/api/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rule),
        signal: c.signal,
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      items(d.hits);
      count(d.total);
      pick([]);
      msg(d.total ? "" : "No matching clips or transcript passages.");
    } catch (e) {
      if (!c.signal.aborted) msg(String(e));
    } finally {
      if (ctrl.current === c) working(false);
    }
  }
  async function collection(manual: boolean) {
    try {
      const r = await fetch("/api/preferences?group=collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          value: manual ? { clips: chosen } : { rule: s },
        }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      saveCollections(d);
      setName("");
    } catch (e) {
      msg(String(e));
    }
  }
  return (
    <>
      <div className="tool-layout">
        <section>
          <h2>Search the workspace</h2>
          <label className="field">
            Search text
            <input
              value={s.query}
              onChange={(e) => set({ ...s, query: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === "Enter") void search();
              }}
            />
          </label>
          <div className="field-grid">
            <label className="field">
              Search mode
              <select
                value={s.mode}
                onChange={(e) =>
                  set({ ...s, mode: e.target.value as SearchOptions["mode"] })
                }
              >
                {["exact", "fuzzy", "semantic"].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
            <label className="field">
              Search in
              <select
                value={s.scope}
                onChange={(e) =>
                  set({ ...s, scope: e.target.value as SearchOptions["scope"] })
                }
              >
                {["clips", "transcripts", "all"].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
          </div>
          {s.mode === "semantic" && (
            <label className="field">
              Installed embedding model
              <select
                value={s.model || ""}
                onChange={(e) => set({ ...s, model: e.target.value })}
              >
                <option value="">Choose model</option>
                {models.map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
          )}
          <details>
            <summary>Filters</summary>
            <label className="field">
              Source
              <select
                value={s.project || ""}
                onChange={(e) => set({ ...s, project: e.target.value })}
              >
                <option value="">All projects</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </label>
            <div className="field-grid">
              {(["after", "before", "minScore", "maxDuration"] as const).map(
                (k) => (
                  <label key={k} className="field">
                    {k}
                    <input
                      type={k === "after" || k === "before" ? "date" : "number"}
                      value={s[k] ?? ""}
                      onChange={(e) =>
                        set({
                          ...s,
                          [k]:
                            k === "after" || k === "before"
                              ? e.target.value
                              : e.target.value
                                ? +e.target.value
                                : undefined,
                        })
                      }
                    />
                  </label>
                ),
              )}
            </div>
            <label className="field">
              Review decision
              <select
                value={s.status || ""}
                onChange={(e) => set({ ...s, status: e.target.value })}
              >
                {["", "accepted", "unreviewed", "changes", "rejected"].map(
                  (v) => (
                    <option value={v} key={v}>
                      {v || "All"}
                    </option>
                  ),
                )}
              </select>
            </label>
          </details>
          <button
            className="button primary"
            disabled={busy}
            onClick={() => search()}
          >
            {busy ? "Searching…" : "Search"}
          </button>
          {busy && (
            <button className="tool" onClick={() => ctrl.current?.abort()}>
              Cancel
            </button>
          )}
        </section>
        <section>
          <h2>Collections</h2>
          <label className="field">
            Collection name
            <input
              maxLength={100}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <div className="candidate-actions">
            <button
              className="tool"
              disabled={!name.trim()}
              onClick={() => collection(false)}
            >
              Save search rule
            </button>
            <button
              className="tool"
              disabled={!name.trim() || !chosen.length}
              onClick={() => collection(true)}
            >
              Save selected clips
            </button>
          </div>
          {Object.entries(collections).map(([n, v]) => (
            <button
              className="event-row"
              key={n}
              onClick={() => {
                if ("rule" in v) {
                  set(v.rule);
                  void search(v.rule);
                } else {
                  const matches = projects.flatMap((p) =>
                    p.clips
                      .filter((c) => v.clips.includes(c.editorialId || c.id))
                      .map((c) => ({
                        project: p.id,
                        clip: c.id,
                        title: c.title,
                        start: c.start,
                        end: c.end,
                        text: c.reason,
                      })),
                  );
                  items(matches);
                  count(matches.length);
                  pick([]);
                }
              }}
            >
              {n}
              <small>{"rule" in v ? "Smart" : "Manual"}</small>
            </button>
          ))}
        </section>
      </div>
      <p role="status">{message || (total ? total + " matches" : "")}</p>
      {rows.map((h, i) => (
        <div className="discovery-hit" key={i}>
          {h.clip && (
            <input
              aria-label={"Select " + h.title}
              className="hit-check"
              type="checkbox"
              checked={chosen.includes(
                projects
                  .find((p) => p.id === h.project)
                  ?.clips.find((c) => c.id === h.clip)?.editorialId || h.clip,
              )}
              onChange={(e) => {
                const id =
                  projects
                    .find((p) => p.id === h.project)
                    ?.clips.find((c) => c.id === h.clip)?.editorialId ||
                  h.clip!;
                pick(
                  e.target.checked
                    ? [...chosen, id]
                    : chosen.filter((v) => v !== id),
                );
              }}
            />
          )}
          <div>
            {h.clip ? (
              <button
                className="inline-link"
                onClick={() => open(h.project, h.clip!)}
              >
                {h.title}
              </button>
            ) : (
              <a
                className="inline-link"
                target="_blank"
                rel="noreferrer"
                href={`/api/download?kind=source&project=${h.project}#t=${h.start},${h.end}`}
              >
                {h.title} · {h.start.toFixed(1)}s
              </a>
            )}
            <p>{h.text}</p>
          </div>
        </div>
      ))}
    </>
  );
}
