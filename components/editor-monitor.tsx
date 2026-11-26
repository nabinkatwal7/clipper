"use client";
import { useEffect, useRef, type MutableRefObject, type RefObject } from "react";
import { cropAt } from "@/lib/reframe";
import { dimensions } from "@/lib/captions";
import { enabledTracks } from "@/lib/composition";
import {
  canvasBlend,
  compositionTime,
  applyChromaKey,
  layerPose,
  sampleMask,
} from "@/lib/preview-layers";
import type { Settings, Segment } from "@/lib/types";

type LayerMedia = {
  id: string;
  kind: "image" | "video";
  element: HTMLImageElement | HTMLVideoElement;
};

export function EditorMonitor({
  video,
  settings,
  segments,
  quality,
  safe,
  clipStart = 0,
  preferProxy = false,
  monitorCanvas,
}: {
  video: RefObject<HTMLVideoElement | null>;
  settings: Settings;
  segments: Segment[];
  quality: number;
  safe: boolean;
  clipStart?: number;
  preferProxy?: boolean;
  monitorCanvas?: RefObject<HTMLCanvasElement | null>;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const layers = useRef<Map<string, LayerMedia>>(new Map());
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
    const layerCanvas = document.createElement("canvas");
    let frame = 0;
    const tracks = enabledTracks(settings.composition).filter(
      (track) => track.type !== "audio",
    );
    for (const track of tracks) {
      if (track.type === "text") continue;
      if (layers.current.has(track.asset)) continue;
      if (track.type === "image") {
        const image = new Image();
        image.decoding = "async";
        image.src = "/api/assets?id=" + track.asset;
        layers.current.set(track.asset, {
          id: track.asset,
          kind: "image",
          element: image,
        });
      } else {
        const media = document.createElement("video");
        media.muted = true;
        media.playsInline = true;
        media.preload = "auto";
        media.src =
          "/api/assets?id=" +
          track.asset +
          (preferProxy ? "&proxy=1" : "");
        layers.current.set(track.asset, {
          id: track.asset,
          kind: "video",
          element: media,
        });
      }
    }
    const active = new Set(tracks.map((track) => track.asset));
    for (const [id, media] of layers.current) {
      if (active.has(id)) continue;
      if (media.kind === "video") {
        const clip = media.element as HTMLVideoElement;
        clip.pause();
        clip.removeAttribute("src");
        clip.load();
      }
      layers.current.delete(id);
    }

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

      const rel = compositionTime(v.currentTime, clipStart);
      for (const track of tracks) {
        if (rel < track.at || rel >= track.at + track.length) continue;
        const local = rel - track.at;
        if (track.type === "text") {
          const pose = layerPose(track, local);
          ctx.save();
          ctx.globalAlpha = Math.max(0, Math.min(1, pose.opacity));
          ctx.font =
            "bold " +
            Math.max(8, (track.fontSize ?? 48) * factor) +
            "px " +
            (settings.font || "Arial");
          ctx.fillStyle = track.color ?? "#ffffff";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(track.text?.trim() || "Text", w * pose.x, h * pose.y);
          ctx.restore();
          continue;
        }
        const media = layers.current.get(track.asset);
        if (!media) continue;
        const element = media.element;
        const ready =
          media.kind === "image"
            ? (element as HTMLImageElement).complete &&
              (element as HTMLImageElement).naturalWidth > 0
            : (element as HTMLVideoElement).readyState >= 2;
        if (!ready) continue;
        if (media.kind === "video") {
          const clip = element as HTMLVideoElement;
          const source =
            track.slip +
            (track.loop && clip.duration
              ? local % Math.max(0.04, clip.duration)
              : local);
          if (Math.abs(clip.currentTime - source) > 0.12) {
            try {
              clip.currentTime = Math.max(0, source);
            } catch {}
          }
          if (v.paused) clip.pause();
          else if (clip.paused) void clip.play().catch(() => {});
        }
        const pose = layerPose(track, local);
        const mw = Math.max(2, w * pose.size);
        const mh = Math.max(2, h * pose.size);
        const iw =
          media.kind === "image"
            ? (element as HTMLImageElement).naturalWidth
            : (element as HTMLVideoElement).videoWidth;
        const ih =
          media.kind === "image"
            ? (element as HTMLImageElement).naturalHeight
            : (element as HTMLVideoElement).videoHeight;
        if (!iw || !ih) continue;
        const fit = Math.min(mw / iw, mh / ih);
        const dw = iw * fit,
          dh = ih * fit;
        if (layerCanvas.width !== Math.ceil(dw) || layerCanvas.height !== Math.ceil(dh)) {
          layerCanvas.width = Math.max(1, Math.ceil(dw));
          layerCanvas.height = Math.max(1, Math.ceil(dh));
        }
        const lx = layerCanvas.getContext("2d");
        if (!lx) continue;
        lx.clearRect(0, 0, layerCanvas.width, layerCanvas.height);
        lx.save();
        if (track.flipX || track.flipY) {
          lx.translate(
            track.flipX ? layerCanvas.width : 0,
            track.flipY ? layerCanvas.height : 0,
          );
          lx.scale(track.flipX ? -1 : 1, track.flipY ? -1 : 1);
        }
        lx.drawImage(element, 0, 0, layerCanvas.width, layerCanvas.height);
        lx.restore();
        if (track.keyColor) {
          applyChromaKey(
            lx,
            layerCanvas.width,
            layerCanvas.height,
            track.keyColor,
          );
        }
        if (track.mask) {
          const geometry = sampleMask(track.mask, local);
          lx.globalCompositeOperation = track.mask.invert
            ? "destination-out"
            : "destination-in";
          lx.beginPath();
          const cx = geometry.x * layerCanvas.width;
          const cy = geometry.y * layerCanvas.height;
          const rw = (geometry.width * layerCanvas.width) / 2;
          const rh = (geometry.height * layerCanvas.height) / 2;
          if (track.mask.shape === "ellipse")
            lx.ellipse(cx, cy, rw, rh, 0, 0, Math.PI * 2);
          else if (track.mask.shape === "diamond") {
            lx.moveTo(cx, cy - rh);
            lx.lineTo(cx + rw, cy);
            lx.lineTo(cx, cy + rh);
            lx.lineTo(cx - rw, cy);
            lx.closePath();
          } else if (track.mask.shape === "rounded" && "roundRect" in lx) {
            const r =
              (track.mask.cornerRadius ?? 0.12) * Math.min(rw, rh) * 2;
            lx.roundRect(cx - rw, cy - rh, rw * 2, rh * 2, r);
          } else lx.rect(cx - rw, cy - rh, rw * 2, rh * 2);
          lx.fill();
          lx.globalCompositeOperation = "source-over";
        }
        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(1, pose.opacity));
        ctx.globalCompositeOperation =
          canvasBlend[track.blendMode ?? "normal"] || "source-over";
        const x = (w - dw) * pose.x;
        const y = (h - dh) * pose.y;
        ctx.translate(x + dw / 2, y + dh / 2);
        ctx.rotate((pose.rotation * Math.PI) / 180);
        ctx.drawImage(layerCanvas, -dw / 2, -dh / 2, dw, dh);
        ctx.restore();
      }
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;

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
          } else if (settings.captionAnimation === "bounce") {
            const bt = Math.min(1, age / 0.15);
            ctx.scale(1, 0.92 + 0.08 * Math.sin(bt * Math.PI));
          }
          if (settings.captionBackground) {
            const tw = ctx.measureText(line).width;
            const th = Math.max(8, (settings.fontSize * h) / 1920);
            ctx.fillStyle = "#111";
            ctx.fillRect(-tw / 2 - 3, -th, tw + 6, th + 4);
          }
          const shown =
            settings.captionAnimation === "typewriter"
              ? line.slice(
                  0,
                  Math.max(
                    1,
                    Math.floor(line.length * Math.min(1, age / 0.4)),
                  ),
                )
              : line;
          let x = -ctx.measureText(shown).width / 2;
          (settings.captionAnimation === "typewriter"
            ? [shown]
            : words
          ).forEach((word, i) => {
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
      for (const media of layers.current.values()) {
        if (media.kind === "video") (media.element as HTMLVideoElement).pause();
      }
    };
  }, [settings, segments, safe, video, quality, clipStart, preferProxy]);
  return (
    <canvas
      className="monitor-canvas"
      ref={(node) => {
        ref.current = node;
        if (monitorCanvas)
          (
            monitorCanvas as MutableRefObject<HTMLCanvasElement | null>
          ).current = node;
      }}
      aria-label="Output composition preview"
    />
  );
}
