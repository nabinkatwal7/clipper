"use client";
import { studioStorage } from "@/lib/client-storage";
import { loadWorkspace, saveWorkspace } from "@/lib/workspace-presets";
import { useState, useRef, useCallback, useEffect } from "react";
import { Play, Check, LoaderCircle, Scissors } from "lucide-react";
import { Modal } from "./modal";
import { FormatSettings, SubtitleSettings } from "./clip-settings";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";
import type { Clip, Project, Segment, Settings } from "@/lib/types";
import { LocalizationPanel } from "./localization-panel";
import { HistoryPanel } from "./history-panel";
import { FrameSuggestion } from "./frame-suggestion";
import { RenderPreview } from "./render-preview";
import { LayersPanel } from "./layers-panel";
import { GradePanel } from "./grade-panel";
import { DirectorPanel } from "./director-panel";
import { EditorMonitor } from "./editor-monitor";
import { EditorInspector, editorTools } from "./editor-inspector";
import { EditTimeline } from "./edit-timeline";
import { VideoScopes } from "./video-scopes";
import { AudioMeter } from "./audio-meter";
import { CaptionTrackEditor } from "./caption-track-editor";
import { SequenceManager } from "./sequence-manager";
import { EditRecipesPanel } from "./edit-recipes-panel";
import { RenderReplacePanel } from "./render-replace-panel";
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
    [tab, setTab] = useState(
      () => (subtitleTab ? "subtitles" : loadWorkspace()?.tool || "video"),
    ),
    [saving, setSaving] = useState(false),
    [error, setError] = useState("");
  const video = useRef<HTMLVideoElement>(null);
  const monitorCanvas = useRef<HTMLCanvasElement>(null);
  const draftKey = "clipper-draft-" + clip.id;
  const [draftOffer, setDraftOffer] = useState<string | null>(null);
  const start = seconds(startText),
    end = seconds(endText),
    valid = Number.isFinite(start) && Number.isFinite(end);
  const [now, setNow] = useState(clip.start),
    [safe, setSafe] = useState(false),
    [help, setHelp] = useState(false),
    [playing, setPlaying] = useState(false),
    [ready, setReady] = useState(false),
    [inspector, setInspector] = useState(true),
    [panelWidth, setPanelWidth] = useState(340),
    [monitorView, setMonitorView] = useState<"program" | "source" | "dual">(
      "dual",
    ),
    [sourceIn, setSourceIn] = useState(clip.start),
    [sourceOut, setSourceOut] = useState(clip.end);
  useEffect(() => {
    const n = Number(studioStorage.getItem("studio-inspector"));
    if (n >= 250 && n <= 480) setPanelWidth(n);
  }, []);
  const [fps, setFps] = useState<number | null>(null);
  useEffect(() => {
    fetch("/api/media-info?project=" + project.id)
      .then((r) => r.json())
      .then((data) => setFps(data.fps || null))
      .catch(() => {});
  }, [project.id]);
  const [shortcutQuery, setShortcutQuery] = useState("");
  const good =
    valid &&
    start >= 0 &&
    end > start &&
    end <= project.duration &&
    end - start <= 600;
  const [splitAt, setSplitAt] = useState<number | null>(null);
  const [title, setTitle] = useState(clip.title),
    [variation, setVariation] = useState(false);
  const [postCaption, setPostCaption] = useState(clip.postCaption);
  const snapshot = {
    postCaption,
    title,
    settings,
    startText,
    endText,
    segments,
    splitAt,
  };
  const history = useRef<{
    past: (typeof snapshot)[];
    future: (typeof snapshot)[];
  }>({ past: [], future: [] });
  const [historyCount, setHistoryCount] = useState([0, 0]);
  const previous = useRef(snapshot),
    restoring = useRef(false);
  useEffect(() => {
    const old = previous.current;
    if (
      old.postCaption === postCaption &&
      old.title === title &&
      old.settings === settings &&
      old.startText === startText &&
      old.endText === endText &&
      old.segments === segments &&
      old.splitAt === splitAt
    )
      return;
    if (!restoring.current) {
      history.current.past.push(old);
      if (history.current.past.length > 100) history.current.past.shift();
      history.current.future = [];
    }
    restoring.current = false;
    setHistoryCount([
      history.current.past.length,
      history.current.future.length,
    ]);
    previous.current = {
      postCaption,
      title,
      settings,
      startText,
      endText,
      segments,
      splitAt,
    };
  }, [postCaption, title, settings, startText, endText, segments, splitAt]);
  function restore(redo: boolean) {
    const { past, future } = history.current;
    const next = (redo ? future : past).pop();
    if (!next) return;
    (redo ? past : future).push(snapshot);
    restoring.current = true;
    setPostCaption(next.postCaption);
    setTitle(next.title);
    setSettings(next.settings);
    setStartText(next.startText);
    setEndText(next.endText);
    setSegments(next.segments);
    setSplitAt(next.splitAt);
  }
  function resizeInspector(width: number) {
    const next = Math.min(480, Math.max(250, Math.round(width)));
    setPanelWidth(next);
    studioStorage.setItem("studio-inspector", String(next));
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
  useEffect(() => {
    if (video.current) video.current.playbackRate = settings.playbackRate ?? 1;
  }, [settings.playbackRate]);
  useEffect(() => {
    const payload = {
      savedAt: new Date().toISOString(),
      title,
      postCaption,
      settings,
      startText,
      endText,
      segments,
    };
    const handle = setTimeout(() => {
      studioStorage.setItem(draftKey, JSON.stringify(payload));
      void fetch("/api/edit-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project: project.id,
          clip: clip.id,
          title,
          postCaption,
          start: Number.isFinite(seconds(startText))
            ? seconds(startText)
            : undefined,
          end: Number.isFinite(seconds(endText)) ? seconds(endText) : undefined,
          settings,
          segments,
        }),
      }).catch(() => {});
    }, 900);
    return () => clearTimeout(handle);
  }, [
    draftKey,
    project.id,
    clip.id,
    title,
    postCaption,
    settings,
    startText,
    endText,
    segments,
  ]);
  useEffect(() => {
    try {
      const raw = studioStorage.getItem(draftKey);
      if (!raw) return;
      const draft = JSON.parse(raw) as { savedAt?: string };
      if (
        draft.savedAt &&
        new Date(draft.savedAt).getTime() >
          new Date(project.updatedAt).getTime()
      )
        setDraftOffer(draft.savedAt);
    } catch {}
  }, [draftKey, project.updatedAt]);
  function restoreDraft() {
    try {
      const raw = studioStorage.getItem(draftKey);
      if (!raw) return;
      const draft = JSON.parse(raw) as {
        title?: string;
        postCaption?: string;
        settings?: typeof settings;
        startText?: string;
        endText?: string;
        segments?: Segment[];
      };
      restoring.current = true;
      if (draft.title) setTitle(draft.title);
      if (draft.postCaption !== undefined) setPostCaption(draft.postCaption);
      if (draft.settings) setSettings(draft.settings);
      if (draft.startText) setStartText(draft.startText);
      if (draft.endText) setEndText(draft.endText);
      if (draft.segments) setSegments(draft.segments);
      setDraftOffer(null);
    } catch {}
  }
  function toggle() {
    if (!video.current) return;
    if (!video.current.paused) video.current.pause();
    else if (settings.reverse) {
      // Drive reverse by seeking backward; HTML5 cannot natively reverse decode.
      if (now <= start || now >= end) seek(end - 0.04);
      void video.current.pause();
      setPlaying(true);
    } else {
      if (now < start || now >= end) seek(start);
      void video.current
        .play()
        .catch(() => setError("Unable to play this source."));
    }
  }
  useEffect(() => {
    if (!settings.reverse || !playing || !video.current) return;
    let frame = 0;
    let last = performance.now();
    const rate = settings.playbackRate ?? 1;
    const tick = (stamp: number) => {
      const dt = Math.min(0.05, (stamp - last) / 1000) * rate;
      last = stamp;
      const v = video.current;
      if (!v) return;
      const next = v.currentTime - dt;
      if (next <= start) {
        v.currentTime = start;
        setPlaying(false);
        setNow(start);
        return;
      }
      v.currentTime = next;
      setNow(next);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [settings.reverse, settings.playbackRate, playing, start]);
  useEffect(() => {
    function key(e: KeyboardEvent) {
      if (
        saving ||
        (e.target instanceof HTMLElement &&
          e.target.closest("input,textarea,select,[contenteditable=true]"))
      )
        return;
      const k = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && k === "e") {
        e.preventDefault();
        document.getElementById("export-saved-render")?.click();
      } else if ((e.ctrlKey || e.metaKey) && k === "s") {
        e.preventDefault();
        if (good) void save();
      } else if ((e.ctrlKey || e.metaKey) && k === "z") {
        e.preventDefault();
        restore(e.shiftKey);
      } else if (k === " " && !(e.target instanceof HTMLButtonElement)) {
        e.preventDefault();
        toggle();
      } else if (
        k === "s" &&
        !e.ctrlKey &&
        !e.metaKey &&
        now > start + 0.04 &&
        now < end - 0.04
      )
        setSplitAt(now);
      else if (k === "i" && now < end) setStartText(timecode(now));
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
  const [quality, setQuality] = useState(720);
  const [useProxy, setUseProxy] = useState(false);
  const [beats, setBeats] = useState<{ time: number; strength: number }[]>([]);
  const [beatBusy, setBeatBusy] = useState(false);
  const [beatInfo, setBeatInfo] = useState("");
  async function analyzeBeats() {
    setBeatBusy(true);
    setError("");
    try {
      const r = await fetch("/api/beat-detect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project: project.id }),
      });
      const data = await r.json();
      if (!r.ok) throw Error(data.error);
      setBeats(data.beats || []);
      setBeatInfo(
        data.bpm
          ? `~${data.bpm} BPM · ${Math.round((data.confidence || 0) * 100)}% confidence`
          : "Beats detected without a stable BPM estimate",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBeatBusy(false);
    }
  }
  const [proxyReady, setProxyReady] = useState(false);
  const [proxyBusy, setProxyBusy] = useState(false);
  useEffect(() => {
    let alive = true;
    fetch(
      `/api/media-proxy?kind=source&project=${encodeURIComponent(project.id)}`,
    )
      .then((r) => r.json())
      .then((data) => {
        if (alive) setProxyReady(!!data.ready);
      })
      .catch(() => {
        if (alive) setProxyReady(false);
      });
    return () => {
      alive = false;
    };
  }, [project.id]);
  async function ensureProxy() {
    setProxyBusy(true);
    setError("");
    try {
      const r = await fetch("/api/media-proxy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "source", project: project.id }),
      });
      const data = await r.json();
      if (!r.ok) throw Error(data.error);
      setProxyReady(!!data.ready);
      setUseProxy(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setProxyBusy(false);
    }
  }
  const dirty =
    title !== clip.title ||
    settings !== clip.settings ||
    segments !== clip.segments ||
    start !== clip.start ||
    end !== clip.end ||
    splitAt !== null;
  const close = useCallback(() => {
    if (!dirty || confirm("Discard unsaved clip changes?")) onClose();
  }, [dirty, onClose]);
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
          title,
          postCaption,
          variation,
          start,
          end,
          settings,
          segments,
          splitAt,
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
      description={project.title + " · " + clip.title}
      size="wide"
      onClose={close}
      busy={saving}
    >
      <TooltipProvider delayDuration={200}>
      <div className="edit-toolbar">
        <span className="edit-toolbar-status">
          <Badge variant={dirty ? "warning" : "success"}>
            {dirty ? "Unsaved" : "Saved"}
          </Badge>
          <span>
            {settings.resolution}p · {settings.ratio}
          </span>
        </span>
        <div className="edit-toolbar-actions">
          <select
            className="preview-quality"
            aria-label="Preview quality"
            value={quality}
            onChange={(e) => setQuality(+e.target.value)}
          >
            <option value={360}>360p preview</option>
            <option value={720}>720p preview</option>
          </select>
          <Button
            type="button"
            variant={useProxy && proxyReady ? "default" : "secondary"}
            size="sm"
            aria-pressed={useProxy && proxyReady}
            disabled={proxyBusy}
            title={
              proxyReady
                ? "Toggle low-resolution proxy for the source monitor"
                : "Generate a low-resolution proxy for smoother scrubbing"
            }
            onClick={() => {
              if (!proxyReady) void ensureProxy();
              else setUseProxy(!useProxy);
            }}
          >
            {proxyBusy
              ? "Building proxy…"
              : useProxy && proxyReady
                ? "Proxy on"
                : "Proxy"}
          </Button>
          <select
            className="preview-quality"
            aria-label="Monitor layout"
            value={monitorView}
            onChange={(e) =>
              setMonitorView(e.target.value as "program" | "source" | "dual")
            }
          >
            <option value="dual">Source + Program</option>
            <option value="source">Source monitor</option>
            <option value="program">Program monitor</option>
          </select>
          <Button
            type="button"
            variant={inspector ? "secondary" : "ghost"}
            size="sm"
            aria-pressed={inspector}
            onClick={() => setInspector(!inspector)}
          >
            Inspector
          </Button>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={
                  splitAt === null && (now <= start + 0.04 || now >= end - 0.04)
                }
                onClick={() => setSplitAt(splitAt === null ? now : null)}
              >
                {splitAt === null ? (
                  <Scissors size={16} />
                ) : (
                  <span className="text-xs">Clear</span>
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {splitAt === null
                ? "Split at playhead"
                : "Clear split " + timecode(splitAt)}
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={!historyCount[0]}
                onClick={() => restore(false)}
              >
                <Undo2 size={16} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Undo</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={!historyCount[1]}
                onClick={() => restore(true)}
              >
                <Redo2 size={16} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Redo</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant={safe ? "secondary" : "ghost"}
                size="icon"
                aria-pressed={safe}
                onClick={() => setSafe(!safe)}
              >
                <Scan size={16} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Safe area guides</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
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
              </Button>
            </TooltipTrigger>
            <TooltipContent>Fullscreen monitor</TooltipContent>
          </Tooltip>
          <Button asChild size="sm" variant="secondary">
            <a
              id="export-saved-render"
              className="editor-export"
              download
              href={`/api/download?project=${project.id}&clip=${clip.id}&kind=bundle`}
            >
              Export saved clip
            </a>
          </Button>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setHelp(!help)}
              >
                <Keyboard size={16} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Keyboard shortcuts</TooltipContent>
          </Tooltip>
        </div>
      </div>
      </TooltipProvider>
      {draftOffer && (
        <p className="hint" role="status">
          A newer local draft exists (
          {new Date(draftOffer).toLocaleString()}).{" "}
          <button type="button" className="tool" onClick={restoreDraft}>
            Restore draft
          </button>{" "}
          <button
            type="button"
            className="tool"
            onClick={() => {
              studioStorage.removeItem(draftKey);
              setDraftOffer(null);
            }}
          >
            Dismiss
          </button>
        </p>
      )}
      {help && (
        <section className="shortcuts-panel">
          <label className="search-field">
            <input
              aria-label="Search shortcuts"
              placeholder="Search keyboard shortcuts"
              value={shortcutQuery}
              onChange={(e) => setShortcutQuery(e.target.value)}
            />
          </label>
          {[
            ["Space", "Play / pause"],
            ["K / L", "Pause / play"],
            ["← / →", "Step one frame"],
            ["I / O", "Set in / out point"],
            ["S", "Split at playhead"],
            ["Ctrl/Cmd + Z", "Undo"],
            ["Ctrl/Cmd + Shift + Z", "Redo"],
            ["Ctrl/Cmd + S", "Save render"],
            ["Ctrl/Cmd + E", "Export saved render"],
          ]
            .filter((row) =>
              row.join(" ").toLowerCase().includes(shortcutQuery.toLowerCase()),
            )
            .map(([key, name]) => (
              <div key={key}>
                <kbd>{key}</kbd>
                {name}
              </div>
            ))}
        </section>
      )}
      <div
        className={"editor-grid " + (!inspector ? "hide-inspector" : "")}
        style={
          { "--inspector-width": panelWidth + "px" } as React.CSSProperties
        }
      >
        <nav className="editor-rail" aria-label="Editing tools">
          {editorTools.map(([id, name, Icon]) => (
            <button
              key={id}
              onClick={() => {
                setTab(id);
                setInspector(true);
                const preset = loadWorkspace();
                saveWorkspace({
                  zoom: preset?.zoom ?? 1,
                  snap: preset?.snap ?? true,
                  tool: id,
                });
              }}
              title={name}
              aria-pressed={tab === id}
            >
              <Icon size={16} />
              <span>{name}</span>
            </button>
          ))}
        </nav>
        <div className="editor-player-column">
          <div
            className={`monitor-pair ${monitorView === "dual" ? "dual" : "single"}`}
          >
            {(monitorView === "source" || monitorView === "dual") && (
              <div className="monitor-pane">
                <header className="monitor-label">
                  <strong>Source</strong>
                  <span>
                    In {timecode(sourceIn)} · Out {timecode(sourceOut)}
                  </span>
                </header>
                <div
                  className="editor-preview source-only"
                  style={{ aspectRatio: settings.ratio.replace(":", "/") }}
                >
                  <video
                    key={useProxy && proxyReady ? "proxy" : "original"}
                    ref={video}
                    className="frame-source visible-source"
                    playsInline
                    src={`/api/download?project=${project.id}&kind=source${useProxy && proxyReady ? "&proxy=1" : ""}`}
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
                      <LoaderCircle className="spin" size={15} /> Loading
                    </span>
                  )}
                </div>
                <div className="monitor-actions">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSourceIn(now)}
                  >
                    Mark In
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSourceOut(now)}
                  >
                    Mark Out
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={sourceOut <= sourceIn}
                    onClick={() => {
                      setStartText(timecode(sourceIn));
                      setEndText(timecode(sourceOut));
                      seek(sourceIn);
                    }}
                  >
                    Overwrite edit
                  </Button>
                  <Button
                    size="sm"
                    disabled={sourceOut <= sourceIn}
                    onClick={() => {
                      setStartText(timecode(sourceIn));
                      setEndText(timecode(sourceOut));
                      seek(sourceIn);
                    }}
                    title="Applies the source In/Out range to the program clip"
                  >
                    Insert edit
                  </Button>
                </div>
              </div>
            )}
            {(monitorView === "program" || monitorView === "dual") && (
              <div className="monitor-pane">
                <header className="monitor-label">
                  <strong>Program</strong>
                  <span>
                    {valid
                      ? `${timecode(start)}–${timecode(end)}`
                      : "Clip range"}
                  </span>
                </header>
                <div
                  className="editor-preview"
                  style={{ aspectRatio: settings.ratio.replace(":", "/") }}
                >
                  {monitorView === "program" && (
                    <video
                      key={(useProxy && proxyReady ? "proxy" : "original") + "-p"}
                      ref={video}
                      className="frame-source"
                      playsInline
                      src={`/api/download?project=${project.id}&kind=source${useProxy && proxyReady ? "&proxy=1" : ""}`}
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
                  )}
                  {!ready && monitorView === "program" && (
                    <span className="monitor-loading" role="status">
                      <LoaderCircle className="spin" size={15} /> Loading source
                      frame
                    </span>
                  )}
                  <EditorMonitor
                    quality={quality}
                    video={video}
                    settings={settings}
                    segments={segments}
                    safe={safe}
                    clipStart={valid ? start : clip.start}
                    clipEnd={valid ? end : clip.end}
                    preferProxy={useProxy && proxyReady}
                    monitorCanvas={monitorCanvas}
                  />
                  {monitorView === "program" && (
                    <>
                      <VideoScopes video={video} canvas={monitorCanvas} />
                      <AudioMeter video={video} />
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
          <Button variant="secondary" disabled={!good} onClick={toggle}>
            <Play size={14} />
            {playing ? "Pause" : "Play selection"}
          </Button>
        </div>
        {inspector && (
          <div
            role="separator"
            tabIndex={0}
            aria-orientation="vertical"
            aria-label="Resize inspector"
            aria-valuemin={250}
            aria-valuemax={480}
            aria-valuenow={panelWidth}
            className="panel-resize"
            title="Drag to resize inspector"
            onPointerDown={(e) => {
              e.preventDefault();
              e.currentTarget.setPointerCapture(e.pointerId);
            }}
            onPointerMove={(e) => {
              if (e.currentTarget.hasPointerCapture(e.pointerId))
                resizeInspector(
                  e.currentTarget.parentElement!.getBoundingClientRect().right -
                    e.clientX,
                );
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
                e.preventDefault();
                e.stopPropagation();
                resizeInspector(panelWidth + (e.key === "ArrowLeft" ? 8 : -8));
              }
            }}
          />
        )}
        <div className="editor-controls" hidden={!inspector}>
          {tab === "video" && (
            <h3 className="inspector-title">Trim &amp; layout</h3>
          )}
          {tab === "subtitles" && (
            <h3 className="inspector-title">Subtitle properties</h3>
          )}
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
              <details>
                <summary>Animate crop position</summary>
                <FrameSuggestion
                  project={project.id}
                  at={now}
                  apply={(point) => {
                    const time = Math.round(point.time * 1000) / 1000;
                    const points = (settings.cropPoints || []).filter(
                      (p) => p.time !== time,
                    );
                    if (points.length >= 64) {
                      setError("Remove a crop keyframe before adding another.");
                      return;
                    }
                    setSettings({
                      ...settings,
                      cropPoints: [...points, { ...point, time }].sort(
                        (a, b) => a.time - b.time,
                      ),
                    });
                  }}
                />
                <p className="hint">
                  Set the horizontal and vertical subject position at the
                  playhead. The crop moves linearly between saved positions.
                </p>
                {(["crop", "offsetY"] as const).map((k, i) => (
                  <label className="field" key={k}>
                    {i ? "Vertical" : "Horizontal"} subject position
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={settings[k] ?? 50}
                      onChange={(e) =>
                        setSettings({ ...settings, [k]: +e.target.value })
                      }
                    />
                  </label>
                ))}
                <button
                  className="tool"
                  disabled={
                    (settings.cropPoints?.length || 0) >= 64 ||
                    now < start ||
                    now > end
                  }
                  onClick={() => {
                    const time = Math.round(now * 1000) / 1000;
                    const points = (settings.cropPoints || []).filter(
                      (p) => p.time !== time,
                    );
                    setSettings({
                      ...settings,
                      cropPoints: [
                        ...points,
                        {
                          time,
                          x: settings.crop / 100,
                          y: (settings.offsetY ?? 50) / 100,
                        },
                      ].sort((a, b) => a.time - b.time),
                    });
                  }}
                >
                  Set crop at playhead
                </button>
                {settings.cropPoints?.map((p) => (
                  <div key={p.time} className="candidate-actions">
                    <button onClick={() => seek(p.time)}>
                      {timecode(p.time)} · {Math.round(p.x * 100)}%,{" "}
                      {Math.round(p.y * 100)}%
                    </button>
                    <button
                      onClick={() =>
                        setSettings({
                          ...settings,
                          cropPoints: settings.cropPoints?.filter(
                            (v) => v.time !== p.time,
                          ),
                        })
                      }
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </details>
              <label className="field">
                Clip title
                <input
                  maxLength={160}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </label>
              <FormatSettings value={settings} onChange={setSettings} />
            </div>
          ) : tab === "localize" ? (
            <LocalizationPanel
              project={project.id}
              clip={clip}
              apply={(title, rows, description) => {
                setPostCaption(description);
                setTitle(title);
                setSegments(rows);
                setSettings({ ...settings, captions: true });
              }}
            />
          ) : tab === "history" ? (
            <HistoryPanel
              project={project.id}
              clip={clip}
              restore={(v) => {
                setTitle(v.title);
                if (v.postCaption !== undefined) setPostCaption(v.postCaption);
                setSettings(v.settings);
                setSegments(v.segments);
                setStartText(timecode(v.start));
                setEndText(timecode(v.end));
                setSplitAt(null);
              }}
            />
          ) : tab === "layers" ? (
            <>
              <RenderPreview
                settings={settings}
                project={project.id}
                clip={clip.id}
                start={start}
                end={end}
                playhead={now}
              />
              <LayersPanel
                project={project.id}
                clip={clip.id}
                s={settings}
                change={setSettings}
                at={now - start}
                length={end - start}
                seek={(n) => seek(start + n)}
              />
            </>
          ) : tab === "sequences" ? (
            <SequenceManager
              project={{ ...project, settings }}
              clipId={clip.id}
              onChanged={async (doc) => {
                if (!doc) return;
                const active =
                  doc.sequences.find((s) => s.id === doc.activeSequence) ||
                  doc.sequences[0];
                setSettings({
                  ...settings,
                  sequences: doc as Settings["sequences"],
                  composition:
                    (active?.composition as Settings["composition"]) ||
                    settings.composition,
                });
              }}
            />
          ) : tab === "grade" || tab === "audio" ? (
            <GradePanel
              settings={settings}
              change={setSettings}
              project={project.id}
              clip={clip.id}
              start={start}
              end={end}
              audio={tab === "audio"}
              playhead={now}
            />
          ) : tab === "director" ? (
            <DirectorPanel
              clip={clip.id}
              project={project.id}
              apply={(p) => {
                if (p.kind === "title") setTitle(p.title);
                if (p.kind === "zoom")
                  setSettings({ ...settings, scale: p.scale });
                if (p.kind === "layout")
                  setSettings({ ...settings, layout: p.layout });
                if (p.kind === "range") {
                  setStartText(timecode(p.start));
                  setEndText(timecode(p.end));
                  seek(p.start);
                }
              }}
            />
          ) : tab === "recipes" ? (
            <EditRecipesPanel
              projectId={project.id}
              clipId={clip.id}
              settings={settings}
              onApply={setSettings}
            />
          ) : tab === "replace" ? (
            <RenderReplacePanel
              projectId={project.id}
              clipId={clip.id}
              settings={settings}
              length={(valid ? end : clip.end) - (valid ? start : clip.start)}
              onApply={setSettings}
            />
          ) : tab !== "subtitles" ? (
            <>
              <EditorInspector
                tab={tab}
                settings={settings}
                change={setSettings}
                project={project}
                length={(valid ? end : clip.end) - (valid ? start : clip.start)}
              />
              {tab === "speed" && (
                <RenderPreview
                  settings={settings}
                  project={project.id}
                  clip={clip.id}
                  start={start}
                  end={end}
                  playhead={now}
                />
              )}
            </>
          ) : (
            <div className="editor-fields">
              <SubtitleSettings value={settings} onChange={setSettings} />
              <CaptionTrackEditor
                segments={segments}
                change={setSegments}
                seek={seek}
                now={now}
              />
            </div>
          )}
        </div>
      </div>
      {beatInfo && <p className="hint">{beatInfo}</p>}
      <EditTimeline
        tracks={settings.composition?.tracks}
        beats={beats}
        beatBusy={beatBusy}
        onAnalyzeBeats={analyzeBeats}
        onTracks={(tracks) =>
          setSettings({
            ...settings,
            composition: { version: 1, tracks },
          })
        }
        overlay={settings.overlayText}
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
        <label className="check-row">
          <input
            type="checkbox"
            checked={variation}
            onChange={(e) => setVariation(e.target.checked)}
          />
          Save as variation
        </label>
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
          {variation
            ? "Render variation"
            : splitAt === null
              ? "Save changes"
              : "Save two clips"}
        </Button>
      </footer>
    </Modal>
  );
}
