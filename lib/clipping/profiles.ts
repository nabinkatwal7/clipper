import { z } from "zod";

export const SIGNAL_IDS = ["audio", "chat", "replay", "hype", "visual", "speech"] as const;
export type SignalId = (typeof SIGNAL_IDS)[number];
export type Weights = Record<SignalId, number>;

/** Starting weights. Configurable defaults, not validated virality predictors. */
export const DEFAULT_WEIGHTS: Weights = {
  audio: 0.25,
  chat: 0.2,
  replay: 0.2,
  hype: 0.15,
  visual: 0.1,
  speech: 0.1,
};

export const ProfileSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().regex(/^[a-z0-9-]{1,40}$/),
  label: z.string().min(1).max(60),
  version: z.number().int().min(1),
  weights: z.object(Object.fromEntries(SIGNAL_IDS.map((s) => [s, z.number().min(0).max(1)])) as Record<SignalId, z.ZodNumber>),
  minDuration: z.number().min(3).max(300),
  maxDuration: z.number().min(5).max(600),
  preContext: z.number().min(0).max(60),
  postContext: z.number().min(0).max(60),
  minScore: z.number().min(0).max(1),
  minSpacing: z.number().min(0).max(600),
  /** transcript-first: snap to sentence/subtitle boundaries; media-first: silence and scene cuts. */
  boundary: z.enum(["transcript-first", "media-first"]),
  hypeDictionaries: z.array(z.string().max(30)).max(20).optional(),
  includeWords: z.array(z.string().max(60)).max(100).optional(),
  excludeWords: z.array(z.string().max(60)).max(100).optional(),
  layout: z.enum(["center", "blur", "crop", "facecam", "original"]),
  note: z.string().max(300).optional(),
});
export type ContentProfile = z.infer<typeof ProfileSchema>;

const w = (o: Partial<Weights>): Weights => ({ audio: 0, chat: 0, replay: 0, hype: 0, visual: 0, speech: 0, ...o });
type Seed = Omit<ContentProfile, "schemaVersion" | "version" | "minSpacing"> & { minSpacing?: number };
const seed = (s: Seed): ContentProfile => ({ schemaVersion: 1, version: 1, minSpacing: 20, ...s });

export const BUILTIN_PROFILES: ContentProfile[] = [
  seed({ id: "general", label: "General livestream", weights: DEFAULT_WEIGHTS, minDuration: 20, maxDuration: 60, preContext: 6, postContext: 8, minScore: 0.3, boundary: "transcript-first", layout: "center" }),
  seed({ id: "gaming", label: "Gaming", weights: w({ audio: 0.25, chat: 0.2, replay: 0.15, hype: 0.15, visual: 0.2, speech: 0.05 }), minDuration: 15, maxDuration: 45, preContext: 8, postContext: 6, minScore: 0.3, boundary: "media-first", hypeDictionaries: ["en", "gaming", "ne-latn", "hinglish"], layout: "facecam", note: "Detects activity patterns only; specific in-game events are not recognised." }),
  seed({ id: "podcast", label: "Podcast", weights: w({ audio: 0.1, chat: 0.1, replay: 0.2, hype: 0.15, visual: 0.0, speech: 0.45 }), minDuration: 30, maxDuration: 90, preContext: 5, postContext: 10, minScore: 0.25, boundary: "transcript-first", layout: "blur", note: "Quiet conversation is not penalised for lacking audio peaks." }),
  seed({ id: "interview", label: "Interview", weights: w({ audio: 0.1, chat: 0.1, replay: 0.2, hype: 0.1, visual: 0.05, speech: 0.45 }), minDuration: 30, maxDuration: 90, preContext: 6, postContext: 10, minScore: 0.25, boundary: "transcript-first", layout: "blur" }),
  seed({ id: "sports", label: "Sports", weights: w({ audio: 0.35, chat: 0.15, replay: 0.15, hype: 0.1, visual: 0.25 }), minDuration: 12, maxDuration: 45, preContext: 10, postContext: 8, minScore: 0.3, boundary: "media-first", layout: "center", note: "Crowd/commentary energy only; scoreboard and event recognition are not claimed." }),
  seed({ id: "movies", label: "Movies and series", weights: w({ audio: 0.15, hype: 0.1, visual: 0.3, speech: 0.45 }), minDuration: 20, maxDuration: 90, preContext: 3, postContext: 5, minScore: 0.25, boundary: "transcript-first", layout: "original", note: "Authorized footage only." }),
  seed({ id: "educational", label: "Educational", weights: w({ audio: 0.1, chat: 0.05, replay: 0.2, hype: 0.05, visual: 0.1, speech: 0.5 }), minDuration: 30, maxDuration: 120, preContext: 4, postContext: 10, minScore: 0.25, boundary: "transcript-first", layout: "blur" }),
  seed({ id: "tutorial", label: "Tutorial", weights: w({ audio: 0.05, replay: 0.2, hype: 0.05, visual: 0.25, speech: 0.45 }), minDuration: 30, maxDuration: 120, preContext: 4, postContext: 10, minScore: 0.25, boundary: "transcript-first", layout: "blur" }),
  seed({ id: "comedy", label: "Comedy", weights: w({ audio: 0.3, chat: 0.15, replay: 0.15, hype: 0.15, speech: 0.25 }), minDuration: 15, maxDuration: 60, preContext: 10, postContext: 6, minScore: 0.3, boundary: "transcript-first", layout: "center", note: "Laughter or loudness does not prove a complete joke; setup is kept via pre-context." }),
  seed({ id: "news", label: "News and commentary", weights: w({ audio: 0.1, chat: 0.1, replay: 0.2, hype: 0.1, visual: 0.05, speech: 0.45 }), minDuration: 25, maxDuration: 90, preContext: 4, postContext: 8, minScore: 0.25, boundary: "transcript-first", layout: "blur" }),
  seed({ id: "reaction", label: "Reaction videos", weights: w({ audio: 0.3, chat: 0.15, replay: 0.1, hype: 0.2, visual: 0.1, speech: 0.15 }), minDuration: 15, maxDuration: 60, preContext: 6, postContext: 6, minScore: 0.3, boundary: "transcript-first", layout: "facecam" }),
  seed({ id: "music", label: "Music performance", weights: w({ audio: 0.4, chat: 0.1, replay: 0.2, visual: 0.3 }), minDuration: 20, maxDuration: 60, preContext: 4, postContext: 6, minScore: 0.3, boundary: "media-first", layout: "center" }),
  seed({ id: "custom", label: "Custom", weights: DEFAULT_WEIGHTS, minDuration: 20, maxDuration: 60, preContext: 6, postContext: 8, minScore: 0.3, boundary: "transcript-first", layout: "center" }),
];

export function getProfile(id: string | undefined, custom: ContentProfile[] = []): ContentProfile {
  return [...custom, ...BUILTIN_PROFILES].find((p) => p.id === id) ?? BUILTIN_PROFILES[0];
}

/** Validate a user-authored profile. Throws a readable error on any invalid field. */
export function parseProfile(input: unknown): ContentProfile {
  const r = ProfileSchema.safeParse(input);
  if (!r.success) throw Error("Invalid profile: " + r.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; "));
  if (r.data.maxDuration <= r.data.minDuration) throw Error("Invalid profile: maxDuration must exceed minDuration");
  if (!Object.values(r.data.weights).some((x) => x > 0)) throw Error("Invalid profile: at least one weight must be above zero");
  return r.data;
}
