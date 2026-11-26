"use client";
import type { Keyframe } from "@/lib/composition";
import { sampleCurve } from "@/lib/keyframe-curve";

export function KeyframeGraph({
  keys,
  length,
  min = 0,
  max = 1,
  onChange,
}: {
  keys: Keyframe[];
  length: number;
  min?: number;
  max?: number;
  onChange: (keys: Keyframe[]) => void;
}) {
  const width = 320,
    height = 120,
    pad = 10;
  const span = Math.max(0.04, length);
  const range = Math.max(0.0001, max - min);
  const xAt = (time: number) => pad + ((width - pad * 2) * time) / span;
  const yAt = (value: number) =>
    height - pad - ((height - pad * 2) * (value - min)) / range;
  const timeAt = (x: number) =>
    Math.max(0, Math.min(span, ((x - pad) / (width - pad * 2)) * span));
  const valueAt = (y: number) =>
    Math.max(
      min,
      Math.min(max, min + ((height - pad - y) / (height - pad * 2)) * range),
    );
  const path = Array.from({ length: 48 }, (_, i) => {
    const t = (i / 47) * span;
    return `${i ? "L" : "M"}${xAt(t)},${yAt(sampleCurve(keys, keys[0]?.value ?? min, t))}`;
  }).join(" ");
  return (
    <svg
      className="keyframe-graph"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Animation curve"
    >
      <rect
        x={pad}
        y={pad}
        width={width - pad * 2}
        height={height - pad * 2}
        className="graph-plot"
      />
      <path d={path} className="graph-curve" fill="none" />
      {keys.map((key, index) => (
        <circle
          key={index}
          cx={xAt(key.time)}
          cy={yAt(key.value)}
          r={5}
          className="graph-point"
          onPointerDown={(event) => {
            event.preventDefault();
            const svg = event.currentTarget.ownerSVGElement;
            if (!svg) return;
            const move = (e: PointerEvent) => {
              const point = svg.createSVGPoint();
              point.x = e.clientX;
              point.y = e.clientY;
              const local = point.matrixTransform(
                svg.getScreenCTM()?.inverse(),
              );
              const next = keys.map((entry, i) =>
                i === index
                  ? {
                      ...entry,
                      time: Math.round(timeAt(local.x) * 1000) / 1000,
                      value: Math.round(valueAt(local.y) * 1000) / 1000,
                    }
                  : entry,
              );
              onChange([...next].sort((a, b) => a.time - b.time));
            };
            const up = () => {
              window.removeEventListener("pointermove", move);
              window.removeEventListener("pointerup", up);
            };
            window.addEventListener("pointermove", move);
            window.addEventListener("pointerup", up);
          }}
        />
      ))}
    </svg>
  );
}
