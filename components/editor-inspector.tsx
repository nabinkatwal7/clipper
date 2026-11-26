"use client";
import {
  Sparkles,
  Film,
  PanelsTopLeft,
  Type,
  Captions,
  Volume2,
  Palette,
  SlidersHorizontal,
  LayoutTemplate,
} from "lucide-react";
import type { Project, Settings } from "@/lib/types";
import {
  outputDuration,
  speedPresets,
  type SpeedPoint,
} from "@/lib/speed-curve";
import { ProfilePicker } from "./brand-profiles";
export const editorTools = [
  ["director", "Director", Sparkles],
  ["layers", "Layers", PanelsTopLeft],
  ["media", "Media", Film],
  ["video", "Layout", PanelsTopLeft],
  ["text", "Text", Type],
  ["localize", "Translate", Type],
  ["subtitles", "Captions", Captions],
  ["audio", "Audio", Volume2],
  ["branding", "Branding", Palette],
  ["grade", "Grading", Palette],
  ["effects", "Effects", SlidersHorizontal],
  ["speed", "Speed", SlidersHorizontal],
  ["history", "History", LayoutTemplate],
  ["templates", "Templates", LayoutTemplate],
] as const;

function SpeedControls({
  settings,
  length,
  adjust,
}: {
  settings: Settings;
  length: number;
  adjust: (patch: Partial<Settings>) => void;
}) {
  const curve = settings.speedCurve || [];
  const rate = settings.playbackRate ?? 1;
  const rendered = outputDuration(curve, length, rate);
  function setCurve(next: SpeedPoint[] | undefined) {
    adjust({ speedCurve: next?.length ? next : undefined });
  }
  return (
    <>
      <label className="field">
        Constant speed · {rate}×
        <input
          type="range"
          min=".5"
          max="4"
          step=".05"
          value={rate}
          onChange={(e) => adjust({ playbackRate: +e.target.value })}
        />
      </label>
      <div className="candidate-actions">
        {[0.5, 1, 1.5, 2, 4].map((value) => (
          <button
            className="tool"
            key={value}
            aria-pressed={rate === value && !curve.length}
            onClick={() =>
              adjust({ playbackRate: value, speedCurve: undefined })
            }
          >
            {value}×
          </button>
        ))}
      </div>
      <h4>Speed curve</h4>
      <p className="hint">
        Control points use source time. Output length ≈ {rendered.toFixed(2)}s
        from {length.toFixed(2)}s of source.
      </p>
      <div className="candidate-actions">
        {speedPresets.map((preset) => (
          <button
            key={preset.id}
            type="button"
            className="tool"
            onClick={() => setCurve(preset.build(length))}
          >
            {preset.label}
          </button>
        ))}
        <button
          type="button"
          className="tool"
          disabled={curve.length >= 32}
          onClick={() =>
            setCurve(
              [
                ...curve,
                {
                  time: Math.min(
                    length,
                    curve.length ? curve.at(-1)!.time + 0.5 : 0,
                  ),
                  rate,
                },
              ].sort((a, b) => a.time - b.time),
            )
          }
        >
          Add point
        </button>
        <button
          type="button"
          className="tool"
          disabled={!curve.length}
          onClick={() => setCurve(undefined)}
        >
          Clear curve
        </button>
      </div>
      {curve.map((point, index) => (
        <div className="field-grid" key={index}>
          <label className="field">
            Time
            <input
              type="number"
              min="0"
              max={length}
              step=".05"
              value={point.time}
              onChange={(e) => {
                const next = curve.map((entry, i) =>
                  i === index ? { ...entry, time: +e.target.value } : entry,
                );
                setCurve([...next].sort((a, b) => a.time - b.time));
              }}
            />
          </label>
          <label className="field">
            Rate
            <input
              type="number"
              min=".5"
              max="4"
              step=".05"
              value={point.rate}
              onChange={(e) =>
                setCurve(
                  curve.map((entry, i) =>
                    i === index ? { ...entry, rate: +e.target.value } : entry,
                  ),
                )
              }
            />
          </label>
          <button
            type="button"
            className="tool"
            onClick={() => setCurve(curve.filter((_, i) => i !== index))}
          >
            Remove
          </button>
        </div>
      ))}
      <p className="hint">
        Curves remap video and audio in segments. Captions stay source-timed and
        ride along with the remapped frames. Use Preview from playhead to check.
      </p>
    </>
  );
}

export function EditorInspector({
  tab,
  settings,
  change,
  project,
  length = 30,
}: {
  tab: string;
  settings: Settings;
  change: (s: Settings) => void;
  project: Project;
  length?: number;
}) {
  const adjust = (patch: Partial<Settings>) =>
    change({ ...settings, ...patch });
  return (
    <div className="editor-fields">
      <h3>{editorTools.find((t) => t[0] === tab)?.[1]}</h3>
      {tab === "speed" && (
        <SpeedControls
          settings={settings}
          length={Math.max(0.04, length)}
          adjust={adjust}
        />
      )}
      {tab === "media" && (
        <>
          <strong>{project.title}</strong>
          <p className="hint">
            {project.width} × {project.height} · {Math.round(project.duration)}{" "}
            seconds
          </p>
          <a
            className="inline-link"
            href={`/api/download?project=${project.id}&kind=source&attachment=1`}
          >
            Download original recording
          </a>
        </>
      )}
      {tab === "audio" && (
        <label className="field">
          Volume · {Math.round((settings.volume ?? 1) * 100)}%
          <input
            type="range"
            min="0"
            max="1"
            step=".01"
            value={settings.volume ?? 1}
            onChange={(e) => adjust({ volume: +e.target.value })}
          />
        </label>
      )}
      {tab === "text" && (
        <>
          <label className="field">
            Overlay title
            <input
              value={settings.overlayText || ""}
              maxLength={100}
              onChange={(e) => adjust({ overlayText: e.target.value })}
            />
          </label>
          <label className="field">
            Vertical position
            <input
              type="range"
              min="8"
              max="90"
              value={settings.overlayY ?? 15}
              onChange={(e) => adjust({ overlayY: +e.target.value })}
            />
          </label>
          <p className="hint">
            The overlay appears throughout the selected clip.
          </p>
        </>
      )}
      {tab === "effects" && (
        <>
          {(
            [
              ["scale", "Scale", 1, 2, 0.01, 1],
              ["rotation", "Rotation", -180, 180, 1, 0],
              ["opacity", "Opacity", 0, 1, 0.01, 1],
              ["offsetY", "Vertical crop", 0, 100, 1, 50],
            ] as const
          ).map(([key, label, min, max, step, initial]) => (
            <label className="field" key={key}>
              {label} · {settings[key] ?? initial}
              <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={settings[key] ?? initial}
                onChange={(e) => adjust({ [key]: +e.target.value })}
              />
            </label>
          ))}
        </>
      )}
      {tab === "branding" && (
        <>
          <ProfilePicker apply={adjust} />
          <p className="hint">
            Create reusable caption profiles in Branding. Applying a profile
            updates this clip’s preview.
          </p>
        </>
      )}
      {tab === "templates" && (
        <>
          {(
            [
              {
                name: "Portrait interview",
                s: { ratio: "9:16", layout: "center", style: "minimal" },
              },
              {
                name: "Gameplay and facecam",
                s: { ratio: "9:16", layout: "facecam", style: "bold" },
              },
              {
                name: "Landscape recap",
                s: { ratio: "16:9", layout: "original", style: "highlight" },
              },
            ] as const
          ).map((t) => (
            <button
              className="event-row"
              key={t.name}
              onClick={() => adjust({ ...t.s, captions: true })}
            >
              {t.name}
              <small>{t.s.ratio}</small>
            </button>
          ))}
        </>
      )}
    </div>
  );
}
