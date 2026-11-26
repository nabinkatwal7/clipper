import { uuid } from "./id";
import { TEXT_TRACK_ASSET } from "./types";
import type { Track } from "./composition";

export type ShapeKind = "rect" | "ellipse" | "line";

export function createShapeTrack(
  kind: ShapeKind,
  at: number,
  length: number,
  id = uuid(),
): Track {
  return {
    id,
    name: kind[0].toUpperCase() + kind.slice(1),
    type: "shape",
    asset: TEXT_TRACK_ASSET,
    shapeKind: kind,
    text: "",
    color: "#ffffff",
    fontSize: 64,
    at,
    length: Math.max(0.04, length),
    slip: 0,
    x: 0.5,
    y: 0.5,
    size: 0.35,
    opacity: 1,
    volume: 0,
    visible: true,
    muted: true,
    locked: false,
    solo: false,
    loop: false,
    fade: 0,
    keys: {},
  };
}

/** FFmpeg overlay draw for a shape layer (solid box / line). */
export function shapeFilter(track: Track, w: number, h: number) {
  const kind = track.shapeKind || "rect";
  const color = (track.color || "#ffffff").replace("#", "0x");
  const bw = Math.max(2, Math.round(w * track.size));
  const bh =
    kind === "line"
      ? Math.max(2, Math.round(h * 0.01))
      : Math.max(2, Math.round(h * track.size * 0.55));
  return `drawbox=x=(w-${bw})*${track.x}:y=(h-${bh})*${track.y}:w=${bw}:h=${bh}:color=${color}@${track.opacity}:t=fill`;
}
