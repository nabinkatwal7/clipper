import type { Track } from "./composition";

const round = (n: number) => Math.round(n * 1000) / 1000;

export type TrackGesture = "move" | "trim-start" | "trim-end";

/** Apply a composition-time drag to one track, moving grouped peers together. */
export function dragTrack(
  tracks: Track[],
  id: string,
  gesture: TrackGesture,
  delta: number,
  clipLength: number,
): Track[] {
  const target = tracks.find((track) => track.id === id);
  if (!target || target.locked || !Number.isFinite(delta) || !delta)
    return tracks;
  const peers = target.group
    ? tracks.filter((track) => track.group === target.group)
    : [target];
  if (peers.some((track) => track.locked)) return tracks;

  if (gesture === "move") {
    const shift = Math.max(
      -Math.min(...peers.map((track) => track.at)),
      Math.min(
        delta,
        ...peers.map((track) =>
          Math.max(0, clipLength - (track.at + track.length)),
        ),
      ),
    );
    if (!shift) return tracks;
    const ids = new Set(peers.map((track) => track.id));
    return tracks.map((track) =>
      ids.has(track.id) ? { ...track, at: round(track.at + shift) } : track,
    );
  }

  if (gesture === "trim-end") {
    const length = Math.max(
      0.04,
      Math.min(target.length + delta, clipLength - target.at, 600),
    );
    if (length === target.length) return tracks;
    return tracks.map((track) =>
      track.id === id ? { ...track, length: round(length) } : track,
    );
  }

  const maxShrink = target.length - 0.04;
  const slipRoom =
    target.type === "image" ? Infinity : Math.max(0, 43200 - target.slip);
  const trim = Math.max(
    -Math.min(target.at, slipRoom),
    Math.min(delta, maxShrink),
  );
  if (!trim) return tracks;
  return tracks.map((track) =>
    track.id === id
      ? {
          ...track,
          at: round(track.at + trim),
          length: round(track.length - trim),
          slip:
            track.type === "image"
              ? track.slip
              : round(Math.max(0, track.slip + trim)),
        }
      : track,
  );
}
