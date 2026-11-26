"use client";
import { useEffect, useRef, type RefObject } from "react";

export function AudioMeter({
  video,
}: {
  video: RefObject<HTMLVideoElement | null>;
}) {
  const bars = useRef<HTMLCanvasElement>(null);
  const hold = useRef({ l: 0, r: 0 });
  useEffect(() => {
    const el = video.current;
    if (!el) return;
    let ctx: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let source: MediaElementAudioSourceNode | null = null;
    let frame = 0;
    try {
      ctx = new AudioContext();
      analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      source = ctx.createMediaElementSource(el);
      source.connect(analyser);
      analyser.connect(ctx.destination);
    } catch {
      return;
    }
    const data = new Float32Array(analyser!.fftSize);
    function draw() {
      const c = bars.current;
      if (!analyser || !c) return;
      analyser.getFloatTimeDomainData(data);
      let l = 0,
        r = 0;
      for (let i = 0; i < data.length; i += 2) {
        l = Math.max(l, Math.abs(data[i] || 0));
        r = Math.max(r, Math.abs(data[i + 1] || data[i] || 0));
      }
      hold.current.l = Math.max(l, hold.current.l * 0.96);
      hold.current.r = Math.max(r, hold.current.r * 0.96);
      const g = c.getContext("2d");
      if (!g) return;
      c.width = 120;
      c.height = 16;
      g.fillStyle = "#222";
      g.fillRect(0, 0, c.width, c.height);
      const paint = (peak: number, held: number, y: number) => {
        const w = peak * c.width;
        g.fillStyle = peak > 0.9 ? "#f66" : peak > 0.7 ? "#fc6" : "#6c6";
        g.fillRect(0, y, w, 6);
        g.fillStyle = "#fff";
        g.fillRect(held * c.width - 1, y, 2, 6);
      };
      paint(l, hold.current.l, 1);
      paint(r, hold.current.r, 9);
      frame = requestAnimationFrame(draw);
    }
    void ctx.resume();
    draw();
    return () => {
      cancelAnimationFrame(frame);
      source?.disconnect();
      analyser?.disconnect();
      void ctx?.close();
    };
  }, [video]);
  return (
    <canvas
      ref={bars}
      className="audio-meter"
      aria-label="Stereo peak meters"
      width={120}
      height={16}
    />
  );
}
