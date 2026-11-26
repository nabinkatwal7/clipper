"use client";
import { useState } from "react";
import { Wrench, FileSearch, RefreshCw } from "lucide-react";
import type { Project } from "@/lib/types";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";

type Profile = {
  container: "mp4" | "mkv" | "webm" | "mp3" | "wav" | "aac";
  videoCodec?: "copy" | "libx264" | "libvpx-vp9";
  audioCodec?: "copy" | "aac" | "libmp3lame" | "pcm_s16le" | "libopus";
  crf?: number;
  scale?: string;
};

export function MediaToolboxPanel({ projects }: { projects: Project[] }) {
  const ready = projects.filter((p) => p.duration > 0);
  const [projectId, setProjectId] = useState(ready[0]?.id || "");
  const [container, setContainer] = useState<Profile["container"]>("mp4");
  const [videoCodec, setVideoCodec] =
    useState<NonNullable<Profile["videoCodec"]>>("libx264");
  const [audioCodec, setAudioCodec] =
    useState<NonNullable<Profile["audioCodec"]>>("aac");
  const [crf, setCrf] = useState("23");
  const [scale, setScale] = useState("");
  const [report, setReport] = useState<Record<string, unknown> | null>(null);
  const [result, setResult] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const audioOnly = ["mp3", "wav", "aac"].includes(container);

  async function inspect() {
    if (!projectId) return;
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/media-toolbox?project=" + projectId);
      const data = await r.json();
      if (!r.ok) throw Error(data.error || "Inspect failed");
      setReport(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Inspect failed");
    } finally {
      setBusy(false);
    }
  }

  async function convert() {
    if (!projectId) return;
    setBusy(true);
    setError("");
    setResult("");
    const profile: Profile = {
      container,
      videoCodec: audioOnly ? undefined : videoCodec,
      audioCodec,
      crf: audioOnly || videoCodec === "copy" ? undefined : Number(crf),
      scale: scale || undefined,
    };
    try {
      const r = await fetch("/api/media-toolbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project: projectId, profile }),
      });
      const data = await r.json();
      if (!r.ok) throw Error(data.error || "Convert failed");
      setResult(
        `Wrote ${data.container} · ${(data.bytes / 1024 / 1024).toFixed(1)} MB`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Convert failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="media-toolbox">
      <header className="panel-head">
        <div>
          <h2>Media toolbox</h2>
          <p>
            Inspect streams with FFprobe and convert with validated FFmpeg
            profiles. Lossless remux uses stream copy when compatible.
          </p>
        </div>
        <Badge variant="outline">
          <Wrench size={12} /> Local
        </Badge>
      </header>

      <label>
        Source project
        <select
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
        >
          {ready.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </select>
      </label>

      <div className="bar-tools">
        <Button size="sm" variant="outline" disabled={busy || !projectId} onClick={() => void inspect()}>
          <FileSearch size={14} /> Inspect
        </Button>
      </div>

      {report && (
        <pre className="inspect-report">
          {JSON.stringify(
            {
              container: report.container,
              duration: report.duration,
              size: report.size,
              video: report.video,
              audio: report.audio,
              subtitles: report.subtitles,
              chapters: report.chapters,
            },
            null,
            2,
          )}
        </pre>
      )}

      <fieldset>
        <legend>Convert</legend>
        <div className="reel-grid">
          <label>
            Container
            <select
              value={container}
              onChange={(e) =>
                setContainer(e.target.value as Profile["container"])
              }
            >
              <option value="mp4">MP4</option>
              <option value="mkv">MKV</option>
              <option value="webm">WebM</option>
              <option value="mp3">MP3</option>
              <option value="wav">WAV</option>
              <option value="aac">AAC</option>
            </select>
          </label>
          {!audioOnly && (
            <label>
              Video codec
              <select
                value={videoCodec}
                onChange={(e) =>
                  setVideoCodec(e.target.value as typeof videoCodec)
                }
              >
                <option value="copy">Copy (lossless remux)</option>
                <option value="libx264">H.264</option>
                <option value="libvpx-vp9">VP9</option>
              </select>
            </label>
          )}
          <label>
            Audio codec
            <select
              value={audioCodec}
              onChange={(e) =>
                setAudioCodec(e.target.value as typeof audioCodec)
              }
            >
              <option value="copy">Copy</option>
              <option value="aac">AAC</option>
              <option value="libmp3lame">MP3</option>
              <option value="pcm_s16le">PCM</option>
              <option value="libopus">Opus</option>
            </select>
          </label>
          {!audioOnly && videoCodec !== "copy" && (
            <label>
              CRF
              <Input value={crf} onChange={(e) => setCrf(e.target.value)} />
            </label>
          )}
          {!audioOnly && (
            <label>
              Scale (optional)
              <Input
                value={scale}
                onChange={(e) => setScale(e.target.value)}
                placeholder="1280:-2"
              />
            </label>
          )}
        </div>
        <Button disabled={busy || !projectId} onClick={() => void convert()}>
          <RefreshCw size={14} /> {busy ? "Working…" : "Convert"}
        </Button>
      </fieldset>

      {error && <p className="error">{error}</p>}
      {result && <p className="notice">{result}</p>}
    </div>
  );
}
