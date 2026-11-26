"use client";

import { defaultMask, type LayerMask } from "@/lib/layer-mask";
import { useState } from "react";

const controls = [
  { key: "x", label: "Horizontal center", min: 0, max: 1 },
  { key: "y", label: "Vertical center", min: 0, max: 1 },
  { key: "width", label: "Width", min: 0.05, max: 1 },
  { key: "height", label: "Height", min: 0.05, max: 1 },
  { key: "feather", label: "Edge feather", min: 0, max: 0.5 },
] as const;

export function LayerMaskControls({
  mask,
  change,
  time,
  length,
  seek,
}: {
  mask?: LayerMask;
  change: (mask?: LayerMask) => void;
  time: number;
  length: number;
  seek: (time: number) => void;
}) {
  const [editing, edit] = useState<number | null>(null);
  const keys = mask?.keys ?? [];
  const selected = keys.find((key) => key.time === editing);
  const at = Math.min(length, Math.max(0, Math.round(time * 100) / 100));
  return (
    <details className="clip-context">
      <summary>Shape mask</summary>
      <label className="field">
        Mask shape
        <select
          value={mask?.shape ?? "none"}
          onChange={(e) => {
            edit(null);
            const shape = e.target.value as LayerMask["shape"] | "none";
            change(
              shape === "none" ? undefined : { ...defaultMask, ...mask, shape },
            );
          }}
        >
          <option value="none">None</option>
          <option value="ellipse">Ellipse</option>
          <option value="rectangle">Rectangle</option>
        </select>
      </label>
      {mask && (
        <>
          <div className="candidate-actions">
            <button
              className="tool"
              onClick={() => edit(null)}
              aria-pressed={!selected}
            >
              Base geometry
            </button>
            <button
              className="tool"
              disabled={
                time < 0 ||
                time > length ||
                (keys.length >= 24 && !keys.some((key) => key.time === at))
              }
              onClick={() => {
                if (!keys.some((key) => key.time === at)) {
                  const { x, y, width, height, feather } = selected ?? mask;
                  change({
                    ...mask,
                    keys: [
                      ...keys,
                      { time: at, x, y, width, height, feather },
                    ].sort((a, b) => a.time - b.time),
                  });
                }
                edit(at);
              }}
            >
              Set mask keyframe at {at.toFixed(2)}s
            </button>
          </div>
          {keys.length > 0 && (
            <label className="field">
              Mask keyframe
              <select
                value={selected?.time ?? ""}
                onChange={(e) => {
                  const value = e.target.value;
                  edit(value === "" ? null : +value);
                  if (value !== "") seek(+value);
                }}
              >
                <option value="">Base geometry</option>
                {keys.map((key) => (
                  <option value={key.time} key={key.time}>
                    {key.time.toFixed(2)}s
                  </option>
                ))}
              </select>
            </label>
          )}
          {selected && (
            <button
              className="tool"
              onClick={() => {
                change({
                  ...mask,
                  keys: keys.filter((key) => key !== selected),
                });
                edit(null);
              }}
            >
              Delete mask keyframe
            </button>
          )}
          <div className="field-grid">
            {controls.map(({ key, label, min, max }) => (
              <label key={key} className="field">
                {label} · {Math.round((selected ?? mask)[key] * 100)}%
                <input
                  type="range"
                  min={min}
                  max={max}
                  step=".01"
                  value={(selected ?? mask)[key]}
                  onChange={(e) => {
                    const value = +e.target.value;
                    change(
                      selected
                        ? {
                            ...mask,
                            keys: keys.map((frame) =>
                              frame === selected
                                ? { ...frame, [key]: value }
                                : frame,
                            ),
                          }
                        : { ...mask, [key]: value },
                    );
                  }}
                />
              </label>
            ))}
          </div>
          <label className="check-row">
            <input
              type="checkbox"
              checked={mask.invert}
              onChange={(e) => change({ ...mask, invert: e.target.checked })}
            />
            Keep outside the shape
          </label>
          <p className="hint">
            Geometry interpolates linearly between keyframes. With keyframes
            present, the first and last values hold outside their range. Render
            the layer preview to check the motion.
          </p>
        </>
      )}
    </details>
  );
}
