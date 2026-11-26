"use client";

import { defaultMask, type LayerMask } from "@/lib/layer-mask";

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
}: {
  mask?: LayerMask;
  change: (mask?: LayerMask) => void;
}) {
  return (
    <details className="clip-context">
      <summary>Shape mask</summary>
      <label className="field">
        Mask shape
        <select
          value={mask?.shape ?? "none"}
          onChange={(e) => {
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
          <div className="field-grid">
            {controls.map(({ key, label, min, max }) => (
              <label key={key} className="field">
                {label} · {Math.round(mask[key] * 100)}%
                <input
                  type="range"
                  min={min}
                  max={max}
                  step=".01"
                  value={mask[key]}
                  onChange={(e) => change({ ...mask, [key]: +e.target.value })}
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
            Render the layer preview to see the mask on the composition.
          </p>
        </>
      )}
    </details>
  );
}
