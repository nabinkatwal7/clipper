import type { Clip } from "./types";
export function postCaption(clip: Pick<Clip, "title" | "postCaption">) {
  return clip.postCaption?.trim() || clip.title.trim();
}
export function clipBasename(clip: Pick<Clip, "title" | "id">) {
  return `${
    clip.title
      .replace(/[^a-zA-Z0-9 -]/g, "")
      .slice(0, 80)
      .trim() || "clip"
  }-${clip.id.slice(0, 6)}`;
}
export function captionFile(clip: Pick<Clip, "title" | "postCaption">) {
  return postCaption(clip) + "\n";
}
