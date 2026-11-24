"use client";
import {
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
import { ProfilePicker } from "./brand-profiles";
export const editorTools = [
  ["media", "Media", Film],
  ["video", "Layout", PanelsTopLeft],
  ["text", "Text", Type],
  ["subtitles", "Captions", Captions],
  ["audio", "Audio", Volume2],
  ["branding", "Branding", Palette],
  ["effects", "Effects", SlidersHorizontal],
  ["templates", "Templates", LayoutTemplate],
] as const;
export function EditorInspector({
  tab,
  settings,
  change,
  project,
  now,
}: {
  tab: string;
  settings: Settings;
  change: (s: Settings) => void;
  project: Project;
  now: number;
}) {
  const adjust = (patch: Partial<Settings>) =>
    change({ ...settings, ...patch });
  return (
    <div className="editor-fields">
      <h3>{editorTools.find((t) => t[0] === tab)?.[1]}</h3>
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
