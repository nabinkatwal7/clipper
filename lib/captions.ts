import type { Segment, Settings } from "./types";
function stamp(n: number) {
  const c = Math.round(Math.max(0, n) * 100);
  return `${Math.floor(c / 360000)}:${String(Math.floor(c / 6000) % 60).padStart(2, "0")}:${String(Math.floor(c / 100) % 60).padStart(2, "0")}.${String(c % 100).padStart(2, "0")}`;
}
function clean(s: string) {
  return s.replace(/[{}\\]/g, "").replace(/[\r\n]+/g, " ");
}
export function captions(
  segments: Segment[],
  start: number,
  end: number,
  s: Settings,
  w: number,
  h: number,
) {
  const alignment =
    s.captionPosition === "top" ? 8 : s.captionPosition === "middle" ? 5 : 2;
  const hex = (s.captionColor || "#ffffff").slice(1);
  const primary = hex.slice(4, 6) + hex.slice(2, 4) + hex.slice(0, 2);
  const header = `[Script Info]\nScriptType: v4.00+\nPlayResX: ${w}\nPlayResY: ${h}\nWrapStyle: 0\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Default,${s.font || "Arial"},${(s.fontSize * h) / 1920},&H00${primary},&H0000FFFF,&H00111111,&H80000000,${s.style === "minimal" ? 0 : -1},0,0,0,100,100,0,0,${s.captionBackground?3:1},${s.outline ?? 3},${s.shadow ?? 1},${alignment},40,40,${Math.round(h * 0.09)},1\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n`;
  let lines = "";
  const event = (a: number, b: number, text: string) => {
    if (b > a)
      lines += `Dialogue: 0,${stamp(a)},${stamp(b)},Default,,0,0,0,,${s.captionAnimation==="fade"?"{\\fad(75,60)}":""}${text}\n`;
  };
  for (const seg of segments) {
    const words = seg.words.filter((x) => x.end > start && x.start < end);
    if (words.length) {
      for (let i = 0; i < words.length; i += 6) {
        const group = words.slice(i, i + 6);
        if (s.style === "highlight") {
          for (let j = 0; j < group.length; j++)
            event(
              Math.max(0, group[j].start - start),
              Math.min(end - start, group[j].end - start),
              group
                .map(
                  (x, k) =>
                    `${k === j ? "{\\c&H0000FFFF&}" : `{\\c&H00${primary}&}`}${clean(x.word.trim())}`,
                )
                .join(" "),
            );
        } else
          event(
            Math.max(0, group[0].start - start),
            Math.min(end - start, group.at(-1)!.end - start),
            group
              .map(
                (x, k) =>
                  (s.style === "bold" && k === 0
                    ? "{\\c&H0000FFFF&}"
                    : `{\\c&H00${primary}&}`) + clean(x.word.trim()),
              )
              .join(" "),
          );
      }
    } else if (seg.end > start && seg.start < end)
      event(
        Math.max(0, seg.start - start),
        Math.min(end - start, seg.end - start),
        clean(seg.text),
      );
  }
  return header + lines;
}
export function dimensions(s: Settings) {
  const short = Number(s.resolution);
  const [a, b] = s.ratio.split(":").map(Number);
  return a >= b
    ? [Math.round((short * a) / b / 2) * 2, short]
    : [short, Math.round((short * b) / a / 2) * 2];
}
export function layoutFilter(s: Settings, w: number, h: number) {
  const x = s.crop / 100;
  const fill = (ow: number, oh: number) =>
    `scale=${ow}:${oh}:force_original_aspect_ratio=increase,crop=${ow}:${oh}:(iw-ow)*${x}:(ih-oh)/2,setsar=1`;
  if (s.layout === "blur" || s.layout === "original")
    return `[0:v]split[bg][fg];[bg]${fill(w, h)},boxblur=25:5[back];[fg]scale=${w}:${h}:force_original_aspect_ratio=decrease[front];[back][front]overlay=(W-w)/2:(H-h)/2,setsar=1[formatted]`;
  if (s.layout === "facecam") {
    const top = Math.round((h * 0.3) / 2) * 2,
      bottom = h - top;
    return `[0:v]split[cam][game];[cam]crop=iw*0.4:ih*0.4:(iw-iw*0.4)*${x}:0,${fill(w, top)}[face];[game]${fill(w, bottom)}[play];[face][play]vstack,setsar=1[formatted]`;
  }
  return `[0:v]${fill(w, h)}[formatted]`;
}
