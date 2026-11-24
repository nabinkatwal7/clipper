"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Search,
  Download,
  HardDrive,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {FrameStrip} from "./frame-strip";
import {StreamIndex} from "./stream-index";
import { duration } from "./studio-media";
import type { Project, Segment } from "@/lib/types";
export function SourceTool({
  project,
  thumbnail,
  generate,
}: {
  project: Project;
  thumbnail: boolean;
  generate: (a: number, b: number) => void;
}) {
  const [imageLayer, setImageLayer] = useState<HTMLImageElement | null>(null),
    [imageScale, setImageScale] = useState(30),
    [layerPos, setLayerPos] = useState({ x: 50, y: 50 }),
    [align, setAlign] = useState(50),
    [brightness, setBrightness] = useState(100),
    [guides, setGuides] = useState(false),
    [layer, setLayer] = useState("Title"),
    [zoom, setZoom] = useState(100);
  const [frameReady,setFrameReady]=useState(false);
  const video = useRef<HTMLVideoElement>(null),
    canvas = useRef<HTMLCanvasElement>(null);
  const [rows, setRows] = useState<Segment[]>([]),
    [query, setQuery] = useState(""),
    [time, setTime] = useState(0),
    [limit, setLimit] = useState(50),
    [label, setLabel] = useState(""),
    [color, setColor] = useState("#ffffff"),
    [position, setPosition] = useState(85),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [kind, setKind] = useState("Transcript");
  useEffect(() => {
    if (thumbnail) return;
    const ctrl = new AbortController();
    setLoading(true);
    fetch("/api/transcript?project=" + project.id, { signal: ctrl.signal })
      .then(async (r) => {
        if (!r.ok)
          throw Error(
            "Could not load the transcript. Reopen this project to retry.",
          );
        setRows(await r.json());
      })
      .catch((e) => {
        if (!ctrl.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoading(false);
      });
    return () => ctrl.abort();
  }, [project.id, thumbnail]);
  const [terms, setTerms] = useState<string[]>([]),
    [selected, setSelected] = useState<Segment | null>(null),
    [edit, setEdit] = useState(""),
    [language, setLanguage] = useState("English"),
    [translation, setTranslation] = useState(""),
    [pending, setPending] = useState(false);
  async function transcriptOp(action: string) {
    setPending(true);
    setError("");
    try {
      const r = await fetch("/api/transcript", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project: project.id,
          action,
          start: selected?.start,
          text: edit,
          original: selected?.text,
          query,
          language,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw Error(data.error);
      if (action === "search") {
        setTerms(data.terms);
        setLimit(50);
      } else if (action === "translate") setTranslation(data.text);
      else if (selected) {
        const next = { ...selected, text: data.text, words: [] };
        setRows(rows.map((s) => (s.start === next.start ? next : s)));
        setSelected(next);
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setPending(false);
    }
  }
  const [candidate, setCandidate] = useState(-1),
    [bounds, setBounds] = useState<[number, number]>([0, 1]),
    [decisions, setDecisions] = useState<Record<string, string>>({});
  const playTo = useRef<number | null>(null);
  useEffect(() => {
    try {
      setDecisions(
        JSON.parse(localStorage.getItem("highlight-" + project.id) || "{}"),
      );
    } catch {}
  }, [project.id]);
  function chooseCandidate(i: number) {
    const h = project.highlights[i];
    setCandidate(i);
    setBounds([h.start, h.end]);
    seek(h.start);
  }
  function decide(status: string) {
    const h = project.highlights[candidate];
    if (!h) return;
    const next = { ...decisions, [h.start]: status };
    setDecisions(next);
    localStorage.setItem("highlight-" + project.id, JSON.stringify(next));
  }
  const filtered = useMemo(
    () =>
      rows.filter((s) =>
        [query, ...terms].some((term) =>
          s.text.toLowerCase().includes(term.toLowerCase()),
        ),
      ),
    [rows, query, terms],
  );
  function seek(t: number) {
    if (video.current) {
      video.current.currentTime = t;
      setTime(t);
    }
  }
  function draw() {
    const v = video.current,
      c = canvas.current;
    if (!v || !c || !v.videoWidth) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    c.width = 1280;
    c.height = 720;
    const scale = Math.max(c.width / v.videoWidth, c.height / v.videoHeight);
    ctx.filter = "brightness(" + brightness + "%)";
    ctx.drawImage(
      v,
      (c.width - v.videoWidth * scale) / 2,
      (c.height - v.videoHeight * scale) / 2,
      v.videoWidth * scale,
      v.videoHeight * scale,
    );
    ctx.filter = "none";
    if (imageLayer) {
      const iw = (1280 * imageScale) / 100,
        ih = (iw * imageLayer.height) / imageLayer.width;
      ctx.drawImage(
        imageLayer,
        (1280 * layerPos.x) / 100 - iw / 2,
        (720 * layerPos.y) / 100 - ih / 2,
        iw,
        ih,
      );
    }
    ctx.textAlign = "center";
    ctx.font = "bold 62px Geist, sans-serif";
    ctx.fillStyle = color;
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 5;
    ctx.strokeText(label, (1280 * align) / 100, (720 * position) / 100, 1160);
    ctx.fillText(label, (1280 * align) / 100, (720 * position) / 100, 1160);
  }
  useEffect(() => {
    draw();
  }, [
    label,
    color,
    position,
    time,
    thumbnail,
    imageLayer,
    imageScale,
    layerPos,
    align,
    brightness,
  ]);
  return (
    <div className="tool-layout">
      <section>
        <div className="section-row">
          <h2>{thumbnail ? "Thumbnail canvas" : "Source monitor"}</h2>
          <small>{thumbnail ? "1280 × 720" : duration(time)}</small>
        </div>
        <video
          className={thumbnail ? "frame-source" : "source-monitor"}
          controls={!thumbnail}
          ref={video}
          preload="auto"
          src={`/api/download?project=${project.id}&kind=source`}
          onLoadedData={() => {
            setFrameReady(true); if (thumbnail) draw();
          }}
          onTimeUpdate={(e) => {
            const at = e.currentTarget.currentTime;
            setTime(at);
            if (playTo.current !== null && at >= playTo.current) {
              e.currentTarget.pause();
              playTo.current = null;
            }
          }}
          onSeeked={draw}
          onError={() =>
            setError(
              "The source video is unavailable. Reimport the recording to restore the preview.",
            )
          }
        />
        {thumbnail && (
          <div className={"thumb-stage " + (guides ? "with-guides" : "")}>
            <canvas
              ref={canvas}
              className="thumb-canvas"
              width="1280"
              height="720"
              style={{ width: zoom + "%", maxWidth: "none" }}
              onPointerDown={(e) =>
                e.currentTarget.setPointerCapture(e.pointerId)
              }
              onPointerMove={(e) => {
                if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
                const r = e.currentTarget.getBoundingClientRect(),
                  x = Math.max(
                    0,
                    Math.min(100, ((e.clientX - r.left) / r.width) * 100),
                  ),
                  y = Math.max(
                    0,
                    Math.min(100, ((e.clientY - r.top) / r.height) * 100),
                  );
                if (layer === "Title") {
                  setAlign(x);
                  setPosition(y);
                } else setLayerPos({ x, y });
              }}
            />
          </div>
        )}
        <label className="field">
          <span>
            Source timeline{" "}
            <small>
              {duration(time)} / {duration(project.duration)}
            </small>
          </span>
          <input
            type="range"
            min="0"
            step="0.05"
            max={project.duration}
            value={time}
            onChange={(e) => seek(+e.target.value)}
          />
        </label>
        {thumbnail&&<FrameStrip project={project.id} left={0} span={project.duration} onSelect={seek}/>}
        {!thumbnail && kind === "Highlights" && (
          <div className="highlight-rail">
            {project.highlights.map((h, i) => (
              <button
                key={i}
                title={h.title}
                aria-label={h.title}
                style={{
                  left: (100 * h.start) / project.duration + "%",
                  width: (100 * (h.end - h.start)) / project.duration + "%",
                }}
                onClick={() => chooseCandidate(i)}
              />
            ))}
          </div>
        )}
        {!thumbnail&&kind==="Highlights"&&<StreamIndex project={project} seek={seek}/>}
        {error && <p role="alert">{error}</p>}
      </section>
      <section>
        {thumbnail ? (
          <>
            <h2>Frame properties</h2>
            <label className="field">
              Canvas zoom
              <input
                type="range"
                min="50"
                max="200"
                value={zoom}
                onChange={(e) => setZoom(+e.target.value)}
              />
            </label>
            <label className="check-row">
              <input
                type="checkbox"
                checked={guides}
                onChange={(e) => setGuides(e.target.checked)}
              />
              Show safe area
            </label>
            <label className="field">
              Brightness
              <input
                type="range"
                min="40"
                max="160"
                value={brightness}
                onChange={(e) => setBrightness(+e.target.value)}
              />
            </label>
            <label className="field">
              Active layer
              <select value={layer} onChange={(e) => setLayer(e.target.value)}>
                <option>Title</option>
                <option>Image</option>
              </select>
            </label>
            <label className="field">
              Image overlay
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  const i = new Image(),
                    src = URL.createObjectURL(f);
                  i.onload = () => {
                    setImageLayer(i);
                    setLayer("Image");
                    URL.revokeObjectURL(src);
                  };
                  i.onerror = () => {
                    setError("Choose a readable image file.");
                    URL.revokeObjectURL(src);
                  };
                  i.src = src;
                }}
              />
            </label>
            {imageLayer && (
              <>
                <label className="field">
                  Image size
                  <input
                    type="range"
                    min="5"
                    max="100"
                    value={imageScale}
                    onChange={(e) => setImageScale(+e.target.value)}
                  />
                </label>
                <button
                  className="inline-link"
                  onClick={() => setImageLayer(null)}
                >
                  Remove image layer
                </button>
              </>
            )}
            <label className="field">
              Title overlay
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Add headline text"
              />
            </label>
            <label className="field">
              Text color
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
              />
            </label>
            <label className="field">
              Horizontal position
              <input
                type="range"
                min="0"
                max="100"
                value={align}
                onChange={(e) => setAlign(+e.target.value)}
              />
            </label>
            <label className="field">
              Vertical position
              <input
                type="range"
                min="10"
                max="92"
                value={position}
                onChange={(e) => setPosition(+e.target.value)}
              />
            </label>
            <button
              className="button primary"
              disabled={!frameReady}
              onClick={() => {
                draw();
                if (!video.current?.videoWidth) {
                  setError("Wait for a video frame before exporting.");
                  return;
                }
                canvas.current?.toBlob((blob) => {
                  if (!blob) return;
                  const a = document.createElement("a");
                  a.href = URL.createObjectURL(blob);
                  a.download = project.title + " - thumbnail.png";
                  a.click();
                  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
                });
              }}
            >
              <Download size={15} /> Export PNG
            </button>
          </>
        ) : (
          <>
            <div className="segmented">
              {["Transcript", "Highlights"].map((v) => (
                <button
                  key={v}
                  className={kind === v ? "selected" : ""}
                  onClick={() => setKind(v)}
                >
                  {v}
                </button>
              ))}
            </div>
            {kind === "Highlights" ? (
              <div className="transcript-rows">
                {project.highlights.map((h, i) => (
                  <div key={i} className={candidate === i ? "current" : ""}>
                    <button onClick={() => chooseCandidate(i)}>
                      <time>{duration(h.start)}</time>
                      <strong>{h.title}</strong>
                    </button>
                    <small>
                      {h.score !== null ? "Score " + h.score + " · " : ""}
                      {decisions[h.start] || "Candidate"}
                    </small>
                    {candidate === i && (
                      <>
                        <p>{h.reason}</p>
                        <p>
                          {
                            rows.find((s) => s.end > h.start && s.start < h.end)
                              ?.text
                          }
                        </p>
                        <div className="field-grid">
                          {["In", "Out"].map((v, j) => (
                            <label className="field" key={v}>
                              {v} (seconds)
                              <input
                                type="number"
                                step=".01"
                                value={bounds[j]}
                                onChange={(e) =>
                                  setBounds(
                                    j
                                      ? [bounds[0], +e.target.value]
                                      : [+e.target.value, bounds[1]],
                                  )
                                }
                              />
                            </label>
                          ))}
                        </div>
                        <div className="candidate-actions">
                          {["Accepted", "Rejected", "Favorite"].map((v) => (
                            <button
                              key={v}
                              className="tool"
                              onClick={() => decide(v)}
                            >
                              {v}
                            </button>
                          ))}
                          <button
                            className="tool"
                            disabled={bounds[1] <= bounds[0]}
                            onClick={() => {
                              seek(bounds[0]);
                              playTo.current = bounds[1];
                              void video.current
                                ?.play()
                                .catch(() => setError("Playback unavailable."));
                            }}
                          >
                            Play range
                          </button>
                          <button
                            className="button primary"
                            disabled={
                              bounds[0] < 0 ||
                              bounds[1] > project.duration ||
                              bounds[1] <= bounds[0]
                            }
                            onClick={() => generate(...bounds)}
                          >
                            Generate clip
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
                {!project.highlights.length && (
                  <p>No highlights have been analyzed for this video.</p>
                )}
              </div>
            ) : (
              <>
                <label className="search-field">
                  <Search size={15} />
                  <input
                    placeholder="Search transcript"
                    aria-label="Search transcript"
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setTerms([]);
                      setLimit(50);
                    }}
                  />
                </label>
                <div className="section-row">
                  <button
                    className="inline-link"
                    disabled={!query.trim() || pending}
                    onClick={() => void transcriptOp("search")}
                  >
                    Find related terms
                  </button>
                  <small>{filtered.length} segments</small>
                </div>
                {selected && (
                  <div className="segment-edit">
                    <label className="field">
                      Segment at {duration(selected.start)}
                      <textarea
                        value={edit}
                        onChange={(e) => setEdit(e.target.value)}
                      />
                    </label>
                    <button
                      className="tool"
                      disabled={
                        pending || !edit.trim() || edit === selected.text
                      }
                      onClick={() => void transcriptOp("edit")}
                    >
                      Save transcript edit
                    </button>
                    <label className="field">
                      Translate to
                      <input
                        value={language}
                        onChange={(e) => setLanguage(e.target.value)}
                      />
                    </label>
                    <button
                      className="inline-link"
                      disabled={pending || !language.trim()}
                      onClick={() => void transcriptOp("translate")}
                    >
                      Translate segment
                    </button>
                    {translation && <p>{translation}</p>}
                  </div>
                )}
                <div className="transcript-rows">
                  {filtered.slice(Math.max(0,limit-50), limit).map((s) => (
                    <div
                      key={s.start}
                      className={
                        time >= s.start && time < s.end ? "current" : ""
                      }
                    >
                      <button
                        onClick={() => {
                          seek(s.start);
                          setSelected(s);
                          setEdit(s.text);
                          setTranslation("");
                        }}
                      >
                        <time>{duration(s.start)}</time>
                        {s.text}
                      </button>
                      <button
                        className="inline-link"
                        onClick={() => generate(s.start, s.end)}
                      >
                        Clip range
                      </button>
                    </div>
                  ))}
                  {!filtered.length && (
                    <p>
                      {loading
                        ? "Loading transcript…"
                        : rows.length
                          ? "No matching segments."
                          : "No transcript available. Generate clips with subtitles enabled to transcribe this source."}
                    </p>
                  )}
                  {limit>50&&<button className="tool" onClick={()=>setLimit(limit-50)}>Previous 50 segments</button>}
{limit < filtered.length && (
                    <button
                      className="tool"
                      onClick={() => setLimit(limit + 50)}
                    >
                      Next 50 segments
                    </button>
                  )}
                </div>
              </>
            )}
          </>
        )}
      </section>
    </div>
  );
}
export function StorageUsage() {
  const [data, setData] = useState<
      { name: string; bytes: number; count: number }[]
    >([]),
    [error, setError] = useState("");
  useEffect(() => {
    fetch("/api/storage")
      .then(async (r) => {
        if (!r.ok) throw Error();
        setData(await r.json());
      })
      .catch(() =>
        setError("Unable to read storage usage. Reopen Storage to retry."),
      );
  }, []);
  const total = data.reduce((a, d) => a + d.bytes, 0);
  return (
    <>
      <p className="storage-summary">
        <HardDrive size={20} /> {(total / 1024 ** 3).toFixed(2)} GB used by the
        studio
      </p>
      {error && <p role="alert">{error}</p>}
      {data.map((d) => (
        <div className="storage-line" key={d.name}>
          <strong>{d.name}</strong>
          <progress value={d.bytes} max={total || 1} />
          <small>
            {d.count} files · {(d.bytes / 1024 ** 2).toFixed(1)} MB
          </small>
        </div>
      ))}
    </>
  );
}
type Plan = Record<string, string>;
const dateKey = (d: Date) =>
  [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
export function Calendar({
  projects,
  open,
}: {
  projects: Project[];
  open: (p: string, c: string) => void;
}) {
  const [month, setMonth] = useState(() => new Date()),
    [plan, setPlan] = useState<Plan>({}),
    [filter, setFilter] = useState("all"),
    [view, setView] = useState("Month");
  useEffect(() => {
    try {
      setPlan(JSON.parse(localStorage.getItem("studio-calendar") || "{}"));
    } catch {}
  }, []);
  const [platform,setPlatform]=useState("All platforms"),[status,setStatus]=useState("All statuses"),[targets,setTargets]=useState<Record<string,string>>({}),[publishing,setPublishing]=useState<Record<string,string>>({});
  useEffect(()=>{try{setTargets(JSON.parse(localStorage.getItem("studio-platforms")||"{}"));setPublishing(JSON.parse(localStorage.getItem("clipper-publishing")||"{}"))}catch{}},[]);
  const clips = projects.flatMap((p) => p.clips.map((c) => ({ c, p })));
  const visible=clips.filter(({c})=>(platform==="All platforms"||targets[c.editorialId||c.id]===platform)&&(status==="All statuses"||(publishing[c.editorialId||c.id]||"Ready")===status));
  function schedule(id: string, day: string) {
    if (!clips.some(({ c }) => (c.editorialId || c.id) === id)) return;
    const next = { ...plan, [id]: day };
    setPlan(next);
    localStorage.setItem("studio-calendar", JSON.stringify(next));
  }
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const monthDays = Array.from(
    {
      length:
        Math.ceil(
          (first.getDay() +
            new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()) /
            7,
        ) * 7,
    },
    (_, i) =>
      new Date(month.getFullYear(), month.getMonth(), 1 + i - first.getDay()),
  );
  const days =
    view === "Week"
      ? Array.from(
          { length: 7 },
          (_, i) =>
            new Date(
              month.getFullYear(),
              month.getMonth(),
              month.getDate() - month.getDay() + i,
            ),
        )
      : monthDays;
  function move(dir: number) {
    setMonth(
      view === "Week"
        ? new Date(
            month.getFullYear(),
            month.getMonth(),
            month.getDate() + dir * 7,
          )
        : new Date(month.getFullYear(), month.getMonth() + dir, 1),
    );
  }
  return (
    <>
      <div className="section-row">
        <h2>
          {month.toLocaleDateString(undefined, {
            month: "long",
            year: "numeric",
          })}
        </h2>
        <div>
          <select
            aria-label="Calendar view"
            value={view}
            onChange={(e) => setView(e.target.value)}
          >
            {["Month", "Week", "List"].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
          <button
            className="tool"
            title="Previous period"
            onClick={() => move(-1)}
          >
            <ChevronLeft size={15} />
          </button>
          <button className="tool" title="Next period" onClick={() => move(1)}>
            <ChevronRight size={15} />
          </button>
        </div>
      </div>
      {view !== "List" && (
        <div className="calendar-grid">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <b key={d}>{d}</b>
          ))}
          {days.map((d) => (
            <div
              key={dateKey(d)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) =>
                schedule(e.dataTransfer.getData("text/plain"), dateKey(d))
              }
            >
              <small>
                {view === "Week"
                  ? d.toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })
                  : d.getDate()}
              </small>
              {visible
                .filter(({ c }) => plan[c.editorialId || c.id] === dateKey(d))
                .map(({ p, c }) => (
                  <button
                    draggable
                    onDragStart={(e) =>
                      e.dataTransfer.setData(
                        "text/plain",
                        c.editorialId || c.id,
                      )
                    }
                    onClick={() => open(p.id, c.id)}
                    key={c.id}
                  >
                    {c.title}
                  </button>
                ))}
            </div>
          ))}
        </div>
      )}
      <div className="section-row">
        <h2>Publishing schedule</h2><div className="calendar-filters"><select aria-label="Filter target platform" value={platform} onChange={e=>setPlatform(e.target.value)}>{["All platforms","YouTube","Instagram","TikTok","Twitch","Other"].map(v=><option key={v}>{v}</option>)}</select><select aria-label="Filter publication status" value={status} onChange={e=>setStatus(e.target.value)}>{["All statuses","Draft","Ready","Published"].map(v=><option key={v}>{v}</option>)}</select></div>
        <select
          aria-label="Schedule filter"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="all">All clips</option>
          <option value="unscheduled">Unscheduled</option>
          <option value="scheduled">Scheduled</option>
        </select>
      </div>
      {visible.filter(({c})=>view!=="List"||!plan[c.editorialId||c.id]||plan[c.editorialId||c.id].startsWith(dateKey(month).slice(0,7)))
        .filter(
          ({ c }) =>
            filter === "all" ||
            (filter === "scheduled") === !!plan[c.editorialId || c.id],
        )
        .map(({ c, p }) => (
          <div
            className="schedule-row"
            draggable
            onDragStart={(e) =>
              e.dataTransfer.setData("text/plain", c.editorialId || c.id)
            }
            key={c.id}
          >
            <button onClick={() => open(p.id, c.id)}>{c.title}</button>
            <select aria-label={"Target platform for "+c.title} value={targets[c.editorialId||c.id]||""} onChange={e=>{const next={...targets,[c.editorialId||c.id]:e.target.value};setTargets(next);localStorage.setItem("studio-platforms",JSON.stringify(next))}}><option value="">Choose platform</option>{["YouTube","Instagram","TikTok","Twitch","Other"].map(v=><option key={v}>{v}</option>)}</select><input
              type="date"
              aria-label={"Schedule " + c.title}
              value={plan[c.editorialId || c.id] || ""}
              onChange={(e) => schedule(c.editorialId || c.id, e.target.value)}
            />
          </div>
        ))}
    </>
  );
}
