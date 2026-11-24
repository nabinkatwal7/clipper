"use client";
import { useEffect, useRef, useState } from "react";
import type { Project, Clip } from "@/lib/types";
import {
  metrics,
  type Ledger,
  type Review,
  type Metrics,
  type Rights,
  type report,
} from "@/lib/production";
const blankReview: Review = {
  status: "unreviewed",
  notes: "",
  score: null,
  favorite: false,
};
const platforms = [
  "YouTube Shorts",
  "TikTok",
  "Instagram Reels",
  "Facebook Reels",
];
function url(p: Project, c: Clip) {
  return "/api/download?project=" + p.id + "&clip=" + c.id;
}
export function ProductionDesk({ projects }: { projects: Project[] }) {
  const [id, setId] = useState("");
  const p = projects.find((v) => v.id === id) || projects[0];
  return (
    <>
      <label className="field">
        Source project
        <select value={p?.id || ""} onChange={(e) => setId(e.target.value)}>
          {projects.map((v) => (
            <option key={v.id} value={v.id}>
              {v.title}
            </option>
          ))}
        </select>
      </label>
      {p ? (
        <Desk key={p.id} project={p} />
      ) : (
        <p className="studio-empty">
          Import a recording to open its production desk.
        </p>
      )}
    </>
  );
}
function Desk({ project: p }: { project: Project }) {
  const [tab, setTab] = useState("Report"),
    [data, setData] = useState<Ledger | null>(null),
    [r, setReport] = useState<ReturnType<typeof report> | null>(null),
    [index, setIndex] = useState(0),
    [message, setMessage] = useState(""),
    [posting, setPosting] = useState(false);
  const c = p.clips[Math.min(index, p.clips.length - 1)];
  const key = c?.editorialId || c?.id;
  const base = "?project=" + p.id;
  useEffect(() => {
    const ctrl = new AbortController();
    async function load() {
      try {
        const [d, r] = await Promise.all(
          ["production", "report"].map(async (a) => {
            const resp = await fetch("/api/" + a + base, {
              signal: ctrl.signal,
            });
            if (!resp.ok) throw Error((await resp.json()).error);
            return resp.json();
          }),
        );
        setData(d);
        setReport(r);
      } catch (e) {
        if (!ctrl.signal.aborted) setMessage(String(e));
      }
    }
    void load();
    return () => ctrl.abort();
  }, [base, p.updatedAt]);
  async function save(kind: string, value: unknown) {
    setPosting(true);
    try {
      const resp = await fetch("/api/production" + base, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, value, clip: c?.id }),
      });
      const json = await resp.json();
      if (!resp.ok) throw Error(json.error);
      setData(json);
      setMessage("Saved on this computer.");
    } catch (e) {
      setMessage(String(e));
    } finally {
      setPosting(false);
    }
  }
  const nav = (n: number) =>
    setIndex(Math.max(0, Math.min(n, p.clips.length - 1)));
  return (
    <section className="studio-section">
      <div className="segmented desk-tabs">
        {[
          "Report",
          "Review",
          "Compare",
          "Performance",
          "Rights",
          "Package",
        ].map((v) => (
          <button
            className={v === tab ? "selected" : ""}
            key={v}
            onClick={() => {
              setTab(v);
              setMessage("");
            }}
          >
            {v}
          </button>
        ))}
      </div>
      {message && <p role="status">{message}</p>}
      {!data ? (
        <p>Loading project records…</p>
      ) : tab === "Report" && r ? (
        <>
          <h2>Stream intelligence report</h2>
          <p>{r.summary}</p>
          <div className="candidate-actions">
            {["md", "json", "html"].map((f) => (
              <a
                key={f}
                className="tool"
                href={"/api/report" + base + "&format=" + f}
                target={f === "html" ? "_blank" : undefined}
                rel="noreferrer"
              >
                {f === "html"
                  ? "Printable HTML"
                  : f === "md"
                    ? "Markdown"
                    : "JSON"}
              </a>
            ))}
          </div>
          <h3>Frequent transcript terms</h3>
          <p>
            {r.frequentTerms
              .map((t) => t.term + " (" + t.count + ")")
              .join(", ") || "No transcript terms available."}
          </p>
          <h3>Selected moments</h3>
          {r.moments.map((m, i) => (
            <details className="clip-context" key={i}>
              <summary>
                {m.start.toFixed(1)}s · {m.title}
              </summary>
              <p>{m.reason}</p>
              {m.quote && <blockquote>“{m.quote}”</blockquote>}
            </details>
          ))}
          <p className="hint">{r.limitations.join(" ")}</p>
        </>
      ) : tab === "Rights" ? (
        <RightsForm
          key={p.id}
          value={data.rights}
          source={p.source}
          save={(v) => save("rights", v)}
          busy={posting}
        />
      ) : !c ? (
        <p className="studio-empty">Generate a clip to use this view.</p>
      ) : (
        <>
          <label className="field">
            Clip
            <select
              value={c.id}
              onChange={(e) =>
                nav(p.clips.findIndex((v) => v.id === e.target.value))
              }
            >
              {p.clips.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.title}
                </option>
              ))}
            </select>
          </label>
          {tab === "Package" ? (
            <PackagePanel
              key={c.id}
              project={p}
              clip={c}
              permission={data.rights.permission}
            />
          ) : tab === "Performance" ? (
            <Performance
              key={key + JSON.stringify(data.analytics[key])}
              clipId={c.id}
              importCsv={(text) => save("analyticsCsv", text)}
              value={data.analytics[key] || {}}
              score={c.score}
              save={(v) => save("analytics", v)}
              busy={posting}
            />
          ) : tab === "Compare" ? (
            <Comparison key={c.id} p={p} c={c} />
          ) : (
            <ReviewClip
              key={c.id}
              p={p}
              c={c}
              value={data.reviews[key] || blankReview}
              prev={index > 0 ? () => nav(index - 1) : undefined}
              next={
                index < p.clips.length - 1 ? () => nav(index + 1) : undefined
              }
              save={(v) => save("review", v)}
              busy={posting}
            />
          )}
        </>
      )}
    </section>
  );
}
function RightsForm({
  value,
  source,
  save,
  busy,
}: {
  value: Rights;
  source?: string;
  save: (v: Rights) => void;
  busy: boolean;
}) {
  const [draft, set] = useState(value);
  return (
    <div className="editor-fields">
      <h2>Source provenance</h2>
      <p>{source || "Local upload"}</p>
      <label className="field">
        Usage permission
        <select
          value={draft.permission}
          onChange={(e) =>
            set({
              ...draft,
              permission: e.target.value as Rights["permission"],
            })
          }
        >
          {["unknown", "permitted", "restricted"].map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
      </label>
      {(["creator", "license", "attribution", "notes"] as const).map((v) => (
        <label className="field" key={v}>
          {v}
          <input
            value={draft[v]}
            onChange={(e) => set({ ...draft, [v]: e.target.value })}
          />
        </label>
      ))}
      <button
        className="button primary"
        disabled={busy}
        onClick={() => save(draft)}
      >
        Save provenance
      </button>
    </div>
  );
}
function Performance({
  value,
  score,
  save,
  busy,
  clipId,
  importCsv,
}: {
  clipId: string;
  importCsv: (text: string) => void;
  value: Metrics;
  score: number | null;
  save: (v: Metrics) => void;
  busy: boolean;
}) {
  const [draft, set] = useState(value);
  return (
    <>
      <p>AI engagement estimate · {score ?? "Unavailable"}</p>
      <h3>Measured results</h3>
      <div className="field-grid">
        {metrics.map((m) => (
          <label className="field" key={m}>
            {m.replace(/([A-Z])/g, " $1")}
            <input
              type="number"
              min="0"
              step="any"
              value={draft[m] ?? ""}
              onChange={(e) =>
                set({
                  ...draft,
                  [m]:
                    e.target.value === "" ? undefined : Number(e.target.value),
                })
              }
            />
          </label>
        ))}
      </div>
      <button
        className="button primary"
        disabled={busy}
        onClick={() => save(draft)}
      >
        Save measurements
      </button>
      <details>
        <summary>Import project measurements from CSV</summary>
        <p>
          Use a clip ID and any of these columns. Blank values keep the saved
          measurement.
        </p>
        <code>{["clip", ...metrics].join(",")}</code>
        <p>
          Selected clip ID · <code>{clipId}</code>
        </p>
        <label className="field">
          CSV file (up to 500 KB)
          <input
            type="file"
            accept=".csv,text/csv"
            disabled={busy}
            onChange={async (e) => {
              const f = e.currentTarget.files?.[0];
              e.currentTarget.value = "";
              if (f) importCsv(f.size > 500000 ? "" : await f.text());
            }}
          />
        </label>
      </details>
    </>
  );
}
function ReviewClip({
  p,
  c,
  value,
  save,
  prev,
  next,
  busy,
}: {
  p: Project;
  c: Clip;
  value: Review;
  save: (v: Review) => void;
  prev?: () => void;
  next?: () => void;
  busy: boolean;
}) {
  const [draft, set] = useState(value),
    [platform, setPlatform] = useState("Original"),
    [inset, setInset] = useState(20);
  return (
    <div
      className="tool-layout"
      onKeyDown={(e) => {
        if ((e.target as HTMLElement).closest("input,select,textarea,video"))
          return;
        if (e.key === "ArrowRight") next?.();
        if (e.key === "ArrowLeft") prev?.();
      }}
    >
      <section>
        <div className="social-monitor">
          <video controls playsInline src={url(p, c)} />
          {platform !== "Original" && (
            <div className="sim-overlay">
              <small>{platform} · preview</small>
              <aside>
                ♡<br />◯<br />↗
              </aside>
              <footer style={{ height: inset + "%" }}>
                <strong>@creator</strong>
                <p>{c.postCaption || c.title}</p>
              </footer>
            </div>
          )}
        </div>
        <div className="candidate-actions">
          <button className="tool" disabled={!prev} onClick={prev}>
            Previous
          </button>
          <button className="tool" disabled={!next} onClick={next}>
            Next
          </button>
        </div>
      </section>
      <section>
        <label className="field">
          Social preview
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
          >
            {["Original", ...platforms].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        {platform !== "Original" && (
          <label className="field">
            Bottom safe zone (%)
            <input
              type="range"
              min="10"
              max="40"
              value={inset}
              onChange={(e) => setInset(+e.target.value)}
            />
          </label>
        )}
        <label className="field">
          Review decision
          <select
            value={draft.status}
            onChange={(e) =>
              set({ ...draft, status: e.target.value as Review["status"] })
            }
          >
            {["unreviewed", "accepted", "rejected", "changes"].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        <label className="field">
          Reviewer score
          <input
            type="number"
            min="0"
            max="100"
            value={draft.score ?? ""}
            onChange={(e) =>
              set({
                ...draft,
                score: e.target.value === "" ? null : +e.target.value,
              })
            }
          />
        </label>
        <label className="field">
          Notes
          <textarea
            value={draft.notes}
            onChange={(e) => set({ ...draft, notes: e.target.value })}
          />
        </label>
        <label className="check-row">
          <input
            type="checkbox"
            checked={draft.favorite}
            onChange={(e) => set({ ...draft, favorite: e.target.checked })}
          />
          Favorite
        </label>
        <button
          className="button primary"
          disabled={busy}
          onClick={() => save(draft)}
        >
          Save review
        </button>
      </section>
    </div>
  );
}
function Comparison({ p, c }: { p: Project; c: Clip }) {
  const family = c.familyId || c.editorialId || c.id;
  const choices = p.clips.filter(
    (v) => v.id !== c.id && (v.familyId || v.editorialId || v.id) === family,
  );
  const [id, setId] = useState(choices[0]?.id || "");
  const other = choices.find((v) => v.id === id);
  const a = useRef<HTMLVideoElement>(null),
    b = useRef<HTMLVideoElement>(null);
  if (!other)
    return (
      <p className="studio-empty">
        In the editor, select “Save as variation” and render a second version to
        compare it here.
      </p>
    );
  const sync = () => {
    if (a.current && b.current)
      b.current.currentTime = Math.max(
        0,
        Math.min(
          other.end - other.start,
          a.current.currentTime + c.start - other.start,
        ),
      );
  };
  return (
    <>
      <label className="field">
        Compare with
        <select value={id} onChange={(e) => setId(e.target.value)}>
          {choices.map((v) => (
            <option key={v.id} value={v.id}>
              {v.title}
            </option>
          ))}
        </select>
      </label>
      <div className="tool-layout">
        <video
          className="source-monitor"
          ref={a}
          controls
          src={url(p, c)}
          onSeeked={sync}
          onTimeUpdate={() => {
            if (
              a.current &&
              b.current &&
              Math.abs(
                b.current.currentTime -
                  (a.current.currentTime + c.start - other.start),
              ) > 0.25
            )
              sync();
          }}
          onPlay={() => {
            sync();
            void b.current?.play().catch(() => {});
          }}
          onPause={() => b.current?.pause()}
        />
        <video className="source-monitor" ref={b} muted src={url(p, other)} />
      </div>
    </>
  );
}

function PackagePanel({
  project,
  clip,
  permission,
}: {
  project: Project;
  clip: Clip;
  permission: string;
}) {
  const [all, setAll] = useState(false),
    [available, setAvailable] = useState(false),
    [message, setMessage] = useState(""),
    [pending, setPending] = useState(false);
  const url =
    "/api/publish-package?project=" +
    project.id +
    (all ? "" : "&clip=" + clip.id);
  useEffect(() => {
    let alive = true;
    setAvailable(false);
    fetch(url + "&status=1")
      .then((r) => r.json())
      .then((d) => {
        if (alive) setAvailable(!!d.available);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [url, project.updatedAt]);
  return (
    <div className="editor-fields">
      <h3>Publishing package</h3>
      <p>
        Each folder contains vertical and clean MP4s, subtitle tracks, cover
        image, post copy, attribution and export settings.
      </p>
      <p>Usage permission · {permission}</p>
      <label className="check-row">
        <input
          type="checkbox"
          checked={all}
          onChange={(e) => setAll(e.target.checked)}
        />
        Include every clip in this project
      </label>
      <button
        className="button primary"
        disabled={pending || ["queued", "processing"].includes(project.status)}
        onClick={async () => {
          setPending(true);
          try {
            const r = await fetch(url, { method: "POST" });
            if (!r.ok) throw Error((await r.json()).error);
            setMessage("Queued. Follow rendering in Processing queue.");
          } catch (e) {
            setMessage(String(e));
          } finally {
            setPending(false);
          }
        }}
      >
        Build package
      </button>
      {available && (
        <a href={url} className="tool">
          Download last completed package
        </a>
      )}
      <p role="status">{message}</p>
    </div>
  );
}
