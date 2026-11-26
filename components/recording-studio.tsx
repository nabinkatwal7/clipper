"use client";
import { useEffect, useRef, useState } from "react";
import {
  Circle,
  Pause,
  Play,
  Square,
  Bookmark,
  Video,
  Rewind,
} from "lucide-react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";

type Scene = {
  id: string;
  name: string;
  layout: string;
  includeWebcam: boolean;
  includeMic: boolean;
  includeSystemAudio: boolean;
};

type TrackRole = "composite" | "screen" | "webcam" | "microphone" | "system";

type Session = {
  version: 1;
  id: string;
  startedAt: string;
  endedAt?: string;
  sceneId: string;
  assetId?: string;
  duration?: number;
  bookmarks: { id: string; at: number; label: string }[];
  separateTracks: boolean;
  tracks?: { role: TrackRole; assetId: string }[];
};

type SideRec = {
  role: Exclude<TrackRole, "composite">;
  recorder: MediaRecorder;
  chunks: Blob[];
  done: Promise<Blob>;
};

type BufferSlot = {
  recorder: MediaRecorder;
  began: number;
  output: Promise<Blob>;
};

const BUFFER_OPTIONS = [15, 30, 60, 90] as const;

function startSlot(stream: MediaStream): BufferSlot {
  const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
    ? "video/webm;codecs=vp9,opus"
    : "video/webm";
  const recorder = new MediaRecorder(stream, { mimeType });
  const chunks: Blob[] = [];
  const output = new Promise<Blob>((resolve, reject) => {
    recorder.ondataavailable = ({ data }) => {
      if (data.size) chunks.push(data);
    };
    recorder.onstop = () =>
      resolve(new Blob(chunks, { type: recorder.mimeType || "video/webm" }));
    recorder.onerror = () => reject(Error("Replay buffer stopped"));
  });
  void output.catch(() => {});
  recorder.start(1000);
  return { recorder, began: performance.now(), output };
}

export function RecordingStudio() {
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [sceneId, setSceneId] = useState("");
  const [recording, setRecording] = useState(false);
  const [paused, setPaused] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [quality, setQuality] = useState<"720" | "1080">("1080");
  const [bufferOn, setBufferOn] = useState(true);
  const [bufferSec, setBufferSec] =
    useState<(typeof BUFFER_OPTIONS)[number]>(30);
  const [bufferReady, setBufferReady] = useState(0);
  const [savingReplay, setSavingReplay] = useState(false);
  const [separateTracks, setSeparateTracks] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const streams = useRef<MediaStream[]>([]);
  const mixedRef = useRef<MediaStream | null>(null);
  const sideRecs = useRef<SideRec[]>([]);
  const slots = useRef<BufferSlot[]>([]);
  const started = useRef(0);
  const tick = useRef<number | null>(null);
  const bookmarks = useRef<{ id: string; at: number; label: string }[]>([]);
  const sessionId = useRef(crypto.randomUUID());
  const replayBusy = useRef(false);

  function makeRecorder(stream: MediaStream, audioOnly = false): {
    recorder: MediaRecorder;
    chunks: Blob[];
    done: Promise<Blob>;
  } {
    const mimeType = audioOnly
      ? MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm"
      : MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
        ? "video/webm;codecs=vp9,opus"
        : "video/webm";
    const rec = new MediaRecorder(stream, { mimeType });
    const parts: Blob[] = [];
    const done = new Promise<Blob>((resolve, reject) => {
      rec.ondataavailable = (e) => {
        if (e.data.size) parts.push(e.data);
      };
      rec.onstop = () =>
        resolve(new Blob(parts, { type: rec.mimeType || mimeType }));
      rec.onerror = () => reject(Error("Track recorder failed"));
    });
    void done.catch(() => {});
    return { recorder: rec, chunks: parts, done };
  }

  async function uploadBlob(blob: Blob, name: string) {
    const r = await fetch("/api/assets", {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
        "x-file-name": encodeURIComponent(name),
      },
      body: blob,
    });
    const asset = await r.json();
    if (!r.ok) throw Error(asset.error || "Upload failed");
    return asset as { id: string };
  }

  useEffect(() => {
    fetch("/api/recording-meta")
      .then((r) => r.json())
      .then((rows: Scene[]) => {
        setScenes(rows);
        setSceneId(rows[0]?.id || "");
      })
      .catch(() => setError("Could not load scenes"));
    return () => stopTracks();
  }, []);

  function stopSlots() {
    for (const s of slots.current)
      if (s.recorder.state !== "inactive") s.recorder.stop();
    slots.current = [];
    setBufferReady(0);
  }

  function stopTracks() {
    stopSlots();
    for (const s of streams.current) s.getTracks().forEach((t) => t.stop());
    streams.current = [];
    mixedRef.current = null;
    if (tick.current) window.clearInterval(tick.current);
  }

  function rotateBuffer(stream: MediaStream) {
    if (!bufferOn) return;
    if (!slots.current.length) {
      slots.current = [startSlot(stream)];
      return;
    }
    const oldest = slots.current[0];
    const age = (performance.now() - oldest.began) / 1000;
    if (age < bufferSec) {
      setBufferReady(Math.min(bufferSec, Math.floor(age)));
      return;
    }
    if (slots.current.length === 1) slots.current.push(startSlot(stream));
    const done = slots.current.shift()!;
    if (done.recorder.state !== "inactive") done.recorder.stop();
    slots.current.push(startSlot(stream));
    setBufferReady(bufferSec);
  }

  async function start() {
    setError("");
    setMsg("");
    const scene = scenes.find((s) => s.id === sceneId);
    if (!scene) return;
    try {
      const display = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: quality === "1080" ? 1920 : 1280,
          height: quality === "1080" ? 1080 : 720,
          frameRate: 30,
        },
        audio: scene.includeSystemAudio,
      });
      streams.current.push(display);
      let mic: MediaStream | null = null;
      if (scene.includeMic) {
        mic = await navigator.mediaDevices.getUserMedia({ audio: true });
        streams.current.push(mic);
      }
      if (scene.includeWebcam) {
        const cam = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 360 },
          audio: false,
        });
        streams.current.push(cam);
      }

      const mixed = new MediaStream([
        ...display.getVideoTracks(),
        ...display.getAudioTracks(),
        ...(mic ? mic.getAudioTracks() : []),
      ]);
      mixedRef.current = mixed;
      if (videoRef.current) {
        videoRef.current.srcObject = display;
        await videoRef.current.play().catch(() => {});
      }

      chunks.current = [];
      bookmarks.current = [];
      sideRecs.current = [];
      sessionId.current = crypto.randomUUID();
      const rec = makeRecorder(mixed).recorder;
      rec.ondataavailable = (e) => {
        if (e.data.size) chunks.current.push(e.data);
      };
      rec.onstop = () => void finish();
      recorder.current = rec;
      rec.start(1000);

      if (separateTracks) {
        const screenOnly = new MediaStream(display.getVideoTracks());
        const screenRec = makeRecorder(screenOnly);
        screenRec.recorder.start(1000);
        sideRecs.current.push({
          role: "screen",
          recorder: screenRec.recorder,
          chunks: screenRec.chunks,
          done: screenRec.done,
        });
        if (scene.includeSystemAudio && display.getAudioTracks().length) {
          const sys = new MediaStream(display.getAudioTracks());
          const sysRec = makeRecorder(sys, true);
          sysRec.recorder.start(1000);
          sideRecs.current.push({
            role: "system",
            recorder: sysRec.recorder,
            chunks: sysRec.chunks,
            done: sysRec.done,
          });
        }
        if (mic) {
          const micRec = makeRecorder(mic, true);
          micRec.recorder.start(1000);
          sideRecs.current.push({
            role: "microphone",
            recorder: micRec.recorder,
            chunks: micRec.chunks,
            done: micRec.done,
          });
        }
        const camStream = streams.current.find(
          (s) =>
            s.getVideoTracks().length &&
            s !== display &&
            !s.getAudioTracks().length,
        );
        if (camStream) {
          const camRec = makeRecorder(camStream);
          camRec.recorder.start(1000);
          sideRecs.current.push({
            role: "webcam",
            recorder: camRec.recorder,
            chunks: camRec.chunks,
            done: camRec.done,
          });
        }
      }

      if (bufferOn) {
        stopSlots();
        slots.current = [startSlot(mixed)];
      }
      started.current = Date.now();
      setElapsed(0);
      setRecording(true);
      setPaused(false);
      tick.current = window.setInterval(() => {
        setElapsed(Math.floor((Date.now() - started.current) / 1000));
        if (mixedRef.current) rotateBuffer(mixedRef.current);
      }, 250);
    } catch (e) {
      stopTracks();
      setError(
        e instanceof Error
          ? e.message
          : "Permission denied or capture unavailable",
      );
    }
  }

  function pause() {
    const rec = recorder.current;
    if (!rec) return;
    if (rec.state === "recording") {
      rec.pause();
      setPaused(true);
      for (const s of slots.current)
        if (s.recorder.state === "recording") s.recorder.pause();
      for (const s of sideRecs.current)
        if (s.recorder.state === "recording") s.recorder.pause();
    } else if (rec.state === "paused") {
      rec.resume();
      setPaused(false);
      for (const s of slots.current)
        if (s.recorder.state === "paused") s.recorder.resume();
      for (const s of sideRecs.current)
        if (s.recorder.state === "paused") s.recorder.resume();
    }
  }

  function stop() {
    for (const s of sideRecs.current)
      if (s.recorder.state !== "inactive") s.recorder.stop();
    recorder.current?.stop();
    setRecording(false);
    setPaused(false);
    if (tick.current) window.clearInterval(tick.current);
  }

  async function finish() {
    stopSlots();
    const side = [...sideRecs.current];
    sideRecs.current = [];
    stopTracks();
    if (videoRef.current) videoRef.current.srcObject = null;
    const blob = new Blob(chunks.current, { type: "video/webm" });
    if (!blob.size) {
      setError("Recording produced no data");
      return;
    }
    try {
      const stamp = new Date().toISOString().slice(0, 19);
      const asset = await uploadBlob(blob, `recording-${stamp}.webm`);
      const tracks: { role: TrackRole; assetId: string }[] = [
        { role: "composite", assetId: asset.id },
      ];
      for (const s of side) {
        const part = await s.done;
        if (!part.size) continue;
        const ext = s.role === "microphone" || s.role === "system" ? "webm" : "webm";
        const uploaded = await uploadBlob(
          part,
          `recording-${s.role}-${stamp}.${ext}`,
        );
        tracks.push({ role: s.role, assetId: uploaded.id });
      }
      const durationSec = Math.max(
        0,
        Math.floor((Date.now() - started.current) / 1000),
      );
      const session: Session = {
        version: 1,
        id: sessionId.current,
        startedAt: new Date(started.current).toISOString(),
        endedAt: new Date().toISOString(),
        sceneId,
        assetId: asset.id,
        duration: durationSec,
        bookmarks: bookmarks.current,
        separateTracks: tracks.length > 1,
        tracks,
      };
      await fetch("/api/recording-meta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ op: "session", session }),
      });
      setMsg(
        tracks.length > 1
          ? `Saved composite + ${tracks.length - 1} separate track asset(s).`
          : `Saved recording as asset ${String(asset.id).slice(0, 8)}…`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save recording");
    }
  }

  function mark() {
    bookmarks.current.push({
      id: crypto.randomUUID(),
      at: elapsed,
      label: `Mark ${bookmarks.current.length + 1}`,
    });
    setMsg(`Bookmark at ${elapsed}s`);
  }

  async function saveReplay() {
    if (!bufferOn || replayBusy.current || !slots.current.length) return;
    const oldest = slots.current[0];
    const age = (performance.now() - oldest.began) / 1000;
    if (age < Math.min(5, bufferSec)) {
      setError(`Buffer needs at least a few seconds (have ${Math.floor(age)}s).`);
      return;
    }
    replayBusy.current = true;
    setSavingReplay(true);
    setError("");
    try {
      const stream = mixedRef.current;
      if (slots.current.length === 1 && stream)
        slots.current.push(startSlot(stream));
      slots.current = slots.current.filter((s) => s !== oldest);
      if (stream) slots.current.push(startSlot(stream));
      if (oldest.recorder.state !== "inactive") oldest.recorder.stop();
      const blob = await oldest.output;
      if (!blob.size || blob.size > 200 * 1024 ** 2)
        throw Error("Replay empty or exceeded 200 MB bound");
      const seconds = Math.min(bufferSec, Math.floor(age));
      const r = await fetch("/api/assets", {
        method: "POST",
        headers: {
          "Content-Type": "application/octet-stream",
          "x-file-name": encodeURIComponent(
            `replay-last-${seconds}s-${Date.now()}.webm`,
          ),
        },
        body: blob,
      });
      const asset = await r.json();
      if (!r.ok) throw Error(asset.error || "Replay upload failed");
      bookmarks.current.push({
        id: crypto.randomUUID(),
        at: Math.max(0, elapsed - seconds),
        label: `Replay −${seconds}s`,
      });
      setMsg(
        `Saved last ~${seconds}s replay as asset ${String(asset.id).slice(0, 8)}…`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save replay");
    } finally {
      replayBusy.current = false;
      setSavingReplay(false);
    }
  }

  const scene = scenes.find((s) => s.id === sceneId);

  return (
    <div className="recording-studio">
      <header className="panel-head">
        <div>
          <h2>Recording Studio</h2>
          <p>
            Explicit browser capture for screen, window, tab, webcam and mic.
            Capture never starts hidden.
          </p>
        </div>
        <Badge variant={recording ? "destructive" : "outline"}>
          <Video size={12} /> {recording ? (paused ? "Paused" : "REC") : "Idle"}
        </Badge>
      </header>

      <div className="reel-grid">
        <label>
          Scene
          <select
            value={sceneId}
            disabled={recording}
            onChange={(e) => setSceneId(e.target.value)}
          >
            {scenes.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.layout})
              </option>
            ))}
          </select>
        </label>
        <label>
          Quality
          <select
            value={quality}
            disabled={recording}
            onChange={(e) => setQuality(e.target.value as "720" | "1080")}
          >
            <option value="720">720p</option>
            <option value="1080">1080p</option>
          </select>
        </label>
        <label>
          Replay buffer
          <select
            value={bufferOn ? String(bufferSec) : "off"}
            disabled={recording}
            onChange={(e) => {
              if (e.target.value === "off") setBufferOn(false);
              else {
                setBufferOn(true);
                setBufferSec(Number(e.target.value) as (typeof BUFFER_OPTIONS)[number]);
              }
            }}
          >
            <option value="off">Off</option>
            {BUFFER_OPTIONS.map((n) => (
              <option key={n} value={n}>
                Last {n}s
              </option>
            ))}
          </select>
        </label>
        <label>
          Separate tracks
          <select
            value={separateTracks ? "on" : "off"}
            disabled={recording}
            onChange={(e) => setSeparateTracks(e.target.value === "on")}
          >
            <option value="off">Composite only</option>
            <option value="on">Screen / mic / cam split</option>
          </select>
        </label>
      </div>

      {scene && (
        <p className="muted">
          Mic {scene.includeMic ? "on" : "off"} · Webcam{" "}
          {scene.includeWebcam ? "on" : "off"} · System audio{" "}
          {scene.includeSystemAudio ? "on" : "off"}
          {bufferOn && recording
            ? ` · Buffer ready ~${bufferReady}s / ${bufferSec}s`
            : ""}
        </p>
      )}

      <div className="record-preview">
        <video ref={videoRef} muted playsInline />
        {recording && (
          <span className="rec-timer" aria-live="polite">
            {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}
          </span>
        )}
      </div>

      <div className="bar-tools">
        {!recording ? (
          <Button onClick={() => void start()}>
            <Circle size={14} /> Start recording
          </Button>
        ) : (
          <>
            <Button variant="secondary" onClick={pause}>
              {paused ? <Play size={14} /> : <Pause size={14} />}{" "}
              {paused ? "Resume" : "Pause"}
            </Button>
            <Button variant="destructive" onClick={stop}>
              <Square size={14} /> Stop
            </Button>
            <Button variant="outline" onClick={mark}>
              <Bookmark size={14} /> Bookmark
            </Button>
            {bufferOn && (
              <Button
                variant="secondary"
                disabled={savingReplay || bufferReady < 5}
                onClick={() => void saveReplay()}
              >
                <Rewind size={14} /> Save last {bufferSec}s
              </Button>
            )}
          </>
        )}
      </div>

      {error && <p className="error">{error}</p>}
      {msg && <p className="notice">{msg}</p>}
      <p className="muted">
        Full takes and buffer replays upload into Assets. Instant replay scrub
        opens saved sessions with bookmarks. Buffer uses overlapping segments so
        memory stays bounded.
      </p>
    </div>
  );
}
