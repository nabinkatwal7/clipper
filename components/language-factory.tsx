"use client";
import { useMemo, useState } from "react";
import { Languages, Play } from "lucide-react";
import type { Project } from "@/lib/types";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Input } from "./ui/input";

const PRESETS = [
  "English",
  "Nepali",
  "Hindi",
  "Nepali-English",
  "Hindi-English",
  "Urdu",
  "Bengali",
  "Arabic",
  "Spanish",
  "Chinese",
  "Japanese",
  "Korean",
];

type Result = {
  language: string;
  ok: boolean;
  title?: string;
  error?: string;
};

export function LanguageFactory({ projects }: { projects: Project[] }) {
  const withClips = useMemo(
    () => projects.filter((p) => p.clips.length),
    [projects],
  );
  const [projectId, setProjectId] = useState(withClips[0]?.id || "");
  const project = withClips.find((p) => p.id === projectId) || withClips[0];
  const [clipId, setClipId] = useState(project?.clips[0]?.id || "");
  const clip =
    project?.clips.find((c) => c.id === clipId) || project?.clips[0];
  const [selected, setSelected] = useState<string[]>(["Nepali", "Hindi"]);
  const [custom, setCustom] = useState("");
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<Result[]>([]);
  const [error, setError] = useState("");

  function toggle(lang: string) {
    setSelected((rows) =>
      rows.includes(lang)
        ? rows.filter((x) => x !== lang)
        : [...rows, lang].slice(0, 12),
    );
  }

  async function run() {
    if (!project || !clip || !selected.length) return;
    setBusy(true);
    setError("");
    setResults([]);
    const out: Result[] = [];
    for (const language of selected) {
      try {
        const r = await fetch("/api/localize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            project: project.id,
            clip: clip.id,
            language,
          }),
        });
        const data = await r.json();
        if (!r.ok) throw Error(data.error || "Localization failed");
        out.push({ language, ok: true, title: data.title });
      } catch (e) {
        out.push({
          language,
          ok: false,
          error: e instanceof Error ? e.message : "Failed",
        });
      }
      setResults([...out]);
    }
    setBusy(false);
  }

  return (
    <div className="language-factory">
      <header className="panel-head">
        <div>
          <h2>Language Factory</h2>
          <p>
            Produce localized caption packages for one clip. Source media is
            reused; speech synthesis is not claimed unless a verified Ollama
            speech model is available.
          </p>
        </div>
        <Badge variant="outline">
          <Languages size={12} /> Captions
        </Badge>
      </header>

      {!withClips.length ? (
        <p className="empty">Generate at least one clip first.</p>
      ) : (
        <>
          <div className="reel-grid">
            <label>
              Project
              <select
                value={project?.id}
                onChange={(e) => {
                  setProjectId(e.target.value);
                  const p = withClips.find((x) => x.id === e.target.value);
                  setClipId(p?.clips[0]?.id || "");
                }}
              >
                {withClips.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Clip
              <select
                value={clip?.id}
                onChange={(e) => setClipId(e.target.value)}
              >
                {(project?.clips || []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <fieldset>
            <legend>Target languages</legend>
            <div className="saved-searches">
              {PRESETS.map((lang) => (
                <button
                  key={lang}
                  type="button"
                  className={`chip ${selected.includes(lang) ? "current" : ""}`}
                  onClick={() => toggle(lang)}
                >
                  {lang}
                </button>
              ))}
            </div>
            <div className="instant-add" style={{ marginTop: 8 }}>
              <Input
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                placeholder="Custom language"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  if (!custom.trim()) return;
                  toggle(custom.trim());
                  setCustom("");
                }}
              >
                Add
              </Button>
            </div>
          </fieldset>

          <Button
            disabled={busy || !clip || !selected.length}
            onClick={() => void run()}
          >
            <Play size={14} />{" "}
            {busy ? "Localizing…" : `Localize ${selected.length} language(s)`}
          </Button>

          {error && <p className="error">{error}</p>}
          {!!results.length && (
            <ul className="moment-hits">
              {results.map((r) => (
                <li key={r.language}>
                  <div>
                    <strong>{r.language}</strong>
                    <Badge variant={r.ok ? "success" : "destructive"}>
                      {r.ok ? "ok" : "failed"}
                    </Badge>
                    <p>{r.ok ? r.title : r.error}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
