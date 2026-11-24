"use client";
import {studioStorage} from "@/lib/client-storage";
import { useDeferredValue, useEffect, useState } from "react";
import {
  Ellipsis,
  ArrowUpRight,
  ChevronRight,
  Film,
  Rows3,
  LayoutGrid,
  Star,
  Search,
  Link2,
  Upload,
  FolderOpen,
  Download,
} from "lucide-react";
import type { Project } from "@/lib/types";
export const duration = (s: number) =>
  [
    Math.floor(s / 3600) || "",
    String(Math.floor(s / 60) % 60).padStart(s >= 3600 ? 2 : 1, "0"),
    String(Math.floor(s) % 60).padStart(2, "0"),
  ]
    .filter(Boolean)
    .join(":");
export const platform = (p: Project) => {
  try {
    return new URL(p.source || "").hostname.replace(/^www\./, "").split(".")[0];
  } catch {
    return "Upload";
  }
};
export function ProjectRows({
  projects,
  open,
}: {
  projects: Project[];
  open: (id: string) => void;
}) {
  return (
    <div className="project-rows">
      {projects.map((p) => (
        <button key={p.id} onClick={() => open(p.id)}>
          {p.thumbnail ? (
            <img loading="lazy" src={p.thumbnail} alt="" />
          ) : (
            <Film />
          )}
          <span>
            <strong>{p.title}</strong>
            <small>
              {platform(p)} · {duration(p.duration)} · {p.clips.length} clips
            </small>
          </span>
          <time>
            {new Date(p.updatedAt).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            })}
          </time>
          <em>{p.status}</em>
          <ChevronRight size={15} />
        </button>
      ))}
    </div>
  );
}
type MediaProps = { projects: Project[]; open: (p: string, c: string) => void };
export function MediaLibrary({
  projects,
  open,
  recent = false,
}: { recent?: boolean } & MediaProps) {
  const [hover, setHover] = useState("");
  const [q, setQ] = useState(""),
    [source, setSource] = useState(""),
    [list, setList] = useState(false),
    [only, setOnly] = useState(false),
    [sort, setSort] = useState("Recent"),
    [favorites, setFavorites] = useState<string[]>([]);
  useEffect(() => {
    try {
      setFavorites(
        JSON.parse(studioStorage.getItem("studio-favorites") || "[]"),
      );
      setList(studioStorage.getItem("studio-library") === "list");
    } catch {}
  }, []);
  const [selected, setSelected] = useState<string[]>([]),
    [pub, setPub] = useState<Record<string, string>>({}),
    [status, setStatus] = useState("All statuses"),
    [category, setCategory] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  useEffect(() => {
    try {
      setPub(JSON.parse(studioStorage.getItem("clipper-publishing") || "{}"));
    } catch {}
  }, []);
  const [stats, setStats] = useState<
    Record<string, { bytes: number; date: string }>
  >({});
  useEffect(() => {
    let active = true;
    fetch("/api/clip-stats")
      .then((r) => (r.ok ? r.json() : {}))
      .then((data) => {
        if (active) setStats(data);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [projects]);
  function publish(value: string) {
    const next = { ...pub };
    for (const { c } of items)
      if (selected.includes(c.id)) next[c.editorialId || c.id] = value;
    setPub(next);
    studioStorage.setItem("clipper-publishing", JSON.stringify(next));
    setSelected([]);
  }
  async function remove() {
    if (
      !confirm(
        "Delete " +
          selectedHere.length +
          " selected clips and their rendered files?",
      )
    )
      return;
    setBusy(true);
    try {
      for (const { p, c } of items.filter(({ c }) => selected.includes(c.id))) {
        const r = await fetch(`/api/cleanup?project=${p.id}&clip=${c.id}`, {
          method: "DELETE",
        });
        if (!r.ok) throw Error((await r.json()).error);
        setSelected((ids) => ids.filter((id) => id !== c.id));
      }
      setMessage("Selected clips deleted.");
    } catch (e) {
      setMessage(String(e));
    } finally {
      setBusy(false);
    }
  }
  function star(id: string) {
    const next = favorites.includes(id)
      ? favorites.filter((x) => x !== id)
      : [...favorites, id];
    setFavorites(next);
    studioStorage.setItem("studio-favorites", JSON.stringify(next));
  }
  const search = useDeferredValue(q.trim().toLowerCase());
  let items = projects
    .flatMap((p) => p.clips.map((c) => ({ p, c })))
    .filter(
      ({ c, p }) =>
        (!source || p.id === source) &&
        (!category || (c.settings.category || "General") === category) &&
        (status === "All statuses" ||
          (pub[c.editorialId || c.id] || "Ready") === status) &&
        (!only || favorites.includes(c.editorialId || c.id)) &&
        c.title.toLowerCase().includes(search),
    );
  if (sort === "AI score")
    items.sort((a, b) => (b.c.score ?? -1) - (a.c.score ?? -1));
  else if (sort === "Duration")
    items.sort((a, b) => b.c.end - b.c.start - (a.c.end - a.c.start));
  else if (sort === "Title")
    items.sort((a, b) => a.c.title.localeCompare(b.c.title));
  else if (sort === "File size")
    items.sort(
      (a, b) => (stats[b.c.id]?.bytes || 0) - (stats[a.c.id]?.bytes || 0),
    );
  else if (sort === "Source")
    items.sort((a, b) => a.p.title.localeCompare(b.p.title));
  else if (sort === "Status")
    items.sort((a, b) =>
      (pub[a.c.editorialId || a.c.id] || "Ready").localeCompare(
        pub[b.c.editorialId || b.c.id] || "Ready",
      ),
    );
  else
    items.sort((a, b) =>
      (stats[b.c.id]?.date || b.p.createdAt).localeCompare(
        stats[a.c.id]?.date || a.p.createdAt,
      ),
    );
  const selectedHere = items.filter(({ c }) => selected.includes(c.id));
  if (recent) items = items.slice(0, 4);
  return (
    <>
      {!recent && (
        <div className="media-tools">
          <label className="search-field">
            <Search size={15} />
            <input
              aria-label="Search clips"
              value={q}
              placeholder="Search clips"
              onChange={(e) => setQ(e.target.value)}
            />
          </label>
          <select
            aria-label="Project filter"
            value={source}
            onChange={(e) => setSource(e.target.value)}
          >
            <option value="">All projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
          <select
            aria-label="Category"
            value={category}
            onChange={(e) => {
              setSelected([]);
              setCategory(e.target.value);
            }}
          >
            <option value="">All categories</option>
            {Array.from(
              new Set(
                projects.flatMap((p) =>
                  p.clips.map((c) => c.settings.category || "General"),
                ),
              ),
            ).map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
          <select
            aria-label="Publishing status"
            value={status}
            onChange={(e) => {
              setSelected([]);
              setStatus(e.target.value);
            }}
          >
            {["All statuses", "Ready", "Draft", "Published"].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
          <select
            aria-label="Sort clips"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            {[
              "Recent",
              "AI score",
              "Duration",
              "Title",
              "Source",
              "File size",
              "Status",
            ].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
          <button
            className="tool"
            title="Favorites only"
            aria-pressed={only}
            onClick={() => setOnly(!only)}
          >
            <Star size={16} />
          </button>
          <button
            className="tool"
            title={list ? "Grid view" : "List view"}
            aria-label={list ? "Grid view" : "List view"}
            onClick={() => {
              setList(!list);
              studioStorage.setItem("studio-library", list ? "grid" : "list");
            }}
          >
            {list ? <LayoutGrid size={16} /> : <Rows3 size={16} />}
          </button>
        </div>
      )}
      {!recent && selectedHere.length > 0 && (
        <div className="selection-tools">
          <strong>{selectedHere.length} selected</strong>
          <a
            href={
              "/api/export?" +
              new URLSearchParams(
                selectedHere.map(({ c }) => ["clip", c.id]),
              ).toString()
            }
          >
            <Download size={14} />
            Download ZIP
          </a>
          <select
            aria-label="Set selected publishing status"
            value=""
            onChange={(e) => publish(e.target.value)}
          >
            <option value="">Set status…</option>
            {["Ready", "Draft", "Published"].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
          <button disabled={busy} onClick={remove}>
            Delete
          </button>
          <button onClick={() => setSelected([])}>Clear</button>
        </div>
      )}
      {message && <p role="status">{message}</p>}
      <div className={list && !recent ? "media-list" : "media-grid"}>
        {items.map(({ p, c }) => (
          <article className="media-item" key={c.id}>
            {!recent && (
              <input
                className="media-check"
                type="checkbox"
                aria-label={"Select " + c.title}
                checked={selected.includes(c.id)}
                onChange={(e) =>
                  setSelected(
                    e.target.checked
                      ? [...selected, c.id]
                      : selected.filter((id) => id !== c.id),
                  )
                }
              />
            )}
            <button
              className="media-frame"
              onMouseEnter={() => setHover(c.id)}
              onMouseLeave={() => setHover("")}
              onClick={() => open(p.id, c.id)}
              aria-label={"Review " + c.title}
            >
              <img
                alt=""
                loading="lazy"
                src={`/api/download?project=${p.id}&clip=${c.id}&kind=poster`}
              />
              {hover === c.id && (
                <video
                  autoPlay
                  muted
                  playsInline
                  src={`/api/download?project=${p.id}&clip=${c.id}`}
                />
              )}
              <small>{duration(c.end - c.start)}</small>
            </button>
            <div>
              <button className="media-title" onClick={() => open(p.id, c.id)}>
                {c.title}
              </button>
              <p>{p.title}</p>
              <span className="media-data">
                {!recent && (pub[c.editorialId || c.id] || "Ready") + " · "}
                {c.settings.resolution}p · {c.settings.ratio}
                {c.score !== null && " · Score " + c.score}
              </span>
              {list && !recent && stats[c.id] && (
                <small className="list-stats">
                  {(stats[c.id].bytes / 1024 ** 2).toFixed(1)} MB ·{" "}
                  {new Date(stats[c.id].date).toLocaleDateString()}
                </small>
              )}
            </div>
            <button
              className="favorite"
              aria-label={"Favorite " + c.title}
              title="Favorite"
              aria-pressed={favorites.includes(c.editorialId || c.id)}
              onClick={() => star(c.editorialId || c.id)}
            >
              <Star
                size={15}
                fill={
                  favorites.includes(c.editorialId || c.id)
                    ? "currentColor"
                    : "none"
                }
              />
            </button>
            {!recent && (
              <details className="clip-actions-menu project-menu">
                <summary
                  aria-label={"Actions for " + c.title}
                  title="Clip actions"
                >
                  <Ellipsis size={16} />
                </summary>
                <div>
                  <button onClick={() => open(p.id, c.id)}>Open clip</button>
                  <a
                    href={`/api/download?project=${p.id}&clip=${c.id}&kind=bundle`}
                  >
                    Download MP4 + TXT
                  </a>
                  <button
                    onClick={(e) => {
                      star(c.editorialId || c.id);
                      e.currentTarget
                        .closest("details")
                        ?.removeAttribute("open");
                    }}
                  >
                    {favorites.includes(c.editorialId || c.id)
                      ? "Remove favorite"
                      : "Add to favorites"}
                  </button>
                </div>
              </details>
            )}
          </article>
        ))}
      </div>
      {!items.length && (
        <p className="studio-empty">
          {projects.some((p) => p.clips.length)
            ? "No clips match these filters."
            : "Generated clips will appear here once a video finishes processing."}
        </p>
      )}
    </>
  );
}
export function Overview({
  projects,
  openProject,
  open,
  go,
  create,
}: {
  openProject: (id: string) => void;
  go: (s: string) => void;
  create: (url?: string, upload?: boolean) => void;
} & MediaProps) {
  const [url, setUrl] = useState("");
  const current = projects
    .slice()
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  const [favorites, setFavorites] = useState<{ name: string; id: string }[]>(
    [],
  );
  useEffect(() => {
    try {
      setFavorites(
        JSON.parse(studioStorage.getItem("studio-channels") || "[]").filter(
          (c: { favorite: boolean }) => c.favorite,
        ),
      );
    } catch {}
  }, []);
  const jobs = projects.filter((p) =>
    ["processing", "queued"].includes(p.status),
  );
  return (
    <>
      <div className="section-title">
        <div>
          <h1>Studio overview</h1>
          <p>
            {projects.length} projects <b>·</b>{" "}
            {projects.reduce((a, p) => a + p.clips.length, 0)} clips in your
            workspace
          </p>
        </div>
      </div>
      <div className="overview-top">
        <div className="import-box">
          <span className="import-icon">
            <ScissorsMark />
          </span>
          <h2>Import a video</h2>
          <p>Find highlights in a stream or recording.</p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              create(url.trim());
            }}
          >
            <Link2 size={16} />
            <input
              type="url"
              required
              aria-label="Video URL"
              placeholder="Paste a video link"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
            <button title="Configure import" aria-label="Configure import">
              <ChevronRight size={18} />
            </button>
          </form>
          <button className="upload-shortcut" onClick={() => create("", true)}>
            <Upload size={15} /> Upload a file <small>Up to 5 GB</small>
          </button>
        </div>
        {current ? (
          <button
            className="resume-tile"
            onClick={() => openProject(current.id)}
          >
            {current.thumbnail && <img alt="" src={current.thumbnail} />}
            <span className="resume-copy">
              <small>
                <FolderOpen size={13} /> Last edited project
              </small>
              <strong>{current.title}</strong>
              <span>
                {duration(current.duration)} <i>·</i> {current.clips.length}{" "}
                clips <ArrowUpRight size={16} />
              </span>
            </span>
          </button>
        ) : (
          <div className="studio-empty">
            <Film />
            <p>Your most recent project will appear here.</p>
          </div>
        )}
      </div>
      {jobs.length > 0 && (
        <section className="studio-section">
          <div className="section-row">
            <h2>Processing now</h2>
            <button onClick={() => go("Processing queue")}>
              View queue <ChevronRight size={14} />
            </button>
          </div>
          {jobs.map((p) => (
            <button
              key={p.id}
              className="event-row"
              onClick={() => openProject(p.id)}
            >
              {p.title}
              <small>
                {p.stage} · {p.detail}
              </small>
            </button>
          ))}
        </section>
      )}
      <section className="studio-section">
        <div className="section-row">
          <h2>Recent projects</h2>
          <button onClick={() => go("Projects")}>
            All projects <ChevronRight size={14} />
          </button>
        </div>
        {projects.length ? (
          <ProjectRows projects={projects.slice(0, 3)} open={openProject} />
        ) : (
          <p className="studio-empty">
            Add a video above to start your first project.
          </p>
        )}
      </section>
      <section className="studio-section">
        <div className="section-row">
          <h2>Recent clips</h2>
          <button onClick={() => go("Clip library")}>
            Open library <ChevronRight size={14} />
          </button>
        </div>
        <MediaLibrary projects={projects} open={open} recent />
      </section>
      {favorites.length > 0 && (
        <section className="studio-section">
          <div className="section-row">
            <h2>Favorite streamers</h2>
            <button onClick={() => go("Streamers")}>Manage channels</button>
          </div>
          {favorites.map((f) => (
            <button key={f.id} className="tool" onClick={() => go("Streamers")}>
              {f.name}
            </button>
          ))}
        </section>
      )}
    </>
  );
}
function ScissorsMark() {
  return <Film size={20} />;
}
