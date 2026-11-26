"use client";

import { useEffect, useRef, useState } from "react";
import { defaults, type Project } from "@/lib/types";

type Recording = {
  recorder: MediaRecorder;
  began: number;
  output: Promise<Blob>;
};

function record(stream: MediaStream): Recording {
  const mimeType = [
    "video/webm;codecs=vp8,opus",
    "video/webm",
    "video/mp4",
  ].find((type) => MediaRecorder.isTypeSupported(type));
  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: 3_000_000,
  });
  const chunks: Blob[] = [];
  const output = new Promise<Blob>((resolve, reject) => {
    recorder.ondataavailable = ({ data }) => {
      if (data.size) chunks.push(data);
    };
    recorder.onstop = () =>
      resolve(new Blob(chunks, { type: recorder.mimeType }));
    recorder.onerror = () => reject(Error("The browser stopped recording."));
  });
  void output.catch(() => {});
  recorder.start(1000);
  return { recorder, began: performance.now(), output };
}

type ReplayDraft = { blob: Blob; seconds: number; url: string };

export function LiveClipping({
  open,
  projects,
}: {
  open: (id: string) => void;
  projects: Project[];
}) {
  const active = useRef<MediaStream | null>(null);
  const mounted = useRef(false);
  const slots = useRef<Recording[]>([]);
  const clock = useRef<number | undefined>(undefined);
  const video = useRef<HTMLVideoElement>(null);
  const [sharing, setSharing] = useState(false);
  const [starting, setStarting] = useState(false);
  const [available, setAvailable] = useState(0);
  const [audio, setAudio] = useState(false);
  const [busy, setBusy] = useState(false);
  const actionPending = useRef(false);
  const [draft, setDraft] = useState<ReplayDraft | null>(null);
  const [custom, setCustom] = useState("20");
  const [title, setTitle] = useState("");
  const previewUrl = draft?.url;
  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );
  const [ratio, setRatio] = useState("9:16");
  const [message, setMessage] = useState("");
  const [clips, setClips] = useState<{ id: string; title: string }[]>([]);
  function release() {
    window.clearInterval(clock.current);
    for (const { recorder } of slots.current)
      if (recorder.state !== "inactive") recorder.stop();
    slots.current = [];
    active.current?.getTracks().forEach((track) => track.stop());
    active.current = null;
  }
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      release();
    };
  }, []);
  function stop() {
    release();
    if (video.current) video.current.srcObject = null;
    setSharing(false);
    setAvailable(0);
  }
  async function start() {
    setStarting(true);
    setMessage("");
    try {
      if (
        !navigator.mediaDevices?.getDisplayMedia ||
        typeof MediaRecorder === "undefined"
      )
        throw Error(
          "Open Clipper Studio in a desktop browser that supports tab capture.",
        );
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 30, width: { ideal: 1280 } },
        audio: true,
      });
      if (!mounted.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      active.current = stream;
      if (video.current) video.current.srcObject = stream;
      setAudio(stream.getAudioTracks().length > 0);
      slots.current = [record(stream)];
      stream
        .getVideoTracks()[0]
        .addEventListener("ended", stop, { once: true });
      setSharing(true);
      clock.current = window.setInterval(() => {
        try {
          const now = performance.now();
          if (
            slots.current.length === 1 &&
            now - slots.current[0].began >= 30_000
          )
            slots.current.push(record(stream));
          slots.current = slots.current.map((r) => {
            if (r.recorder.state === "recording" && now - r.began < 62_000)
              return r;
            if (r.recorder.state !== "inactive") r.recorder.stop();
            return record(stream);
          });
          setAvailable(
            Math.min(
              60,
              Math.floor(
                (now - Math.min(...slots.current.map((r) => r.began))) / 1000,
              ),
            ),
          );
        } catch {
          stop();
          setMessage(
            "Capture stopped. Share the stream tab again to continue.",
          );
        }
      }, 500);
    } catch (error) {
      stop();
      setMessage(
        error instanceof Error ? error.message : "Could not start capture.",
      );
    } finally {
      setStarting(false);
    }
  }
  async function capture(seconds: number) {
    const stream = active.current;
    if (!stream || !slots.current.length || actionPending.current || draft)
      return;
    const oldest = slots.current.reduce((a, b) => (a.began < b.began ? a : b));
    if (
      oldest.recorder.state !== "recording" ||
      performance.now() - oldest.began < seconds * 1000
    )
      return;
    actionPending.current = true;
    setBusy(true);
    setMessage("Preparing replay preview…");
    try {
      // Keep capturing in the other slot while the selected recording is finalized.
      if (slots.current.length === 1) slots.current.push(record(stream));
      slots.current = slots.current.map((r) =>
        r === oldest ? record(stream) : r,
      );
      setAvailable(
        Math.max(
          0,
          Math.floor(
            (performance.now() -
              Math.min(...slots.current.map((r) => r.began))) /
              1000,
          ),
        ),
      );
      oldest.recorder.stop();
      const blob = await oldest.output;
      if (!blob.size || blob.size > 100 * 1024 ** 2)
        throw Error("Replay exceeded the capture limit or was empty.");
      if (!mounted.current) return;
      setDraft({ blob, seconds, url: URL.createObjectURL(blob) });
      setTitle(`Live replay · ${new Date().toLocaleTimeString()}`);
      setMessage("Replay captured. Review it and queue the render when ready.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not capture replay.",
      );
    } finally {
      actionPending.current = false;
      setBusy(false);
    }
  }
  async function saveDraft() {
    if (!draft || actionPending.current) return;
    const { blob, seconds } = draft;
    const name = title.trim() || "Live replay";
    actionPending.current = true;
    setBusy(true);
    setMessage("Uploading replay to the local queue…");
    try {
      const settings = {
        ...defaults,
        ratio,
        resolution: "720",
        mode: "manual",
        captions: false,
      };
      const response = await fetch(
        "/api/import?replay=" +
          seconds +
          "&settings=" +
          encodeURIComponent(JSON.stringify(settings)),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/octet-stream",
            "X-File-Name": encodeURIComponent(name),
          },
          body: blob,
        },
      );
      const result = await response.json();
      if (!response.ok) throw Error(result.error || "Could not save replay.");
      setClips((previous) => [{ id: result.id, title: name }, ...previous]);
      setDraft(null);
      setMessage(
        "Replay queued. Keep watching or open its project to check progress.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not save replay.",
      );
    } finally {
      actionPending.current = false;
      setBusy(false);
    }
  }
  const hotkeys = useRef(capture);
  useEffect(() => {
    hotkeys.current = capture;
  });
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (
        !event.shiftKey ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.repeat ||
        event.defaultPrevented ||
        (event.target instanceof HTMLElement &&
          event.target.closest("input,textarea,select,[contenteditable]"))
      )
        return;
      const seconds =
        event.code === "KeyJ" ? 15 : event.code === "KeyK" ? 30 : 0;
      if (!seconds || !active.current) return;
      event.preventDefault();
      void hotkeys.current(seconds);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const customSeconds = Number(custom);
  return (
    <div className="tool-layout">
      <section>
        <h2>Live capture</h2>
        <p>
          Play the ongoing stream in another tab. Share that tab and enable tab
          audio to capture sound.
        </p>
        <video
          className="source-monitor"
          ref={video}
          autoPlay
          playsInline
          muted
          hidden={!sharing}
        />
        <div className="candidate-actions">
          {sharing ? (
            <button className="tool" onClick={stop}>
              Stop sharing
            </button>
          ) : (
            <button
              className="button primary"
              disabled={starting}
              onClick={start}
            >
              {starting ? "Waiting for tab selection…" : "Share stream tab"}
            </button>
          )}
        </div>
        {sharing && (
          <p>
            {available}s buffered ·{" "}
            {audio ? "Tab audio captured" : "Video only"} · Keep this workspace
            open while capturing.
          </p>
        )}
      </section>
      <section>
        <h2>Save a replay</h2>
        <label className="field">
          Output layout
          <select value={ratio} onChange={(e) => setRatio(e.target.value)}>
            <option value="9:16">Vertical · 9:16</option>
            <option value="16:9">Landscape · 16:9</option>
            <option value="1:1">Square · 1:1</option>
          </select>
        </label>
        <div className="candidate-actions">
          <button
            className="button primary"
            disabled={busy || !!draft || available < 15}
            onClick={() => capture(15)}
          >
            Capture last 15s
          </button>
          <button
            className="button primary"
            disabled={busy || !!draft || available < 30}
            onClick={() => capture(30)}
          >
            Capture last 30s
          </button>
        </div>
        <p className="hint">
          With Studio focused, press Shift+J for 15s or Shift+K for 30s.
        </p>
        <label className="field">
          Custom replay length (seconds)
          <input
            type="number"
            min="5"
            max="30"
            step="1"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
          />
        </label>
        <button
          className="tool"
          disabled={
            busy ||
            !!draft ||
            !Number.isInteger(customSeconds) ||
            customSeconds < 5 ||
            customSeconds > 30 ||
            available < customSeconds
          }
          onClick={() => capture(customSeconds)}
        >
          Capture custom length
        </button>
        {draft && (
          <div className="clip-context">
            <h3>Replay draft</h3>
            <p>
              Source preview. The export uses the final {draft.seconds}s and
              your selected layout.
            </p>
            <video
              className="source-monitor"
              src={draft.url}
              controls
              playsInline
              preload="metadata"
            />
            <label className="field">
              Clip title
              <input
                maxLength={160}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>
            <div className="candidate-actions">
              <button
                className="button primary"
                disabled={busy}
                onClick={saveDraft}
              >
                Queue replay
              </button>
              <button
                className="tool"
                disabled={busy}
                onClick={() => {
                  setDraft(null);
                  setMessage("Draft discarded.");
                }}
              >
                Discard draft
              </button>
            </div>
          </div>
        )}
        <p role="status">{message}</p>
        {clips.map((clip) => (
          <button
            className="event-row"
            key={clip.id}
            onClick={() => open(clip.id)}
          >
            {clip.title}
            <small>
              {projects.find((p) => p.id === clip.id)?.detail ||
                "Waiting for render status"}
            </small>
          </button>
        ))}
      </section>
    </div>
  );
}
