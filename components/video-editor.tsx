"use client";
import { useState, useRef, useCallback, useEffect } from "react";
import { Play, Check, LoaderCircle, Scissors, Captions } from "lucide-react";
import { Modal } from "./modal";
import { FormatSettings, SubtitleSettings } from "./clip-settings";
import { Button } from "./ui/button";
import type { Clip, Project, Segment } from "@/lib/types";
import { EditorMonitor } from "./editor-monitor";
import { EditTimeline } from "./edit-timeline";
import { Undo2, Redo2, Scan, Maximize, Keyboard } from "lucide-react";
function timecode(value: number) {
  const n = Math.round(value * 100) / 100,
    seconds = (n % 60).toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
  return n >= 3600
    ? `${Math.floor(n / 3600)}:${String(Math.floor(n / 60) % 60).padStart(2, "0")}:${seconds.replace(/^(\d)(?=\.|$)/, "0$1")}`
    : `${Math.floor(n / 60)}:${seconds.replace(/^(\d)(?=\.|$)/, "0$1")}`;
}
function seconds(value: string) {
  const parts = value.trim().split(":");
  if (
    parts.length > 3 ||
    !/^\d+(?::\d{1,2}){0,2}(?:\.\d{1,2})?$/.test(value.trim())
  )
    return NaN;
  const numbers = parts.map(Number);
  if (numbers.slice(1).some((n) => n >= 60)) return NaN;
  return numbers.reduce((total, n) => total * 60 + n, 0);
}
export function VideoEditor({
  subtitleTab = false,
  clip,
  project,
  onClose,
  onSaved,
}: {
  subtitleTab?: boolean;
  clip: Clip;
  project: Project;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [settings, setSettings] = useState(clip.settings),
    [startText, setStartText] = useState(timecode(clip.start)),
    [endText, setEndText] = useState(timecode(clip.end)),
    [segments, setSegments] = useState<Segment[]>(clip.segments),
    [tab, setTab] = useState(subtitleTab ? "subtitles" : "video"),
    [saving, setSaving] = useState(false),
    [error, setError] = useState("");
  const video = useRef<HTMLVideoElement>(null);
  const start = seconds(startText),
    end = seconds(endText),
    valid = Number.isFinite(start) && Number.isFinite(end);
  const [now, setNow] = useState(clip.start),
    [safe, setSafe] = useState(false),
    [help, setHelp] = useState(false),
    [playing, setPlaying] = useState(false),
    [ready, setReady] = useState(false),
    [inspector, setInspector] = useState(true),
    [panelWidth, setPanelWidth] = useState(340);
  useEffect(() => {
    const n = Number(localStorage.getItem("studio-inspector"));
    if (n >= 250 && n <= 480) setPanelWidth(n);
  }, []);
  const [fps, setFps] = useState<number | null>(null);
  useEffect(() => {
    fetch("/api/media-info?project=" + project.id)
      .then((r) => r.json())
      .then((data) => setFps(data.fps || null))
      .catch(() => {});
  }, [project.id]);
  const [shortcutQuery,setShortcutQuery]=useState("");
  const good =
    valid &&
    start >= 0 &&
    end > start &&
    end <= project.duration &&
    end - start <= 600;
  const [splitAt,setSplitAt]=useState<number|null>(null);
  const snapshot = { settings, startText, endText, segments,splitAt };
  const history = useRef<{
    past: (typeof snapshot)[];
    future: (typeof snapshot)[];
  }>({ past: [], future: [] });
  const previous = useRef(snapshot),
    restoring = useRef(false);
  useEffect(() => {
    const old = previous.current;
    if (
      old.settings === settings &&
      old.startText === startText &&
      old.endText === endText &&
      old.segments === segments && old.splitAt===splitAt
    )
      return;
    if (!restoring.current) {
      history.current.past.push(old);
      if (history.current.past.length > 100) history.current.past.shift();
      history.current.future = [];
    }
    restoring.current = false;
    previous.current = { settings, startText, endText, segments,splitAt };
  }, [settings, startText, endText, segments,splitAt]);
  function restore(redo: boolean) {
    const { past, future } = history.current;
    const next = (redo ? future : past).pop();
    if (!next) return;
    (redo ? past : future).push(snapshot);
    restoring.current = true;
    setSettings(next.settings);
    setStartText(next.startText);
    setEndText(next.endText);
    setSegments(next.segments);setSplitAt(next.splitAt);
  }
  function seek(t: number) {
    if (video.current) {
      video.current.currentTime = Math.max(0, Math.min(project.duration, t));
      setNow(video.current.currentTime);
    }
  }
  useEffect(() => {
    if (video.current) video.current.volume = Math.min(1, settings.volume ?? 1);
  }, [settings.volume]);
  function toggle() {
    if (!video.current) return;
    if (!video.current.paused) video.current.pause();
    else {
      if (now < start || now >= end) seek(start);
      void video.current
        .play()
        .catch(() => setError("Unable to play this source."));
    }
  }
  useEffect(() => {
    function key(e: KeyboardEvent) {
      if (
        saving ||
        (e.target instanceof HTMLElement &&
          e.target.closest("input,textarea,select,[contenteditable=true]"))
      )
        return;
      const k = e.key.toLowerCase();
      if ((e.ctrlKey||e.metaKey)&&k==="e"){e.preventDefault();document.getElementById("export-saved-render")?.click()} else if ((e.ctrlKey || e.metaKey) && k === "s") {
        e.preventDefault();
        if (good) void save();
      } else if ((e.ctrlKey || e.metaKey) && k === "z") {
        e.preventDefault();
        restore(e.shiftKey);
      } else if (k === " " && !(e.target instanceof HTMLButtonElement)) {
        e.preventDefault();
        toggle();
      } else if(k==="s"&&!e.ctrlKey&&!e.metaKey&&now>start+.04&&now<end-.04)setSplitAt(now); else if (k === "i" && now < end) setStartText(timecode(now));
      else if (k === "o" && now > start) setEndText(timecode(now));
      else if (fps && (k === "arrowleft" || k === "arrowright")) {
        e.preventDefault();
        video.current?.pause();
        seek(now + (k === "arrowleft" ? -1 : 1) / fps);
      } else if (k === "k") video.current?.pause();
      else if (k === "l") void video.current?.play().catch(() => {});
    }
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });
  const [quality,setQuality]=useState(720);
  const dirty=settings!==clip.settings||segments!==clip.segments||start!==clip.start||end!==clip.end||splitAt!==null;
  const close = useCallback(()=>{if(!dirty||confirm("Discard unsaved clip changes?"))onClose()},[dirty,onClose]);
  async function save() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project: project.id,
          clip: clip.id,
          start,
          end,
          settings,
          segments,splitAt,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw Error(data.error);
      await onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }
  return (
    <Modal
      title="Edit video"
      description={project.title+" · "+clip.title}
      size="wide"
      onClose={close}
      busy={saving}
    >
      <div className="edit-toolbar">
        <span>
          {dirty?"Unsaved changes":"Saved render"} · {settings.resolution}p <i> / </i> {settings.ratio}
        </span>
        <div>
          <select className="preview-quality" aria-label="Preview quality" value={quality} onChange={e=>setQuality(+e.target.value)}><option value={360}>360p preview</option><option value={720}>720p preview</option></select><button
            title="Toggle inspector"
            aria-pressed={inspector}
            onClick={() => setInspector(!inspector)}
          >
            Inspector
          </button>
          <button disabled={splitAt===null&&(now<=start+.04||now>=end-.04)} title="Split at playhead" onClick={()=>setSplitAt(splitAt===null?now:null)}>{splitAt===null?<Scissors size={16}/>:("Clear split "+timecode(splitAt))}</button><button title="Undo" onClick={() => restore(false)}>
            <Undo2 size={16} />
          </button>
          <a id="export-saved-render" className="editor-export" download href={`/api/download?project=${project.id}&clip=${clip.id}&kind=bundle`}>Export saved clip</a>
          <button title="Redo" onClick={() => restore(true)}>
            <Redo2 size={16} />
          </button>
          <button
            aria-pressed={safe}
            title="Safe area guides"
            onClick={() => setSafe(!safe)}
          >
            <Scan size={16} />
          </button>
          <button
            title="Fullscreen monitor"
            onClick={() =>
              void document
                .querySelector(".editor-preview")
                ?.requestFullscreen()
                .catch(() =>
                  setError("Fullscreen is unavailable in this browser."),
                )
            }
          >
            <Maximize size={16} />
          </button>
          <button title="Keyboard shortcuts" onClick={() => setHelp(!help)}>
            <Keyboard size={16} />
          </button>
        </div>
      </div>
      {help && (
        <section className="shortcuts-panel"><label className="search-field"><input aria-label="Search shortcuts" placeholder="Search keyboard shortcuts" value={shortcutQuery} onChange={e=>setShortcutQuery(e.target.value)}/></label>{[["Space","Play / pause"],["K / L","Pause / play"],["← / →","Step one frame"],["I / O","Set in / out point"],["S","Split at playhead"],["Ctrl/Cmd + Z","Undo"],["Ctrl/Cmd + Shift + Z","Redo"],["Ctrl/Cmd + S","Save render"],["Ctrl/Cmd + E","Export saved render"]].filter(row=>row.join(" ").toLowerCase().includes(shortcutQuery.toLowerCase())).map(([key,name])=><div key={key}><kbd>{key}</kbd>{name}</div>)}</section>
      )}
      <div
        className={"editor-grid " + (!inspector ? "hide-inspector" : "")}
        style={
          { "--inspector-width": panelWidth + "px" } as React.CSSProperties
        }
      >
        <div className="editor-player-column">
          <div
            className="editor-preview"
            style={{ aspectRatio: settings.ratio.replace(":", "/") }}
          >
            <video
              ref={video}
              className="frame-source"
              playsInline
              src={`/api/download?project=${project.id}&kind=source`}
              onError={() =>
                setError(
                  "Source unavailable. Reimport the recording to restore the monitor.",
                )
              }
              onLoadedData={() => setReady(true)}
              onLoadedMetadata={() => seek(clip.start)}
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onTimeUpdate={() => {
                const v = video.current;
                if (!v) return;
                setNow(v.currentTime);
                if (!v.paused && valid && v.currentTime >= end) {
                  v.pause();
                  seek(start);
                }
              }}
            />
            {!ready && (
              <span className="monitor-loading" role="status">
                <LoaderCircle className="spin" size={15} /> Loading source frame
              </span>
            )}
            <EditorMonitor quality={quality}
              video={video}
              settings={settings}
              segments={segments}
              safe={safe}
            />
          </div>
          <Button variant="secondary" disabled={!good} onClick={toggle}>
            <Play size={14} />
            {playing ? "Pause" : "Play selection"}
          </Button>
        </div>
        {inspector && (
          <input
            className="panel-resize"
            type="range"
            aria-label="Inspector width"
            min="250"
            max="480"
            value={panelWidth}
            onChange={(e) => {
              setPanelWidth(+e.target.value);
              localStorage.setItem("studio-inspector", e.target.value);
            }}
          />
        )}
        <div className="editor-controls" hidden={!inspector}>
          <div className="segmented" role="tablist" aria-label="Editor tools">
            <button
              role="tab"
              aria-selected={tab === "video"}
              className={tab === "video" ? "selected" : ""}
              onClick={() => setTab("video")}
            >
              <Scissors size={15} />
              Trim & layout
            </button>
            <button
              role="tab"
              aria-selected={tab === "subtitles"}
              className={tab === "subtitles" ? "selected" : ""}
              onClick={() => setTab("subtitles")}
            >
              <Captions size={15} />
              Subtitles
            </button>
          </div>
          {tab === "video" ? (
            <div className="editor-fields">
              <div className="field-grid">
                <label className="field">
                  <span>Start time</span>
                  <input
                    type="text"
                    placeholder="0:00"
                    value={startText}
                    onChange={(e) => setStartText(e.target.value)}
                  />
                </label>
                <label className="field">
                  <span>End time</span>
                  <input
                    type="text"
                    placeholder="0:30"
                    value={endText}
                    onChange={(e) => setEndText(e.target.value)}
                  />
                </label>
              </div>
              <p className="hint">
                Use minutes:seconds or hours:minutes:seconds.
              </p>
              <FormatSettings value={settings} onChange={setSettings} />
              <details><summary className="inline-link">Transform canvas</summary>{([["scale","Scale",1,2,.01,1],["rotation","Rotation",-180,180,1,0],["opacity","Opacity",0,1,.01,1],["offsetY","Vertical crop",0,100,1,50]] as const).map(([key,label,min,max,step,defaultValue])=><label className="field" key={key}>{label} · {settings[key]??defaultValue}<input type="range" min={min} max={max} step={step} value={settings[key]??defaultValue} onChange={e=>setSettings({...settings,[key]:+e.target.value})}/></label>)}</details>
              <label className="field">
                Audio volume · {Math.round((settings.volume ?? 1) * 100)}%
                <input
                  type="range"
                  min="0"
                  max="1"
                  step=".01"
                  value={settings.volume ?? 1}
                  onChange={(e) =>
                    setSettings({ ...settings, volume: +e.target.value })
                  }
                />
              </label>
            </div>
          ) : (
            <div className="editor-fields">
              <SubtitleSettings value={settings} onChange={setSettings} />
              {settings.captions && (
                <div className="subtitle-lines">
                  <h3>Subtitle text</h3>
                  {segments.length ? (
                    segments.map((segment, i) => (
                      <label className="subtitle-line" key={i}>
                        <span>
                          {Math.floor(segment.start / 60)}:
                          {String(Math.floor(segment.start % 60)).padStart(
                            2,
                            "0",
                          )}
                        </span>
                        <textarea
                          aria-label={`Subtitle ${i + 1}`}
                          value={segment.text}
                          onChange={(e) =>
                            setSegments(
                              segments.map((s, index) =>
                                index === i
                                  ? { ...s, text: e.target.value, words: [] }
                                  : s,
                              ),
                            )
                          }
                        />
                      </label>
                    ))
                  ) : (
                    <p className="hint">
                      Subtitles will be transcribed when this clip is rendered.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <EditTimeline
        clip={clip.id}
        originalStart={clip.start}
        originalEnd={clip.end}
        project={project.id}
        anchor={(clip.start + clip.end) / 2}
        length={project.duration}
        start={valid ? start : clip.start}
        end={valid ? end : clip.end}
        now={now}
        seek={seek}
        segments={segments}
        inPoint={(v) => {
          setStartText(timecode(v));
          seek(v);
        }}
        outPoint={(v) => {
          setEndText(timecode(v));
          seek(v);
        }}
      />
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
      <footer className="modal-footer">
        <span className="muted">
          {valid
            ? `${Math.max(0, end - start).toFixed(1)} seconds selected`
            : "Enter a valid time range"}
        </span>
        <Button
          disabled={
            saving ||
            !valid ||
            start < 0 ||
            end <= start ||
            end > project.duration ||
            end - start > 600
          }
          onClick={() => void save()}
        >
          {saving ? (
            <LoaderCircle size={16} className="spin" />
          ) : (
            <Check size={16} />
          )}
          {splitAt===null?"Save changes":"Save two clips"}
        </Button>
      </footer>
    </Modal>
  );
}
