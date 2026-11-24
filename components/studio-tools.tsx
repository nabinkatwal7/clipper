"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Search,
  Download,
} from "lucide-react";
import { FrameStrip } from "./frame-strip";
import { StreamIndex } from "./stream-index";
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
  const [frameReady, setFrameReady] = useState(false);
  const video = useRef<HTMLVideoElement>(null),
    canvas = useRef<HTMLCanvasElement>(null);
  const [rows, setRows] = useState<Segment[]>([]),
    [query, setQuery] = useState(""),
    [time, setTime] = useState(0),
    [scroll, setScroll] = useState(0),
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
        setScroll(0);
        if (transcriptList.current) transcriptList.current.scrollTop = 0;
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
  const transcriptList = useRef<HTMLDivElement>(null);
  const firstRow = Math.max(0, Math.floor(scroll / 74) - 3);
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
            setFrameReady(true);
            if (thumbnail) draw();
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
        {thumbnail && (
          <FrameStrip
            project={project.id}
            left={0}
            span={project.duration}
            onSelect={seek}
          />
        )}
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
        {!thumbnail && kind === "Highlights" && (
          <StreamIndex project={project} seek={seek} />
        )}
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
                      setScroll(0);
                      if (transcriptList.current)
                        transcriptList.current.scrollTop = 0;
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
                <div
                  className="transcript-rows virtual-transcript"
                  ref={transcriptList}
                  onScroll={(e) => setScroll(e.currentTarget.scrollTop)}
                >
                  <div style={{ height: firstRow * 74 }} aria-hidden="true" />
                  {filtered.slice(firstRow, firstRow + 28).map((s) => (
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
                        <span>{s.text}</span>
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
                  <div
                    style={{
                      height: Math.max(0, filtered.length - firstRow - 28) * 74,
                    }}
                    aria-hidden="true"
                  />
                </div>
              </>
            )}
          </>
        )}
      </section>
    </div>
  );
}
