"use client";
import { useRef, useState } from "react";
import {
  Upload,
  Link2,
  Film,
  X,
  Sparkles,
  LoaderCircle,
  ChevronDown,
  Check,
} from "lucide-react";
import { Modal } from "./modal";
import { BasicSettings, AdvancedSettings } from "./clip-settings";
import { Button } from "./ui/button";
import { defaults, type Project } from "@/lib/types";
export function CreateClips({
  reuse,
  onClose,
  onCreated,
}: {
  reuse?: Project;
  onClose: () => void;
  onCreated: (id: string) => Promise<void>;
}) {
  const [tab, setTab] = useState("link"),
    [url, setUrl] = useState(""),
    [file, setFile] = useState<File | null>(null),
    [settings, setSettings] = useState(reuse?.settings ?? defaults),
    [working, setWorking] = useState(false),
    [uploadProgress, setUploadProgress] = useState<number | null>(null),
    [error, setError] = useState(""),
    [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null),
    request = useRef<XMLHttpRequest | null>(null);
  function choose(file: File | undefined) {
    if (!file) return;
    if (
      !file.type.startsWith("video/") &&
      !/\.(mp4|mov|mkv|webm|avi|m4v|mpeg|mpg|ts|ogv)$/i.test(file.name)
    ) {
      setError("Choose a video file, such as MP4, MOV, or WebM.");
      return;
    }
    if (file.size > 5 * 1024 ** 3) {
      setError("Choose a video smaller than 5 GB.");
      return;
    }
    if (!file.size) {
      setError("This file is empty. Choose another video.");
      return;
    }
    setFile(file);
    setError("");
  }
  async function generate() {
    setError("");
    if (!reuse && tab === "link") {
      try {
        const parsed = new URL(url);
        if (!["https:", "http:"].includes(parsed.protocol)) throw Error();
      } catch {
        setError("Paste a complete video link, starting with https://.");
        return;
      }
    }
    setWorking(true);
    try {
      let id = reuse?.id;
      if (reuse) {
        const response = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ project: reuse.id, settings }),
        });
        const data = await response.json();
        if (!response.ok) throw Error(data.error);
      } else if (tab === "upload" && file) {
        const project: Project = await new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          request.current = xhr;
          xhr.open(
            "POST",
            "/api/import?settings=" +
              encodeURIComponent(JSON.stringify(settings)),
          );
          xhr.setRequestHeader("Content-Type", "application/octet-stream");
          xhr.setRequestHeader("X-File-Name", encodeURIComponent(file.name));
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable)
              setUploadProgress(Math.floor((e.loaded / e.total) * 100));
          };
          xhr.onload = () => {
            try {
              const data = JSON.parse(xhr.responseText);
              if (xhr.status >= 200 && xhr.status < 300) resolve(data);
              else reject(Error(data.error || "Upload failed."));
            } catch {
              reject(
                Error("Could not read the upload response. Please retry."),
              );
            }
          };
          xhr.onerror = () =>
            reject(
              Error("Upload interrupted. Check the connection and retry."),
            );
          xhr.onabort = () => reject(Error("Upload cancelled."));
          xhr.send(file);
        });
        id = project.id;
      } else {
        const response = await fetch("/api/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: url.trim(), settings }),
        });
        const data = await response.json();
        if (!response.ok) throw Error(data.error);
        id = data.id;
      }
      await onCreated(id!);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setWorking(false);
      request.current = null;
      setUploadProgress(null);
    }
  }
  return (
    <Modal
      title={reuse ? "Create more clips" : "Create clips"}
      description={
        reuse
          ? reuse.title
          : "Add a video. Choose the moments you want to make."
      }
      onClose={onClose}
      busy={working}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void generate();
        }}
      >
        <div className="composer-body">
          {!reuse && (
            <>
              <div
                className="segmented source-tabs"
                role="tablist"
                aria-label="Video source"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === "link"}
                  disabled={working}
                  className={tab === "link" ? "selected" : ""}
                  onClick={() => setTab("link")}
                >
                  <Link2 size={16} />
                  Video link
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === "upload"}
                  disabled={working}
                  className={tab === "upload" ? "selected" : ""}
                  onClick={() => setTab("upload")}
                >
                  <Upload size={16} />
                  Upload file
                </button>
              </div>
              {tab === "link" ? (
                <div>
                  <label className="field source-url">
                    <span>Video link</span>
                    <input
                      autoFocus
                      type="url"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder="Paste your video link here"
                      aria-label="Video link"
                      required
                      disabled={working}
                    />
                  </label>
                  <p className="hint">
                    YouTube, Twitch, Kick, or a direct video link.
                  </p>
                </div>
              ) : (
                <>
                  <input
                    ref={input}
                    type="file"
                    hidden
                    accept="video/*,.mkv"
                    onChange={(e) => {
                      choose(e.target.files?.[0]);
                      e.target.value = "";
                    }}
                  />
                  {file ? (
                    <div className="selected-file">
                      <span className="file-symbol">
                        <Film size={23} />
                      </span>
                      <div>
                        <strong>{file.name}</strong>
                        <span>{(file.size / 1024 ** 2).toFixed(1)} MB</span>
                      </div>
                      <button
                        type="button"
                        className="icon-button"
                        disabled={working}
                        aria-label="Remove selected file"
                        onClick={() => setFile(null)}
                      >
                        <X size={18} />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className={`upload-zone ${dragging ? "dragging" : ""}`}
                      onClick={() => input.current?.click()}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDragging(true);
                      }}
                      onDragLeave={() => setDragging(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setDragging(false);
                        choose(e.dataTransfer.files[0]);
                      }}
                    >
                      <span>
                        <Upload size={24} />
                      </span>
                      <strong>Drop your video here</strong>
                      <span>or click to browse · up to 5 GB</span>
                    </button>
                  )}
                </>
              )}
            </>
          )}
          <fieldset className="composer-options" disabled={working}>
            <h3>Make it yours</h3>
            {settings.mode === "manual" ? (
              <p className="hint">One clip from your selected time range.</p>
            ) : (
              <BasicSettings value={settings} onChange={setSettings} />
            )}
            <div className="preset-summary">
              <Check size={14} />
              {settings.ratio === "9:16" ? "Portrait" : settings.ratio} ·{" "}
              {settings.resolution}p · Subtitles{" "}
              {settings.captions ? "on" : "off"}
            </div>
            <details className="advanced-disclosure">
              <summary>
                More options
                <ChevronDown size={16} />
              </summary>
              <AdvancedSettings value={settings} onChange={setSettings} />
            </details>
          </fieldset>
          {error && (
            <p className="inline-error" role="alert">
              {error}
            </p>
          )}
          {working && uploadProgress !== null && (
            <div className="upload-status">
              <div>
                <span>
                  {uploadProgress === 100
                    ? "Finishing upload…"
                    : "Uploading video"}
                </span>
                <strong>{uploadProgress}%</strong>
              </div>
              <progress max={100} value={uploadProgress} />
              <button type="button" onClick={() => request.current?.abort()}>
                Cancel upload
              </button>
            </div>
          )}
        </div>
        <footer className="modal-footer">
          <span className="privacy-note">
            Your video stays on this computer.
          </span>
          <Button
            type="submit"
            disabled={
              working || (!reuse && (tab === "link" ? !url.trim() : !file))
            }
          >
            {working ? (
              <LoaderCircle size={17} className="spin" />
            ) : (
              <Sparkles size={17} />
            )}{" "}
            {working
              ? uploadProgress !== null
                ? "Uploading…"
                : "Starting…"
              : "Create clips"}
          </Button>
        </footer>
      </form>
    </Modal>
  );
}
