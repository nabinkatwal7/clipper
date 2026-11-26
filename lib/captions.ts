import { cropExpression } from "./reframe";
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
  const spacing = s.captionSpacing ?? 0;
  const header = `[Script Info]\nScriptType: v4.00+\nPlayResX: ${w}\nPlayResY: ${h}\nWrapStyle: 0\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Default,${s.customFont || s.font || "Arial"},${(s.fontSize * h) / 1920},&H00${primary},&H0000FFFF,&H00111111,&H80000000,${s.style === "minimal" ? 0 : -1},0,0,0,100,100,${spacing},0,${s.captionBackground ? 3 : 1},${s.outline ?? 3},${s.shadow ?? 1},${alignment},40,40,${Math.round(h * 0.09)},1\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n`;
  let lines = "";
  const y =
    s.captionPosition === "bottom"
      ? Math.round(h * 0.91)
      : s.captionPosition === "top"
        ? Math.round(h * 0.09)
        : Math.round(h * 0.5);
  const x = Math.round(w / 2);
  const motion = {
    none: "",
    fade: "{\\fad(75,60)}",
    pop: "{\\fscx75\\fscy75\\t(0,90,\\fscx112\\fscy112)\\t(90,160,\\fscx100\\fscy100)}",
    scale: "{\\fscx70\\fscy70\\t(0,160,\\fscx100\\fscy100)}",
    slide: `{\\move(${x},${y + Math.round(h * 0.025)},${x},${y},0,160)}`,
    bounce:
      "{\\fscx90\\fscy90\\t(0,80,\\fscx108\\fscy108)\\t(80,150,\\fscx100\\fscy100)}",
    typewriter: "{\\k60}",
  }[s.captionAnimation || "none"];
  const speakerColor = (seg: Segment) => {
    const name = seg.speaker || seg.text.match(/^\[([^\]]+)\]/)?.[1];
    const style = s.speakerStyles?.find(
      (row) => row.name.toLowerCase() === (name || "").toLowerCase(),
    );
    if (!style) return primary;
    const hex = style.color.slice(1);
    return hex.slice(4, 6) + hex.slice(2, 4) + hex.slice(0, 2);
  };
  const event = (a: number, b: number, text: string) => {
    if (b > a)
      lines += `Dialogue: 0,${stamp(a)},${stamp(b)},Default,,0,0,0,,${motion}${text}\n`;
  };
  for (const seg of segments) {
    const style = seg.style || s.style;
    const color = speakerColor(seg);
    const words = seg.words.filter((x) => x.end > start && x.start < end);
    if (words.length) {
      for (let i = 0; i < words.length; i += 6) {
        const group = words.slice(i, i + 6);
        if (style === "highlight" || s.captionAnimation === "typewriter") {
          for (let j = 0; j < group.length; j++)
            event(
              Math.max(0, group[j].start - start),
              Math.min(end - start, group[j].end - start),
              group
                .map(
                  (x, k) =>
                    `${k === j ? "{\\c&H0000FFFF&}" : `{\\c&H00${color}&}`}${clean(x.word.trim())}`,
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
                  (style === "bold" && k === 0
                    ? "{\\c&H0000FFFF&}"
                    : `{\\c&H00${color}&}`) + clean(x.word.trim()),
              )
              .join(" "),
          );
      }
    } else if (seg.end > start && seg.start < end)
      event(
        Math.max(0, seg.start - start),
        Math.min(end - start, seg.end - start),
        seg.text.split(/\r?\n/).map(clean).join("\\N"),
      );
  }
  if (s.overlayText?.trim())
    lines += `Dialogue: 1,0:00:00.00,${stamp(end - start)},Default,,0,0,0,,{\\an5\\pos(${Math.round(w / 2)},${Math.round((h * (s.overlayY ?? 15)) / 100)})\\b1\\fs${Math.round(h * 0.042)}\\c&H00FFFFFF&}${clean(s.overlayText)}\n`;
  return header + lines;
}
export function dimensions(s: Settings) {
  const short = Number(s.resolution);
  const [a, b] = s.ratio.split(":").map(Number);
  return a >= b
    ? [Math.round((short * a) / b / 2) * 2, short]
    : [short, Math.round((short * b) / a / 2) * 2];
}
export function layoutFilter(s: Settings, w: number, h: number, start = 0) {
  const x = s.cropPoints?.length
    ? cropExpression(s.cropPoints, "x", start)
    : s.crop / 100;
  const y = s.cropPoints?.length
    ? cropExpression(s.cropPoints, "y", start)
    : (s.offsetY ?? 50) / 100;
  const fill = (ow: number, oh: number) =>
    `scale=${ow}:${oh}:force_original_aspect_ratio=increase,crop=${ow}:${oh}:'(iw-ow)*${x}':'(ih-oh)*${y}',setsar=1`;
  if (s.layout === "blur" || s.layout === "original")
    return `[0:v]split[bg][fg];[bg]${fill(w, h)},boxblur=25:5[back];[fg]scale=${w}:${h}:force_original_aspect_ratio=decrease[front];[back][front]overlay=(W-w)/2:(H-h)/2,setsar=1[formatted]`;
  if (s.layout === "facecam") {
    const top = Math.round((h * 0.3) / 2) * 2,
      bottom = h - top;
    return `[0:v]split[cam][game];[cam]crop=iw*0.4:ih*0.4:'(iw-iw*0.4)*${x}':0,${fill(w, top)}[face];[game]${fill(w, bottom)}[play];[face][play]vstack,setsar=1[formatted]`;
  }
  return `[0:v]${fill(w, h)}[formatted]`;
}
