"use client";
import { useEffect, useRef, useState, type RefObject } from "react";
import { sampleParade, sampleScopes, sampleWaveform } from "@/lib/scopes";

type ScopeMode = "histogram" | "waveform" | "parade";

export function VideoScopes({
  video,
  canvas,
}: {
  video: RefObject<HTMLVideoElement | null>;
  canvas?: RefObject<HTMLCanvasElement | null>;
}) {
  const plot = useRef<HTMLCanvasElement>(null);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<ScopeMode>("histogram");
  useEffect(() => {
    if (!open) return;
    let frame = 0;
    function draw() {
      const source = canvas?.current || video.current;
      const out = plot.current;
      if (!source || !out) return;
      const width =
        "videoWidth" in source && source.videoWidth
          ? source.videoWidth
          : source.width;
      const height =
        "videoHeight" in source && source.videoHeight
          ? source.videoHeight
          : source.height;
      if (!width || !height) return;
      const ctx = out.getContext("2d");
      if (!ctx) return;
      out.width = 256;
      out.height = 96;
      ctx.fillStyle = "#111";
      ctx.fillRect(0, 0, out.width, out.height);
      if (mode === "histogram") {
        const data = sampleScopes(source, width, height);
        const maxL = Math.max(1, ...data.luma);
        const maxR = Math.max(1, ...data.rgb.map((v) => Math.max(...v)));
        for (let i = 0; i < 64; i++) {
          const x = i * 4;
          ctx.fillStyle = "#faa";
          ctx.fillRect(
            x,
            96 - (data.rgb[i][0] / maxR) * 90,
            1,
            (data.rgb[i][0] / maxR) * 90,
          );
          ctx.fillStyle = "#afa";
          ctx.fillRect(
            x + 1,
            96 - (data.rgb[i][1] / maxR) * 90,
            1,
            (data.rgb[i][1] / maxR) * 90,
          );
          ctx.fillStyle = "#aaf";
          ctx.fillRect(
            x + 2,
            96 - (data.rgb[i][2] / maxR) * 90,
            1,
            (data.rgb[i][2] / maxR) * 90,
          );
          ctx.fillStyle = "#ddd";
          ctx.fillRect(x, 96 - (data.luma[i] / maxL) * 90, 1, 1);
        }
      } else if (mode === "waveform") {
        const wave = sampleWaveform(source, width, height);
        ctx.strokeStyle = "#9cf";
        ctx.beginPath();
        wave.forEach((v, i) => {
          const x = (i / wave.length) * out.width;
          const y = 96 - v * 90;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();
      } else {
        const parade = sampleParade(source, width, height);
        const cols = parade.length;
        parade.forEach((rgb, i) => {
          const x = (i / cols) * out.width;
          const w = out.width / cols;
          ctx.fillStyle = `rgb(${Math.round(rgb[0] * 255)},0,0)`;
          ctx.fillRect(x, 32, w, 32 * (1 - rgb[0]));
          ctx.fillStyle = `rgb(0,${Math.round(rgb[1] * 255)},0)`;
          ctx.fillRect(x, 64, w, 32 * (1 - rgb[1]));
          ctx.fillStyle = `rgb(0,0,${Math.round(rgb[2] * 255)})`;
          ctx.fillRect(x, 96, w, 32 * (1 - rgb[2]));
        });
      }
      frame = requestAnimationFrame(draw);
    }
    draw();
    return () => cancelAnimationFrame(frame);
  }, [open, video, canvas, mode]);
  return (
    <div className="video-scopes">
      <button
        type="button"
        className="tool"
        aria-pressed={open}
        onClick={() => setOpen(!open)}
      >
        {open ? "Hide scopes" : "Scopes"}
      </button>
      {open && (
        <>
          <div className="candidate-actions">
            {(
              [
                ["histogram", "Histogram"],
                ["waveform", "Waveform"],
                ["parade", "Parade"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className="tool"
                aria-pressed={mode === id}
                onClick={() => setMode(id)}
              >
                {label}
              </button>
            ))}
          </div>
          <canvas
            ref={plot}
            className="scope-plot"
            aria-label="Video scopes from the current preview"
          />
        </>
      )}
    </div>
  );
}