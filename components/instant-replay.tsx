"use client";
import { useEffect, useRef, useState } from "react";
import { Bookmark, Clapperboard, Rewind, Scissors } from "lucide-react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Input } from "./ui/input";

type Session = {
  id: string;
  startedAt: string;
  endedAt?: string;
  sceneId: string;
  assetId?: string;
  duration?: number;
  bookmarks: { id: string; at: number; label: string }[];
};

const DURATIONS = [15, 30, 60, 90, 180, 300] as const;

export function InstantReplayPanel() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionId, setSessionId] = useState("");
  const [before, setBefore] = useState(10);
  const [after, setAfter] = useState(5);
  const [rate, setRate] = useState(1);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const video = useRef<HTMLVideoElement>(null);

  const session = sessions.find((s) => s.id === sessionId) || sessions[0];

  useEffect(() => {
    fetch("/api/recording-meta?kind=sessions")
      .then((r) => r.json())
      .then((rows: Session[]) => {
        const withAsset = (Array.isArray(rows) ? rows : []).filter(
          (s) => s.assetId,
        );
        setSessions(withAsset);
        setSessionId(withAsset[0]?.id || "");
      })
      .catch(() => setError("Could not load recording sessions"));
  }, []);

  useEffect(() => {
    if (video.current) video.current.playbackRate = rate;
  }, [rate, session?.assetId]);

  function seek(at: number) {
    if (!video.current) return;
    video.current.currentTime = Math.max(0, at);
    void video.current.play().catch(() => {});
  }

  async function extractAround(at: number) {
    if (!session?.assetId) return;
    setBusy(true);
    setError("");
    setMsg("");
    try {
      const duration =
        session.duration ||
        video.current?.duration ||
        Math.max(at + after, before + after);
      const win = await fetch("/api/instant-replay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          op: "window",
          at,
          before,
          after,
          duration,
        }),
      }).then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw Error(d.error || "Invalid window");
        return d as { start: number; end: number };
      });
      const asset = await fetch("/api/instant-replay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          op: "extract",
          assetId: session.assetId,
          start: win.start,
          end: win.end,
        }),
      }).then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw Error(d.error || "Extract failed");
        return d as { id: string; name: string };
      });
      setMsg(
        `Saved ${asset.name} (${win.start.toFixed(1)}–${win.end.toFixed(1)}s). Stream-copy — not frame-accurate.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Extract failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="instant-replay">
      <header className="panel-head">
        <div>
          <h2>Instant replay</h2>
          <p>
            Scrub recording-session bookmarks and extract bounded windows into
            the asset library. Rolling capture while recording lives in Recording
            Studio.
          </p>
        </div>
        <Badge variant="outline">
          <Rewind size={12} /> Bookmark scrub
        </Badge>
      </header>

      {!sessions.length ? (
        <p className="empty">
          No saved recording sessions with assets yet. Record in Recording Studio
          first (enable the replay buffer to capture last{" "}
          {DURATIONS.filter((d) => d <= 90).join("/")}s while live).
        </p>
      ) : (
        <>
          <div className="reel-grid">
            <label>
              Session
              <select
                value={session?.id}
                onChange={(e) => setSessionId(e.target.value)}
              >
                {sessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {new Date(s.startedAt).toLocaleString()} ·{" "}
                    {s.duration ?? "?"}s · {s.bookmarks.length} marks
                  </option>
                ))}
              </select>
            </label>
            <label>
              Pad before (s)
              <Input
                type="number"
                min={0}
                max={180}
                value={before}
                onChange={(e) => setBefore(Number(e.target.value) || 0)}
              />
            </label>
            <label>
              Pad after (s)
              <Input
                type="number"
                min={0}
                max={120}
                value={after}
                onChange={(e) => setAfter(Number(e.target.value) || 0)}
              />
            </label>
            <label>
              Playback
              <select
                value={rate}
                onChange={(e) => setRate(Number(e.target.value))}
              >
                <option value={0.5}>0.5×</option>
                <option value={1}>1×</option>
                <option value={1.5}>1.5×</option>
                <option value={2}>2×</option>
              </select>
            </label>
          </div>

          {session?.assetId && (
            <div className="record-preview">
              <video
                ref={video}
                controls
                playsInline
                src={"/api/assets?id=" + session.assetId}
              />
            </div>
          )}

          <div className="replay-bookmarks">
            <h3>
              <Bookmark size={14} /> Bookmarks
            </h3>
            {!session?.bookmarks.length ? (
              <p className="muted">
                No bookmarks on this session. Jump with the player, then extract
                around the playhead.
              </p>
            ) : (
              <ul>
                {session.bookmarks.map((b) => (
                  <li key={b.id}>
                    <button type="button" onClick={() => seek(b.at)}>
                      {b.label} · {b.at}s
                    </button>
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={() => void extractAround(b.at)}
                    >
                      <Scissors size={12} /> Extract
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="bar-tools">
            <Button
              disabled={busy || !session?.assetId}
              onClick={() =>
                void extractAround(video.current?.currentTime || 0)
              }
            >
              <Clapperboard size={14} /> Extract around playhead
            </Button>
          </div>
        </>
      )}

      {error && <p className="error">{error}</p>}
      {msg && <p className="notice">{msg}</p>}
      <p className="muted">
        Extracts use FFmpeg stream copy with a 5-minute cap. Keyframe alignment
        may shift in/out slightly.
      </p>
    </div>
  );
}
