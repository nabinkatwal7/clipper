"use client";
import { useState } from "react";
import { Factory, Play } from "lucide-react";
import type { Project, Settings } from "@/lib/types";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";

type ReelResult = {
  status: string;
  results: { project: string; ok: boolean; error?: string }[];
};

export function ReelFactory({ projects }: { projects: Project[] }) {
  const ready = projects.filter((p) => p.duration > 0);
  const [name, setName] = useState("Batch reels");
  const [sources, setSources] = useState<string[]>([]);
  const [clipCount, setClipCount] = useState(5);
  const [minScore, setMinScore] = useState(60);
  const [duration, setDuration] = useState<Settings["duration"]>("30-60");
  const [layout, setLayout] = useState<Settings["layout"]>("center");
  const [captions, setCaptions] = useState(true);
  const [reviewRequired, setReviewRequired] = useState(true);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ReelResult | null>(null);
  const [error, setError] = useState("");

  function toggle(id: string) {
    setSources((rows) =>
      rows.includes(id) ? rows.filter((x) => x !== id) : [...rows, id].slice(0, 40),
    );
  }

  async function run() {
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const job = {
        version: 1 as const,
        id: crypto.randomUUID(),
        name,
        createdAt: new Date().toISOString(),
        sources,
        categories: [] as string[],
        language: "auto",
        clipCount,
        duration,
        minScore,
        layout,
        style: "bold" as const,
        ratio: "9:16" as const,
        resolution: "1080" as const,
        captions,
        reviewRequired,
        status: "draft" as const,
        results: [] as { project: string; ok: boolean; error?: string }[],
      };
      const r = await fetch("/api/reel-factory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job }),
      });
      const data = await r.json();
      if (!r.ok) throw Error(data.error || "Queue failed");
      setResult(data.job);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Queue failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="reel-factory">
      <header className="panel-head">
        <div>
          <h2>Reel Factory</h2>
          <p>
            Run one production preset across multiple imported sources. Jobs use
            the shared local queue.
          </p>
        </div>
        <Badge variant="outline">
          <Factory size={12} /> Batch
        </Badge>
      </header>

      <label>
        Batch name
        <Input value={name} onChange={(e) => setName(e.target.value)} />
      </label>

      <fieldset>
        <legend>Sources ({sources.length} selected)</legend>
        <ul className="reel-sources">
          {ready.map((p) => (
            <li key={p.id}>
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={sources.includes(p.id)}
                  onChange={() => toggle(p.id)}
                />
                {p.title}
              </label>
            </li>
          ))}
          {!ready.length && (
            <li className="empty">Import sources before batching.</li>
          )}
        </ul>
      </fieldset>

      <div className="reel-grid">
        <label>
          Clips per source
          <select
            value={clipCount}
            onChange={(e) => setClipCount(Number(e.target.value))}
          >
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={20}>20</option>
          </select>
        </label>
        <label>
          Minimum score
          <Input
            type="number"
            min={0}
            max={100}
            value={minScore}
            onChange={(e) => setMinScore(Number(e.target.value) || 0)}
          />
        </label>
        <label>
          Duration
          <select
            value={duration}
            onChange={(e) =>
              setDuration(e.target.value as Settings["duration"])
            }
          >
            <option value="15-30">15–30s</option>
            <option value="30-60">30–60s</option>
            <option value="60-90">60–90s</option>
          </select>
        </label>
        <label>
          Layout
          <select
            value={layout}
            onChange={(e) => setLayout(e.target.value as Settings["layout"])}
          >
            <option value="center">Center</option>
            <option value="blur">Blur</option>
            <option value="crop">Crop</option>
            <option value="facecam">Facecam</option>
            <option value="original">Original</option>
          </select>
        </label>
      </div>

      <label className="check-row">
        <input
          type="checkbox"
          checked={captions}
          onChange={(e) => setCaptions(e.target.checked)}
        />
        Captions
      </label>
      <label className="check-row">
        <input
          type="checkbox"
          checked={reviewRequired}
          onChange={(e) => setReviewRequired(e.target.checked)}
        />
        Mark for review after generation
      </label>

      <Button
        disabled={busy || !sources.length || !name.trim()}
        onClick={() => void run()}
      >
        <Play size={14} /> {busy ? "Queuing…" : "Queue batch"}
      </Button>

      {error && <p className="error">{error}</p>}
      {result && (
        <div className="notice">
          <p>
            Status: <strong>{result.status}</strong> —{" "}
            {result.results.filter((r) => r.ok).length}/
            {result.results.length} queued
          </p>
          <ul>
            {result.results.map((r) => (
              <li key={r.project}>
                {r.project.slice(0, 8)}… {r.ok ? "queued" : r.error}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
