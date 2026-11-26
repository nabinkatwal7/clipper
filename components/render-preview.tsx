"use client";
import { useState, useEffect, useRef } from "react";
import type { Settings } from "@/lib/types";
export function RenderPreview({
  settings: s,
  project,
  clip,
  start,
  end,
  playhead,
  compare = false,
}: {
  settings: Settings;
  project: string;
  clip: string;
  start: number;
  end: number;
  playhead: number;
  compare?: boolean;
}) {
  const [busy, setBusy] = useState(false),
    [url, setUrl] = useState(""),
    [error, setError] = useState("");
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => active.current?.abort(), []);
  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
    },
    [url],
  );
  async function preview(bypass: boolean) {
    if (active.current) return;
    const controller = new AbortController();
    active.current = controller;
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/render-preview", {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project,
          clip,
          start,
          end,
          playhead,
          settings: bypass ? { ...s, grade: undefined, mix: undefined } : s,
        }),
      });
      if (!r.ok) throw Error((await r.json()).error);
      const blob = await r.blob();
      if (!controller.signal.aborted) setUrl(URL.createObjectURL(blob));
    } catch (e) {
      if (!controller.signal.aborted) setError(String(e));
    } finally {
      if (active.current === controller) {
        active.current = null;
        setBusy(false);
      }
    }
  }
  return (
    <>
      <div className="candidate-actions">
        {compare && (
          <button
            disabled={busy}
            className="tool"
            onClick={() => preview(true)}
          >
            Preview original
          </button>
        )}
        <button
          disabled={busy}
          className="button primary"
          onClick={() => preview(false)}
        >
          {busy ? "Rendering…" : "Preview from playhead"}
        </button>
        {busy && (
          <button className="tool" onClick={() => active.current?.abort()}>
            Cancel preview
          </button>
        )}
      </div>
      {error && <p role="alert">{error}</p>}
      {url && <video className="source-monitor" controls autoPlay src={url} />}
    </>
  );
}
