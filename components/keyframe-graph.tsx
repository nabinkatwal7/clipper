"use client";
import type { Keyframe } from "@/lib/composition";
import { bezierControls, sampleCurve } from "@/lib/keyframe-curve";

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

  function dragPoint(
    event: React.PointerEvent,
    index: number,
    mode: "point" | "out" | "in",
  ) {
    event.preventDefault();
    event.stopPropagation();
    const svg = (event.currentTarget as SVGElement).ownerSVGElement;
    if (!svg) return;
    const move = (e: PointerEvent) => {
      const point = svg.createSVGPoint();
      point.x = e.clientX;
      point.y = e.clientY;
      const local = point.matrixTransform(svg.getScreenCTM()?.inverse());
      const next = keys.map((entry, i) => {
        if (i !== index) return entry;
        if (mode === "point")
          return {
            ...entry,
            time: Math.round(timeAt(local.x) * 1000) / 1000,
            value: Math.round(valueAt(local.y) * 1000) / 1000,
          };
        const [cx1, cy1, cx2, cy2] = bezierControls(entry);
        const nx = Math.max(0, Math.min(1, (local.x - pad) / (width - pad * 2)));
        const ny = Math.max(
          0,
          Math.min(1, (height - pad - local.y) / (height - pad * 2)),
        );
        if (mode === "out")
          return {
            ...entry,
            ease: "bezier" as const,
            cx1: nx,
            cy1: ny,
            cx2,
            cy2,
          };
        return {
          ...entry,
          ease: "bezier" as const,
          cx1,
          cy1,
          cx2: nx,
          cy2: ny,
        };
      });
      onChange(
        mode === "point" ? [...next].sort((a, b) => a.time - b.time) : next,
      );
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

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
      {keys.map((key, index) => {
        const [cx1, cy1, cx2, cy2] = bezierControls(key);
        const show =
          key.ease.startsWith("bezier") || key.cx1 !== undefined;
        const hx1 = xAt(key.time) + (cx1 - 0.5) * 40;
        const hy1 = yAt(key.value) - (cy1 - 0.5) * 40;
        const hx2 = xAt(key.time) + (cx2 - 0.5) * 40;
        const hy2 = yAt(key.value) - (cy2 - 0.5) * 40;
        return (
          <g key={index}>
            {show && (
              <>
                <line
                  x1={xAt(key.time)}
                  y1={yAt(key.value)}
                  x2={hx1}
                  y2={hy1}
                  className="graph-handle-line"
                />
                <line
                  x1={xAt(key.time)}
                  y1={yAt(key.value)}
                  x2={hx2}
                  y2={hy2}
                  className="graph-handle-line"
                />
                <circle
                  cx={hx1}
                  cy={hy1}
                  r={4}
                  className="graph-handle"
                  onPointerDown={(e) => dragPoint(e, index, "out")}
                />
                <circle
                  cx={hx2}
                  cy={hy2}
                  r={4}
                  className="graph-handle"
                  onPointerDown={(e) => dragPoint(e, index, "in")}
                />
              </>
            )}
            <circle
              cx={xAt(key.time)}
              cy={yAt(key.value)}
              r={5}
              className="graph-point"
              onPointerDown={(e) => dragPoint(e, index, "point")}
            />
          </g>
        );
      })}
    </svg>
  );
}
