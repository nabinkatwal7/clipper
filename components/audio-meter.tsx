"use client";
import { useEffect, useRef, type RefObject } from "react";

export function AudioMeter({
  video,
}: {
  video: RefObject<HTMLVideoElement | null>;
}) {
  const bars = useRef<HTMLCanvasElement>(null);
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
      analyser.fftSize = 256;
      source = ctx.createMediaElementSource(el);
      source.connect(analyser);
      analyser.connect(ctx.destination);
    } catch {
      return;
    }
  const data = new Uint8Array(analyser!.frequencyBinCount);
    function draw() {
      const c = bars.current;
      if (!analyser || !c) return;
      analyser.getByteFrequencyData(data);
      let peak = 0;
      for (let i = 0; i < data.length; i++) if (data[i] > peak) peak = data[i];
      const g = c.getContext("2d");
      if (!g) return;
      c.width = 120;
      c.height = 12;
      g.fillStyle = "#222";
      g.fillRect(0, 0, c.width, c.height);
      const w = (peak / 255) * c.width;
      g.fillStyle = peak > 220 ? "#f66" : peak > 180 ? "#fc6" : "#6c6";
      g.fillRect(0, 0, w, c.height);
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
      aria-label="Audio level meter"
      width={120}
      height={12}
    />
  );
}