"use client";
import { useState, useEffect, useRef } from "react";
import { duration } from "./studio-media";
export function SourceInspection({ url }: { url: string }) {
  const [data, setData] = useState<{
      title: string;
      thumbnail?: string;
      channel: string;
      platform: string;
      duration: number;
      quality: number;
      subtitles: boolean;
      live: boolean;
    } | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const ctrl = useRef<AbortController | null>(null);
  useEffect(() => () => ctrl.current?.abort(), []);
  async function inspect() {
    setBusy(true);
    setError("");
    ctrl.current = new AbortController();
    try {
      const r = await fetch("/api/inspect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
        signal: ctrl.current.signal,
      });
      const json = await r.json();
      if (!r.ok) throw Error(json.error);
      setData(json);
    } catch (e) {
      if (!ctrl.current.signal.aborted) setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="source-inspection">
      {data ? (
        <>
          {data.thumbnail && (
            <img
              loading="lazy"
              referrerPolicy="no-referrer"
              alt=""
              src={data.thumbnail}
            />
          )}
          <strong>{data.title}</strong>
          <small>
            {[
              data.channel,
              data.platform,
              duration(data.duration),
              data.quality ? data.quality + "p available" : "",
              data.subtitles ? "Subtitles available" : "No source subtitles",
              data.live ? "Live now" : "",
            ]
              .filter(Boolean)
              .join(" · ")}
          </small>
        </>
      ) : (
        <button
          type="button"
          className="inline-link"
          disabled={busy}
          onClick={inspect}
        >
          {busy ? "Checking source…" : "Check source details"}
        </button>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
