"use client";
import { useState, useEffect } from "react";
import type { Settings } from "@/lib/types";
export function RenderPreview({
  settings: s,
  project,
  clip,
  start,
  end,
  compare = false,
}: {
  settings: Settings;
  project: string;
  clip: string;
  start: number;
  end: number;
  compare?: boolean;
}) {
  const [busy, setBusy] = useState(false),
    [url, setUrl] = useState(""),
    [error, setError] = useState("");
  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
    },
    [url],
  );
  async function preview(bypass: boolean) {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/render-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project,
          clip,
          start,
          end,
          settings: bypass ? { ...s, grade: undefined, mix: undefined } : s,
        }),
      });
      if (!r.ok) throw Error((await r.json()).error);
      setUrl(URL.createObjectURL(await r.blob()));
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
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
          {busy ? "Rendering…" : "Render 3-second preview"}
        </button>
      </div>
      {error && <p role="alert">{error}</p>}
      {url && <video className="source-monitor" controls autoPlay src={url} />}
    </>
  );
}
