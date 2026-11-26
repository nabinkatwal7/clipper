import type { Clip, Segment, Settings } from "../types";
import type { ComplianceReport } from "./campaigns";

/**
 * Platform export presets. Dimensions and limits drift over time and are guidelines only:
 * they are advisory values the user can edit, and nothing here connects to any platform.
 */
export type PlatformPreset = {
  id: string;
  label: string;
  settings: Pick<Settings, "ratio" | "resolution" | "encodeProfile">;
  /** Advisory maximum length in seconds, or undefined when none is assumed. */
  maxSeconds?: number;
  note: string;
};

const CHECK = "Verify the platform's current requirements before publishing.";
export const PLATFORM_PRESETS: PlatformPreset[] = [
  { id: "youtube-shorts", label: "YouTube Shorts", settings: { ratio: "9:16", resolution: "1080", encodeProfile: "balanced" }, maxSeconds: 180, note: "Vertical 1080×1920. " + CHECK },
  { id: "instagram-reels", label: "Instagram Reels", settings: { ratio: "9:16", resolution: "1080", encodeProfile: "balanced" }, maxSeconds: 90, note: "Vertical 1080×1920. " + CHECK },
  { id: "tiktok", label: "TikTok", settings: { ratio: "9:16", resolution: "1080", encodeProfile: "balanced" }, maxSeconds: 180, note: "Vertical 1080×1920. " + CHECK },
  { id: "facebook-reels", label: "Facebook Reels", settings: { ratio: "9:16", resolution: "1080", encodeProfile: "balanced" }, maxSeconds: 90, note: "Vertical 1080×1920. " + CHECK },
  { id: "generic-vertical", label: "Generic vertical", settings: { ratio: "9:16", resolution: "1080", encodeProfile: "balanced" }, note: "No length assumption." },
  { id: "landscape", label: "Landscape compilation", settings: { ratio: "16:9", resolution: "1080", encodeProfile: "balanced" }, note: "1920×1080 for compilations." },
];

export function presetWarnings(preset: PlatformPreset, clip: Pick<Clip, "start" | "end" | "settings">): string[] {
  const out: string[] = [];
  const len = (clip.end - clip.start) / (clip.settings.playbackRate || 1);
  if (preset.maxSeconds && len > preset.maxSeconds) out.push(`${Math.round(len)}s is longer than the ${preset.maxSeconds}s guideline for ${preset.label}.`);
  if (clip.settings.ratio !== preset.settings.ratio) out.push(`Clip is ${clip.settings.ratio}; ${preset.label} preset uses ${preset.settings.ratio}.`);
  return out;
}

const hashtags = (text: string) => text.match(/#[\p{L}\p{N}_]+/gu) ?? [];

const mmss = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;

/**
 * Deterministic post-kit text files. Nothing is invented: the opening-line suggestion is
 * the first words actually spoken in the clip (when a transcript exists), labelled as such.
 */
export function postKitFiles(input: {
  clip: Pick<Clip, "title" | "postCaption" | "start" | "end" | "segments" | "settings" | "category">;
  sourceTitle: string;
  sourceUrl?: string;
  rights: { permission: string; creator: string; license: string; attribution: string; notes: string };
  language?: string;
  metadata?: { title: string; description: string; hashtags: string[]; source: "ollama" | "template" };
  compliance?: ComplianceReport;
  srt: (rows: Segment[]) => string;
}): Record<string, string> {
  const { clip, rights } = input;
  const title = input.metadata?.title || clip.title;
  const caption = clip.postCaption?.trim() || input.metadata?.description || clip.title;
  const tags = [...new Set([...hashtags(caption), ...(input.metadata?.hashtags ?? [])])];
  const firstLine = clip.segments.find((s) => s.text.trim())?.text.trim();
  const attribution = rights.attribution.trim() || (rights.creator ? `Source: ${rights.creator}${input.sourceUrl ? " — " + input.sourceUrl : ""}` : "");
  const files: Record<string, string> = {
    "title.txt": title + "\n",
    "description.txt": caption.replace(/#[\p{L}\p{N}_]+/gu, "").trim() + "\n",
    "hashtags.txt": tags.join(" ") + "\n",
    "pinned-comment.txt": "What stood out to you in this moment?\n",
    "attribution.txt": (attribution || "No attribution recorded. Confirm your rights before publishing.") + "\n",
    "captions-original.srt": input.srt(clip.segments),
    "metadata.json": JSON.stringify(
      {
        schemaVersion: 1,
        title,
        description: caption,
        hashtags: tags,
        metadataSource: input.metadata?.source ?? "clip title",
        suggestedOpeningLine: firstLine ? { text: firstLine, basis: "first words spoken in the clip" } : null,
        category: clip.category ?? null,
        language: input.language ?? "unspecified",
        source: { title: input.sourceTitle, url: input.sourceUrl ?? null, startsAt: mmss(clip.start), endsAt: mmss(clip.end), startSeconds: clip.start, endSeconds: clip.end },
        rights,
      },
      null,
      2,
    ),
  };
  if (input.compliance) files["compliance-report.json"] = JSON.stringify(input.compliance, null, 2);
  return files;
}
