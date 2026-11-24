"use client";
import { useEffect, useRef, type RefObject } from "react";
import { cropAt } from "@/lib/reframe";
import { dimensions } from "@/lib/captions";
import type { Settings, Segment } from "@/lib/types";
export function EditorMonitor({
  video,
  settings,
  segments,
  quality,
  safe,
}: {
  video: RefObject<HTMLVideoElement | null>;
  settings: Settings;
  segments: Segment[];
  quality: number;
  safe: boolean;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const v = video.current,
      c = ref.current;
    if (!v || !c) return;
    const [width, height] = dimensions(settings);
    const factor = Math.min(1, quality / Math.max(width, height));
    c.width = Math.round(width * factor);
    c.height = Math.round(height * factor);
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const transformCanvas = document.createElement("canvas");
    let frame = 0;
    function paint() {
      if (!v || !c || !ctx || v.readyState < 2) return;
      const w = c.width,
        h = c.height,
        sw = v.videoWidth,
        sh = v.videoHeight;
      const framing = cropAt(settings.cropPoints || [], v.currentTime);
      function fill(
        x: number,
        y: number,
        bw: number,
        bh: number,
        sx = 0,
        sy = 0,
        iw = sw,
        ih = sh,
      ) {
        if (!ctx || !v) return;
        const k = Math.max(bw / iw, bh / ih),
          cw = bw / k,
          ch = bh / k;
        ctx.drawImage(
          v,
          sx + (iw - cw) * (framing?.x ?? settings.crop / 100),
          sy + (ih - ch) * (framing?.y ?? (settings.offsetY ?? 50) / 100),
          cw,
          ch,
          x,
          y,
          bw,
          bh,
        );
      }
      if (settings.layout === "blur" || settings.layout === "original") {
        ctx.save();
        ctx.filter = "blur(12px)";
        fill(-12, -12, w + 24, h + 24);
        ctx.restore();
        const k = Math.min(w / sw, h / sh);
        ctx.drawImage(v, (w - sw * k) / 2, (h - sh * k) / 2, sw * k, sh * k);
      } else if (settings.layout === "facecam") {
        fill(
          0,
          0,
          w,
          h * 0.3,
          (sw - sw * 0.4) * (framing?.x ?? settings.crop / 100),
          0,
          sw * 0.4,
          sh * 0.4,
        );
        fill(0, h * 0.3, w, h * 0.7);
      } else fill(0, 0, w, h);
      if (
        (settings.scale ?? 1) !== 1 ||
        settings.rotation ||
        (settings.opacity ?? 1) !== 1
      ) {
        const scratch = transformCanvas;
        if (scratch.width !== w || scratch.height !== h) {
          scratch.width = w;
          scratch.height = h;
        }
        scratch.getContext("2d")?.drawImage(c, 0, 0);
        ctx.fillStyle = "black";
        ctx.fillRect(0, 0, w, h);
        ctx.save();
        ctx.globalAlpha = settings.opacity ?? 1;
        ctx.translate(w / 2, h / 2);
        ctx.rotate(((settings.rotation ?? 0) * Math.PI) / 180);
        ctx.translate(-w / 2, -h / 2);
        const z = settings.scale ?? 1;
        ctx.drawImage(
          scratch,
          (-(w * z - w) * settings.crop) / 100,
          (-(h * z - h) * (settings.offsetY ?? 50)) / 100,
          w * z,
          h * z,
        );
        ctx.restore();
      }
      if (settings.captions) {
        const at = v.currentTime;
        const seg = segments.find((s) => s.start <= at && s.end > at);
        if (seg) {
          const wi = seg.words.findIndex((word) => word.end > at);
          const group =
            wi < 0
              ? []
              : seg.words.slice(
                  Math.floor(wi / 6) * 6,
                  Math.floor(wi / 6) * 6 + 6,
                );
          const words = group.length
            ? group.map((word) => word.word.trim())
            : seg.text.trim().split(/\s+/);
          ctx.font =
            (settings.style === "minimal" ? "" : "bold ") +
            Math.max(8, (settings.fontSize * h) / 1920) +
            "px " +
            (settings.font || "Arial");
          ctx.lineJoin = "round";
          ctx.lineWidth = Math.max(0.1, (settings.outline ?? 3) * factor);
          const line = words.join(" ");
          const k = Math.min(
            1,
            (w * 0.9) / Math.max(1, ctx.measureText(line).width),
          );
          const y =
            settings.captionPosition === "bottom"
              ? h * 0.9
              : settings.captionPosition === "top"
                ? h * 0.11
                : h * 0.51;
          ctx.save();
          ctx.translate(w / 2, y);
          const age = Math.max(0, at - (group[0]?.start ?? seg.start)),
            t = Math.min(1, age / 0.16);
          const scale =
            settings.captionAnimation === "scale"
              ? 0.7 + 0.3 * t
              : settings.captionAnimation === "pop"
                ? age < 0.09
                  ? 0.75 + (0.37 * age) / 0.09
                  : 1.12 - 0.12 * Math.min(1, (age - 0.09) / 0.07)
                : 1;
          if (settings.captionAnimation === "slide")
            ctx.translate(0, h * 0.025 * (1 - t));
          ctx.scale(k * scale, scale);
          if (settings.captionAnimation === "fade") {
            const a = group[0]?.start ?? seg.start,
              b = group.at(-1)?.end ?? seg.end;
            ctx.globalAlpha = Math.min(
              1,
              Math.max(0, (at - a) / 0.075),
              Math.max(0, (b - at) / 0.06),
            );
          }
          if (settings.captionBackground) {
            const tw = ctx.measureText(line).width;
            const th = Math.max(8, (settings.fontSize * h) / 1920);
            ctx.fillStyle = "#111";
            ctx.fillRect(-tw / 2 - 3, -th, tw + 6, th + 4);
          }
          let x = -ctx.measureText(line).width / 2;
          words.forEach((word, i) => {
            ctx.shadowColor = "rgba(0,0,0,.7)";
            ctx.shadowOffsetX = (settings.shadow ?? 1) * factor;
            ctx.shadowOffsetY = (settings.shadow ?? 1) * factor;
            ctx.strokeStyle = "#111";
            if ((settings.outline ?? 3) > 0) ctx.strokeText(word, x, 0);
            ctx.fillStyle =
              group.length &&
              ((settings.style === "bold" && i === 0) ||
                (settings.style === "highlight" &&
                  group[i].start <= at &&
                  group[i].end > at))
                ? "yellow"
                : settings.captionColor || "white";
            ctx.fillText(word, x, 0);
            x += ctx.measureText(word + " ").width;
          });
          ctx.restore();
        }
      }
      if (settings.overlayText?.trim()) {
        ctx.save();
        ctx.font =
          "bold " + Math.round(h * 0.042) + "px " + (settings.font || "Arial");
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.lineWidth = 2;
        ctx.strokeStyle = "#111";
        ctx.fillStyle = "white";
        const y = (h * (settings.overlayY ?? 15)) / 100;
        ctx.strokeText(settings.overlayText, w / 2, y, w * 0.9);
        ctx.fillText(settings.overlayText, w / 2, y, w * 0.9);
        ctx.restore();
      }
      if (safe) {
        ctx.strokeStyle = "rgba(255,255,255,.75)";
        ctx.setLineDash([4, 5]);
        ctx.strokeRect(w * 0.08, h * 0.09, w * 0.84, h * 0.82);
        ctx.setLineDash([]);
      }
    }
    function next() {
      paint();
      if (v && !v.paused) frame = requestAnimationFrame(next);
    }
    function play() {
      cancelAnimationFrame(frame);
      next();
    }
    paint();
    v.addEventListener("play", play);
    v.addEventListener("seeked", paint);
    v.addEventListener("loadeddata", paint);
    if (!v.paused) play();
    return () => {
      cancelAnimationFrame(frame);
      v.removeEventListener("play", play);
      v.removeEventListener("seeked", paint);
      v.removeEventListener("loadeddata", paint);
    };
  }, [settings, segments, safe, video, quality]);
  return (
    <canvas
      className="monitor-canvas"
      ref={ref}
      aria-label="Output composition preview"
    />
  );
}
