"use client";
import { useEffect, useRef, useState, type RefObject } from "react";
import { sampleScopes } from "@/lib/scopes";

export function VideoScopes({
  video,
  canvas,
}: {
  video: RefObject<HTMLVideoElement | null>;
  canvas?: RefObject<HTMLCanvasElement | null>;
}) {
  const plot = useRef<HTMLCanvasElement>(null);
  const [open, setOpen] = useState(false);
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
      const data = sampleScopes(source, width, height);
      const ctx = out.getContext("2d");
      if (!ctx) return;
      out.width = 256;
      out.height = 96;
      ctx.fillStyle = "#111";
      ctx.fillRect(0, 0, out.width, out.height);
      const maxL = Math.max(1, ...data.luma);
      const maxR = Math.max(1, ...data.rgb.map((v) => Math.max(...v)));
      for (let i = 0; i < 64; i++) {
        const x = i * 4;
        ctx.fillStyle = "#faa";
        ctx.fillRect(x, 96 - (data.rgb[i][0] / maxR) * 90, 1, (data.rgb[i][0] / maxR) * 90);
        ctx.fillStyle = "#afa";
        ctx.fillRect(x + 1, 96 - (data.rgb[i][1] / maxR) * 90, 1, (data.rgb[i][1] / maxR) * 90);
        ctx.fillStyle = "#aaf";
        ctx.fillRect(x + 2, 96 - (data.rgb[i][2] / maxR) * 90, 1, (data.rgb[i][2] / maxR) * 90);
        ctx.fillStyle = "#ddd";
        ctx.fillRect(x, 96 - (data.luma[i] / maxL) * 90, 1, 1);
      }
      frame = requestAnimationFrame(draw);
    }
    draw();
    return () => cancelAnimationFrame(frame);
  }, [open, video, canvas]);
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
        <canvas
          ref={plot}
          className="scope-plot"
          aria-label="RGB and luma histogram from the current preview"
        />
      )}
    </div>
  );
}
