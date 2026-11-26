import { asset } from "./assets";
import { file } from "./store";
import { enabledTracks, curve, type Composition } from "./composition";
import { maskFilter } from "./layer-mask";
export async function compose(
  c: Composition | undefined,
  w: number,
  h: number,
  duration: number,
  sourceAudio: boolean,
  master: string,
  duck: boolean,
) {
  const inputs: string[] = [],
    graph: string[] = [],
    audio: string[] = [];
  let video = "base",
    i = 0;
  for (const t of enabledTracks(c)) {
    if (t.at >= duration) continue;
    const a = await asset(t.asset);
    if (a.kind !== t.type) throw Error("Track media type changed");
    const span = Math.min(t.length, duration - t.at);
    if (a.kind !== "image" && t.slip >= a.duration)
      throw Error("Slip time exceeds the asset duration");
    i++;
    if (a.kind === "image") inputs.push("-loop", "1", "-framerate", "30");
    else if (t.loop) inputs.push("-stream_loop", "-1");
    if (t.slip && a.kind !== "image") inputs.push("-ss", String(t.slip));
    inputs.push(
      "-protocol_whitelist",
      "file,pipe",
      "-t",
      String(span),
      "-i",
      file("assets", a.id, a.ext),
    );
    const fade = Math.min(t.fade, span / 2);
    if (t.visible && a.kind !== "audio") {
      const vw = Math.max(2, Math.round((w * t.size) / 2) * 2),
        vh = Math.max(2, Math.round((h * t.size) / 2) * 2);
      const key = t.keyColor;
      const keyFilter = key
        ? `,colorkey=0x${key.color.slice(1)}:${key.similarity}:${key.blend}`
        : "";
      const mask = t.mask ? "," + maskFilter(t.mask) : "";
      graph.push(
        `[${i}:v]scale=${vw}:${vh}:force_original_aspect_ratio=decrease,setsar=1,format=rgba${keyFilter}${mask},colorchannelmixer=aa=${t.opacity}${fade ? ",fade=t=in:st=0:d=" + fade + ":alpha=1,fade=t=out:st=" + (span - fade) + ":d=" + fade + ":alpha=1" : ""},setpts=PTS-STARTPTS+${t.at}/TB[layer${i}]`,
      );
      graph.push(
        `[${video}][layer${i}]overlay=x='(W-w)*${curve(t.keys.x, t.x, t.at)}':y='(H-h)*${curve(t.keys.y, t.y, t.at)}':enable='between(t,${t.at},${t.at + span})':eof_action=pass:repeatlast=0[composite${i}]`,
      );
      video = "composite" + i;
    }
    if (!t.muted && a.audio) {
      graph.push(
        `[${i}:a]asetpts=PTS-STARTPTS,volume='${curve(t.keys.volume, t.volume, 0)}':eval=frame,adelay=${Math.round(t.at * 1000)}:all=1[trackaudio${i}]`,
      );
      audio.push("[trackaudio" + i + "]");
    }
  }
  let audioMap: string[] = ["-map", "0:a?", "-af", master];
  if (audio.length) {
    if (duck && sourceAudio) {
      graph.push("[0:a]asplit=2[sourceMix][sourceKey]");
      graph.push(
        audio.join("") +
          `amix=inputs=${audio.length}:normalize=0,apad,atrim=duration=${duration}[backing]`,
      );
      graph.push(
        "[backing][sourceKey]sidechaincompress=threshold=0.025:ratio=6:attack=20:release=350[ducked]",
      );
      audio.splice(0, audio.length, "[sourceMix]", "[ducked]");
    } else if (sourceAudio) audio.unshift("[0:a]");
    graph.push(
      audio.join("") +
        `amix=inputs=${audio.length}:normalize=0:duration=longest,apad,atrim=duration=${duration},${master}[mixed]`,
    );
    audioMap = ["-map", "[mixed]"];
  }
  return {
    inputs,
    graph,
    video,
    audioMap,
    hasAudio: sourceAudio || audio.length > 0,
  };
}
