import { asset } from "./assets";
import { file } from "./store";
import { enabledTracks, curve, type Composition } from "./composition";
import { layerAlphaFilter, maskFilter } from "./layer-mask";
import { layerBlendGraph } from "./layer-blend";
import { layerTransformFilters } from "./layer-transform";
import { shapeFilter } from "./motion-graphics";
import { gradeFilters } from "./grading";
export async function compose(
  c: Composition | undefined,
  w: number,
  h: number,
  duration: number,
  sourceAudio: boolean,
  master: string,
  duck: boolean,
  backgroundAsset?: string,
) {
  const inputs: string[] = [],
    graph: string[] = [],
    audio: string[] = [];
  let video = "base",
    i = 0;
  const ordered = [...enabledTracks(c)].sort((a, b) => {
    if (!backgroundAsset) return 0;
    if (a.asset === backgroundAsset && b.asset !== backgroundAsset) return -1;
    if (b.asset === backgroundAsset && a.asset !== backgroundAsset) return 1;
    return 0;
  });
  for (const t of ordered) {
    if (t.at >= duration) continue;
    const span = Math.min(t.length, duration - t.at);
    if (t.type === "text" || t.type === "shape") {
      if (!t.visible) continue;
      i++;
      const fade = Math.min(t.fade, span / 2);
      const draw =
        t.type === "shape"
          ? shapeFilter(t, w, h)
          : (() => {
              const esc = (t.text || "Text")
                .replace(/\\/g, "\\\\")
                .replace(/'/g, "\\'")
                .replace(/:/g, "\\:")
                .replace(/%/g, "\\%");
              const fc = (t.color || "#ffffff").replace("#", "0x");
              const fs = t.fontSize ?? 64;
              return `drawtext=text='${esc}':fontsize=${fs}:fontcolor=${fc}:x=(w-text_w)*${curve(t.keys.x, t.x, t.at)}:y=(h-text_h)*${curve(t.keys.y, t.y, t.at)}`;
            })();
      graph.push(
        `color=c=black@0.0:s=${w}x${h}:d=${span},fps=30,format=rgba,${draw}:enable='between(t,${t.at},${t.at + span})'${fade ? ",fade=t=in:st=0:d=" + fade + ":alpha=1,fade=t=out:st=" + (span - fade) + ":d=" + fade + ":alpha=1" : ""},setpts=PTS-STARTPTS+${t.at}/TB[layer${i}]`,
      );
      const placement = `x=0:y=0:enable='between(t,${t.at},${t.at + span})':eof_action=pass:repeatlast=0`;
      graph.push(
        ...layerBlendGraph(
          video,
          "layer" + i,
          "composite" + i,
          placement,
          t.blendMode,
        ),
      );
      video = "composite" + i;
      continue;
    }
    if (t.type === "effect") {
      if (!t.visible || !t.effectStack?.length) continue;
      const fx = gradeFilters({}, w, h, t.effectStack);
      if (!fx.length) continue;
      i++;
      graph.push(
        `[${video}]${fx.join(",")},enable='between(t,${t.at},${t.at + span})'[composite${i}]`,
      );
      video = "composite" + i;
      continue;
    }
    const a = await asset(t.asset);
    if (a.kind !== t.type) throw Error("Track media type changed");
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
      const sizeKeys = t.keys.size;
      const maxSize = Math.max(
        t.size,
        ...(sizeKeys?.map((key) => key.value) ?? []),
      );
      const vw = Math.max(2, Math.round((w * maxSize) / 2) * 2),
        vh = Math.max(2, Math.round((h * maxSize) / 2) * 2);
      const key = t.keyColor;
      const keyFilter = key
        ? `,colorkey=0x${key.color.slice(1)}:${key.similarity}:${key.blend}`
        : "";
      const resetClock =
        t.mask ||
        t.keys.rotation?.length ||
        t.keys.opacity?.length ||
        sizeKeys?.length
          ? ",setpts=PTS-STARTPTS"
          : "";
      const mask = t.mask ? "," + maskFilter(t.mask) : "";
      const transforms = layerTransformFilters(t, t.keys.rotation)
        .map((filter) => "," + filter)
        .join("");
      const sizeFactor = sizeKeys?.length
        ? `(${curve(sizeKeys, t.size, 0, "t")})/${maxSize}`.replace(
            /,/g,
            "\\,",
          )
        : "";
      const sizeScale = sizeFactor
        ? `,scale=eval=frame:w='max(2\\,trunc(iw*(${sizeFactor})/2)*2)':h='max(2\\,trunc(ih*(${sizeFactor})/2)*2)'`
        : "";
      const opacity = t.keys.opacity?.length
        ? layerAlphaFilter(
            `alpha(X,Y)*(${curve(t.keys.opacity, t.opacity, 0, "T")})`,
          )
        : `colorchannelmixer=aa=${t.opacity}`;
      graph.push(
        `[${i}:v]scale=${vw}:${vh}:force_original_aspect_ratio=decrease,setsar=1,format=rgba${keyFilter}${resetClock}${mask}${transforms}${sizeScale},${opacity}${fade ? ",fade=t=in:st=0:d=" + fade + ":alpha=1,fade=t=out:st=" + (span - fade) + ":d=" + fade + ":alpha=1" : ""},setpts=PTS-STARTPTS+${t.at}/TB[layer${i}]`,
      );
      const placement = `x='(W-w)*${curve(t.keys.x, t.x, t.at)}':y='(H-h)*${curve(t.keys.y, t.y, t.at)}':enable='between(t,${t.at},${t.at + span})':eof_action=pass:repeatlast=0`;
      graph.push(
        ...layerBlendGraph(
          video,
          "layer" + i,
          "composite" + i,
          placement,
          t.blendMode,
        ),
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
