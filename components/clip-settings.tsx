"use client";
import { useState, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import type { Settings } from "@/lib/types";
export function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  options: [string, string][];
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <span className="select-wrap">
        <select
          aria-label={label}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          {options.map(([v, t]) => (
            <option key={v} value={v}>
              {t}
            </option>
          ))}
        </select>
        <ChevronDown size={16} />
      </span>
    </label>
  );
}
export function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="toggle-row">
      <span>{label}</span>
      <button
        type="button"
        className={`toggle ${checked ? "on" : ""}`}
        role="switch"
        aria-label={label}
        aria-checked={checked}
        onClick={() => onChange(!checked)}
      >
        <span />
      </button>
    </div>
  );
}
export function BasicSettings({
  value,
  onChange,
}: {
  value: Settings;
  onChange: (s: Settings) => void;
}) {
  return (
    <div className="field-grid">
      <Select
        label="Clip length"
        value={value.duration}
        onChange={(v) =>
          onChange({ ...value, duration: v as Settings["duration"] })
        }
        options={["15-30", "30-60", "60-90"].map((v) => [
          v,
          v.replace("-", "–") + " seconds",
        ])}
      />
      <Select
        label="How many clips?"
        value={value.count}
        onChange={(v) => onChange({ ...value, count: Number(v) })}
        options={[
          ["5", "5 clips"],
          ["10", "10 clips"],
          ["20", "20 clips"],
          ["0", "Let AI decide"],
        ]}
      />
    </div>
  );
}
export function FormatSettings({
  value,
  onChange,
}: {
  value: Settings;
  onChange: (s: Settings) => void;
}) {
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) =>
    onChange({ ...value, [k]: v });
  return (
    <>
      <div className="field-grid">
        <Select
          label="Format"
          value={value.ratio}
          onChange={(v) => set("ratio", v as Settings["ratio"])}
          options={[
            ["9:16", "Portrait · 9:16"],
            ["1:1", "Square · 1:1"],
            ["4:5", "Social · 4:5"],
            ["16:9", "Landscape · 16:9"],
          ]}
        />
        <Select
          label="Quality"
          value={value.resolution}
          onChange={(v) => set("resolution", v as Settings["resolution"])}
          options={[
            ["720", "720p · Faster"],
            ["1080", "1080p · Full HD"],
          ]}
        />
      </div>
      <Select
        label="Video layout"
        value={value.layout}
        onChange={(v) =>
          onChange({
            ...value,
            layout: v as Settings["layout"],
            ...(v === "original" ? { ratio: "16:9" as const } : {}),
          })
        }
        options={[
          ["center", "Center crop"],
          ["blur", "Blurred background"],
          ["crop", "Custom crop"],
          ["facecam", "Gameplay + facecam"],
          ["original", "Original landscape"],
        ]}
      />
      <label className="field">
        <span>
          Crop position <small>{value.crop}%</small>
        </span>
        <input
          aria-label="Crop position"
          type="range"
          min="0"
          max="100"
          value={value.crop}
          onChange={(e) => set("crop", Number(e.target.value))}
        />
      </label>
      {value.layout === "facecam" && (
        <p className="hint">
          The top source region becomes the facecam. Move the crop to match your
          camera.
        </p>
      )}
    </>
  );
}
export function SubtitleSettings({
  value,
  onChange,
}: {
  value: Settings;
  onChange: (s: Settings) => void;
}) {
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) =>
    onChange({ ...value, [k]: v });
  return (
    <>
      <Toggle
        label="Burn subtitles into video"
        checked={value.captions}
        onChange={(v) => set("captions", v)}
      />
      {value.captions && (
        <>
          <Select
            label="Subtitle style"
            value={value.style}
            onChange={(v) => set("style", v as Settings["style"])}
            options={[
              ["minimal", "Minimal white"],
              ["bold", "Bold yellow + white"],
              ["highlight", "Word highlight"],
            ]}
          />
          <div className="field-grid">
            <label className="field">
              Font
              <input
                list="studio-fonts"
                value={value.font || "Arial"}
                onChange={(e) => set("font", e.target.value)}
              />
              <datalist id="studio-fonts">
                {["Arial", "Verdana", "Georgia", "Tahoma", "Courier New"].map(
                  (f) => (
                    <option key={f}>{f}</option>
                  ),
                )}
              </datalist>
            </label>
            <label className="field">
              Text color
              <input
                type="color"
                value={value.captionColor || "#ffffff"}
                onChange={(e) => set("captionColor", e.target.value)}
              />
            </label>
          </div>
          <div className="field-grid">
            {(["outline", "shadow"] as const).map((key) => (
              <label key={key} className="field">
                {key === "outline" ? "Outline" : "Shadow"}
                <input
                  type="range"
                  min="0"
                  max="8"
                  value={value[key] ?? (key === "outline" ? 3 : 1)}
                  onChange={(e) => set(key, +e.target.value)}
                />
              </label>
            ))}
          </div>
          <div className="field-grid">
            <Select
              label="Subtitle position"
              value={value.captionPosition}
              onChange={(v) =>
                set("captionPosition", v as Settings["captionPosition"])
              }
              options={[
                ["bottom", "Bottom"],
                ["middle", "Middle"],
                ["top", "Top"],
              ]}
            />
            <label className="field">
              <span>
                Font size <small>{value.fontSize}</small>
              </span>
              <input
                aria-label="Font size"
                type="range"
                min="20"
                max="120"
                value={value.fontSize}
                onChange={(e) => set("fontSize", Number(e.target.value))}
              />
            </label>
          </div>
        </>
      )}
    </>
  );
}
export function AdvancedSettings({
  value,
  onChange,
}: {
  value: Settings;
  onChange: (s: Settings) => void;
}) {
  const [models, setModels] = useState<string[]>([]);
  useEffect(() => {
    fetch("/api/models")
      .then((r) => (r.ok ? r.json() : []))
      .then(setModels)
      .catch(() => {});
  }, []);
  return (
    <div className="advanced-settings">
      <Select
        label="Clipping method"
        value={value.mode}
        onChange={(v) => onChange({ ...value, mode: v as Settings["mode"] })}
        options={[
          ["ai", "AI highlights"],
          ["manual", "Choose a time range"],
          ["split", "Split into equal segments"],
        ]}
      />
      {value.mode === "ai" && (
        <>
          <div className="field-grid">
            <label className="field">
              Content category
              <select
                value={value.category || ""}
                onChange={(e) =>
                  onChange({ ...value, category: e.target.value })
                }
              >
                <option value="">General</option>
                {[
                  "Gaming",
                  "Interview",
                  "Sports",
                  "Education",
                  "Comedy",
                  "Commentary",
                ].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label className="field">
              Ollama model
              <select
                value={value.model || ""}
                onChange={(e) => onChange({ ...value, model: e.target.value })}
              >
                <option value="">Workspace default</option>
                {models.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </label>
          </div>
          <label className="field">
            Clipping instructions
            <textarea
              maxLength={1200}
              value={value.instructions || ""}
              onChange={(e) =>
                onChange({ ...value, instructions: e.target.value })
              }
              placeholder="Describe the moments to prioritize"
            />
          </label>
        </>
      )}
      {value.mode === "manual" && (
        <div className="field-grid">
          <label className="field">
            <span>Start (seconds)</span>
            <input
              type="number"
              min="0"
              value={value.manualStart}
              onChange={(e) =>
                onChange({ ...value, manualStart: Number(e.target.value) })
              }
            />
          </label>
          <label className="field">
            <span>End (seconds)</span>
            <input
              type="number"
              min="0"
              value={value.manualEnd}
              onChange={(e) =>
                onChange({ ...value, manualEnd: Number(e.target.value) })
              }
            />
          </label>
        </div>
      )}
      {value.mode === "split" && (
        <p className="hint">Equal-length segments, without AI selection.</p>
      )}
      <FormatSettings value={value} onChange={onChange} />
      <SubtitleSettings value={value} onChange={onChange} />
    </div>
  );
}
