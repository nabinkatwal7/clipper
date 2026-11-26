import { promises as fs } from "node:fs";
import { z } from "zod";
import { readCollection } from "./collection";
import { file, save, transcript } from "../store";
import { beginProgress, completeProgress, reporter } from "../progress";
import type { Project, Segment } from "../types";
import { chatTimeline, type ChatMessage } from "./chat";
import { generateCandidates, type Candidate, type Span } from "./candidates";
import { normalizeText, hypeTimeline, selectDictionaries, type HypeDictionary } from "./hype";
import {
  CHUNK_SECONDS,
  analyzeAudioChunk,
  analyzeVisualChunk,
  readJson,
  writeJsonAtomic,
  type AudioChunk,
  type VisualChunk,
} from "./media-analysis";
import { getProfile, type ContentProfile, type SignalId, type Weights } from "./profiles";
import { replayTimeline, type ReplayPoint } from "./replay";
import { combine, type Tracks } from "./scoring";
import { robustScale, suddenRise } from "./signals";
import { waitForMemory } from "./resources";
import { enrichCandidates, resolveModels, type AiMode } from "./ai";

export type RawSignals = {
  version: 1;
  interval: number;
  duration: number;
  audio?: { rmsDb: number[]; peakDb: number[]; silences: Span[] };
  visual?: { motion: number[]; cuts: number[] };
};

export type MomentOptions = {
  profile?: string;
  customProfiles?: ContentProfile[];
  weights?: Partial<Weights>;
  interval?: number;
  count?: number;
  minScore?: number;
  minDuration?: number;
  maxDuration?: number;
  chatOffset?: number;
  customDictionaries?: HypeDictionary[];
};

export type MomentsResult = {
  version: 1;
  mode: "instant";
  generatedAt: string;
  interval: number;
  duration: number;
  profile: { id: string; label: string; version: number };
  weights: Weights;
  effectiveWeights: Partial<Weights>;
  used: SignalId[];
  missing: SignalId[];
  uninformative: SignalId[];
  tracks: Partial<Record<SignalId | "combined", number[]>>;
  candidates: Candidate[];
  warnings: string[];
  hypeEvidence: { at: number; text: string; phrases: string[] }[];
  chat?: { totalMessages: number; perMinutePeak: number; offset: number };
  replayCoverage?: number;
  aiReport?: import("./ai").AiReport;
};

const r3 = (v: number[]) => v.map((x) => Math.round(x * 1000) / 1000);
const countWords = (t: string) => (t.match(/[\p{L}\p{N}]+/gu) || []).length;

/**
 * Pure moment computation from measured inputs. Everything that is absent is reported as
 * missing; nothing is synthesised.
 */
export function computeMoments(input: {
  duration: number;
  signals: RawSignals;
  segments?: Segment[];
  chat?: ChatMessage[];
  replay?: ReplayPoint[];
  options?: MomentOptions;
}): MomentsResult {
  const { duration, signals, segments = [], chat, replay } = input;
  const o = input.options ?? {};
  const profile = getProfile(o.profile, o.customProfiles);
  const interval = signals.interval;
  const bins = Math.max(1, Math.ceil(duration / interval));
  const weights: Weights = { ...profile.weights, ...(o.weights ?? {}) };
  const warnings: string[] = [];
  const tracks: Tracks = {};

  if (signals.audio) {
    const { rmsDb, peakDb } = signals.audio;
    const level = robustScale(rmsDb);
    const sudden = robustScale(suddenRise(rmsDb.map((x) => Math.max(x, -90))));
    // Digital silence is never "activity", whatever the baseline.
    tracks.audio = Array.from({ length: bins }, (_, i) => (peakDb[i] <= -90 ? 0 : 0.55 * (level[i] ?? 0) + 0.45 * (sudden[i] ?? 0)));
  } else warnings.push("No audio analysis: the source has no readable audio or analysis has not run.");

  if (signals.visual) {
    const cutRate = new Array<number>(bins).fill(0);
    for (const t of signals.visual.cuts) cutRate[Math.min(bins - 1, Math.floor(t / interval))]++;
    const motion = robustScale(signals.visual.motion);
    const cuts = robustScale(cutRate);
    tracks.visual = Array.from({ length: bins }, (_, i) => 0.7 * (motion[i] ?? 0) + 0.3 * (cuts[i] ?? 0));
  } else warnings.push("No visual analysis available.");

  let hypeEvidence: MomentsResult["hypeEvidence"] = [];
  const dictionaries = selectDictionaries(profile.hypeDictionaries, o.customDictionaries);
  if (segments.length) {
    const h = hypeTimeline(segments, duration, interval, dictionaries);
    tracks.hype = robustScale(h.values);
    hypeEvidence = h.evidence.map((e) => ({ at: e.at, text: e.text, phrases: e.hits.map((x) => x.phrase) }));
    const pace = new Array<number>(bins).fill(0);
    for (const s of segments) {
      const a = Math.max(0, Math.floor(s.start / interval));
      const b = Math.min(bins - 1, Math.max(a, Math.floor((s.end - 1e-6) / interval)));
      const words = countWords(s.text) / (b - a + 1);
      for (let i = a; i <= b; i++) pace[i] += words;
    }
    tracks.speech = robustScale(pace);
  } else warnings.push("No transcript or subtitles: hype-word and speech-pacing signals were skipped. Nothing was invented.");

  let chatInfo: MomentsResult["chat"];
  if (chat?.length) {
    const offset = o.chatOffset ?? 0;
    const c = chatTimeline(chat, offset, duration, interval, dictionaries);
    const rate = robustScale(c.rate);
    const unique = robustScale(c.unique);
    const reactions = robustScale(c.reactions);
    const repeated = robustScale(c.repeated);
    const hype = robustScale(c.hype);
    tracks.chat = Array.from({ length: bins }, (_, i) =>
      c.totalMessages ? 0.45 * rate[i] + 0.15 * unique[i] + 0.2 * reactions[i] + 0.1 * repeated[i] + 0.1 * hype[i] : 0,
    );
    chatInfo = { totalMessages: c.totalMessages, perMinutePeak: c.perMinutePeak, offset };
    if (!c.totalMessages) warnings.push("Imported chat has no messages inside the recording after applying the offset.");
  } else warnings.push("No chat data imported; chat signals unavailable.");

  let replayCoverage: number | undefined;
  if (replay?.length) {
    const r = replayTimeline(replay, duration, interval);
    const max = Math.max(...r.values) || 1;
    tracks.replay = r.values.map((v) => v / max);
    replayCoverage = r.coverage;
    if (r.coverage < 0.9) warnings.push(`Replay heatmap covers only ${Math.round(r.coverage * 100)}% of the recording.`);
  } else warnings.push("No replay heatmap imported; replay signal unavailable.");

  const mix = combine(tracks, weights, Math.max(1, Math.round(3 / interval)), bins);
  if (!mix.used.length) warnings.push("No informative signals were available; no candidates can be produced.");

  const candidates: Candidate[] = mix.used.length
    ? generateCandidates(
        mix.combined,
        tracks,
        mix.effectiveWeights,
        {
          segments: segments.map((s) => ({ start: s.start, end: s.end, text: s.text })),
          silences: signals.audio?.silences,
          scenes: signals.visual?.cuts,
        },
        {
          interval,
          minDuration: o.minDuration ?? profile.minDuration,
          maxDuration: o.maxDuration ?? profile.maxDuration,
          preContext: profile.preContext,
          postContext: profile.postContext,
          minScore: o.minScore ?? profile.minScore,
          minSpacing: profile.minSpacing,
          count: o.count ?? 5,
          boundary: profile.boundary,
        },
        duration,
      )
    : [];
  if (segments.length && (profile.includeWords?.length || profile.excludeWords?.length)) {
    const inc = (profile.includeWords ?? []).map((w) => normalizeText(w)).filter(Boolean);
    const exc = (profile.excludeWords ?? []).map((w) => normalizeText(w)).filter(Boolean);
    const kept = candidates.filter((c) => {
      const text = normalizeText(segments.filter((s) => s.end > c.start && s.start < c.end).map((s) => s.text).join(" "));
      return !exc.some((w) => text.includes(w)) && (!inc.length || inc.some((w) => text.includes(w)));
    });
    if (kept.length !== candidates.length) warnings.push(`${candidates.length - kept.length} candidate(s) removed by the profile's include/exclude words.`);
    candidates.splice(0, candidates.length, ...kept);
  } else if (profile.includeWords?.length || profile.excludeWords?.length) warnings.push("Include/exclude words were not applied: no transcript is available.");
  if (candidates.some((c) => c.precision === "duration-only"))
    warnings.push("Some candidates have no transcript, silence or scene evidence at their edges; boundaries are approximate.");
  if (mix.used.length === 1 && mix.used[0] === "audio")
    warnings.push("Scores rest on audio activity alone, which does not by itself show that a moment is interesting.");

  return {
    version: 1,
    mode: "instant",
    generatedAt: new Date().toISOString(),
    interval,
    duration,
    profile: { id: profile.id, label: profile.label, version: profile.version },
    weights,
    effectiveWeights: mix.effectiveWeights,
    used: mix.used,
    missing: mix.missing,
    uninformative: mix.uninformative,
    tracks: Object.fromEntries([...Object.entries(tracks), ["combined", mix.combined]].map(([k, v]) => [k, r3(v as number[])])),
    candidates,
    warnings,
    hypeEvidence: hypeEvidence.slice(0, 200),
    chat: chatInfo,
    replayCoverage,
  };
}

// ---------------------------------------------------------------- persistence + job

const sig = (id: string, kind: string, interval: number, n: number | "all") =>
  file("temp", id, `signals.${kind}.i${String(interval).replace(".", "_")}.${n}.json`);
export const momentsFile = (id: string) => file("temp", id, "moments.json");
export const chatFile = (id: string) => file("temp", id, "chat.messages.json");
export const replayFile = (id: string) => file("temp", id, "replay.points.json");

/** Resumable chunked analysis: a finished chunk is never recomputed after an interruption. */
export async function ensureSignals(
  p: Project,
  interval: number,
  signal: AbortSignal,
  progress: (done: number, total: number) => void,
): Promise<RawSignals> {
  const cached = await readJson<RawSignals>(sig(p.id, "raw", interval, "all"));
  if (cached && cached.duration === p.duration) return cached;
  const source = file("uploads", p.id, "mp4");
  const chunks = Math.ceil(p.duration / CHUNK_SECONDS);
  const audio: AudioChunk = { rmsDb: [], peakDb: [], silences: [] };
  const visual: VisualChunk = { motion: [], cuts: [] };
  const hasAudio = p.hasAudio !== false;
  for (let n = 0; n < chunks; n++) {
    signal.throwIfAborted();
    await waitForMemory(signal);
    const start = n * CHUNK_SECONDS;
    const length = Math.min(CHUNK_SECONDS, p.duration - start);
    if (hasAudio) {
      const a = (await readJson<AudioChunk>(sig(p.id, "audio", interval, n))) ?? (await analyzeAudioChunk(source, start, length, interval, signal));
      await writeJsonAtomic(sig(p.id, "audio", interval, n), a);
      audio.rmsDb.push(...a.rmsDb);
      audio.peakDb.push(...a.peakDb);
      audio.silences.push(...a.silences);
    }
    const v = (await readJson<VisualChunk>(sig(p.id, "visual", interval, n))) ?? (await analyzeVisualChunk(source, start, length, interval, signal));
    await writeJsonAtomic(sig(p.id, "visual", interval, n), v);
    visual.motion.push(...v.motion);
    visual.cuts.push(...v.cuts);
    progress(n + 1, chunks);
  }
  const bins = Math.ceil(p.duration / interval);
  const fit = (a: number[], fill: number) => (a.length >= bins ? a.slice(0, bins) : [...a, ...new Array<number>(bins - a.length).fill(fill)]);
  const raw: RawSignals = {
    version: 1,
    interval,
    duration: p.duration,
    ...(hasAudio ? { audio: { rmsDb: fit(audio.rmsDb, -120), peakDb: fit(audio.peakDb, -120), silences: audio.silences } } : {}),
    visual: { motion: fit(visual.motion, 0), cuts: visual.cuts },
  };
  await writeJsonAtomic(sig(p.id, "raw", interval, "all"), raw);
  for (let n = 0; n < chunks; n++)
    for (const k of ["audio", "visual"]) await fs.rm(sig(p.id, k, interval, n), { force: true });
  return raw;
}

export async function runMomentAnalysis(p: Project, options: MomentOptions, signal: AbortSignal) {
  const interval = options.interval ?? 1;
  if (![1, 2, 5, 10].includes(interval)) throw Error("Analysis interval must be 1, 2, 5 or 10 seconds.");
  p.stage = "indexing";
  p.status = "processing";
  p.detail = "Measuring audio, scene changes and motion";
  beginProgress(p, "indexing", p.detail, Math.ceil(p.duration / CHUNK_SECONDS), "chunks");
  await save(p);
  const prog = reporter(p, "indexing");
  const raw = await ensureSignals(p, interval, signal, (d, t) => prog.update(d, t, "chunks", `Analysed ${d} of ${t} chunks`));
  await prog.flush();
  const segments = await transcript(p.id).catch(() => [] as Segment[]);
  const chat = await readJson<ChatMessage[]>(chatFile(p.id));
  const replay = await readJson<ReplayPoint[]>(replayFile(p.id));
  const customProfiles = await readCollection<ContentProfile>("profiles");
  const result = computeMoments({ duration: p.duration, signals: raw, segments, chat: chat ?? undefined, replay: replay ?? undefined, options: { ...options, customProfiles } });
  await writeJsonAtomic(momentsFile(p.id), result);
  completeProgress(p, "indexing");
  p.status = "ready";
  p.stage = "complete";
  p.detail = `${result.candidates.length} candidate moments found without AI`;
  await save(p);
}

const OptionsSchema = z.object({
  profile: z.string().max(40).optional(),
  weights: z.record(z.enum(["audio", "chat", "replay", "hype", "visual", "speech"]), z.number().min(0).max(1)).optional(),
  interval: z.union([z.literal(1), z.literal(2), z.literal(5), z.literal(10)]).optional(),
  count: z.number().int().min(1).max(20).optional(),
  minScore: z.number().min(0).max(1).optional(),
  minDuration: z.number().min(3).max(300).optional(),
  maxDuration: z.number().min(5).max(600).optional(),
  chatOffset: z.number().min(-3600).max(3600).optional(),
});

/** Validate untrusted request options. */
export function parseMomentOptions(input: unknown): MomentOptions {
  const r = OptionsSchema.safeParse(input ?? {});
  if (!r.success) throw Error("Invalid moment options: " + r.error.issues.map((i) => i.path.join(".") + " " + i.message).join("; "));
  const o = r.data as MomentOptions;
  if (o.minDuration && o.maxDuration && o.maxDuration <= o.minDuration) throw Error("Maximum duration must exceed minimum duration.");
  return o;
}

/** Intelligent / Deep pass over an existing result. Any AI failure degrades to the measured result. */
export async function runMomentAi(p: Project, mode: AiMode, signal: AbortSignal, language?: string) {
  const current = await readJson<MomentsResult>(momentsFile(p.id));
  if (!current) throw Error("Run the moment analysis first.");
  p.stage = "analyzing";
  p.status = "processing";
  p.detail = mode === "deep" ? "Deep analysis of promising windows with local Ollama" : "Ranking promising windows with local Ollama";
  await save(p);
  const segments = await transcript(p.id).catch(() => [] as Segment[]);
  let out: MomentsResult;
  try {
    out = await enrichCandidates(current, segments, { mode, plan: await resolveModels(signal), signal, language });
  } catch (e) {
    if (signal.aborted) throw e;
    out = { ...current, aiReport: { mode, model: null, used: false, analysed: 0, skipped: [], notes: ["AI step failed (" + (e instanceof Error ? e.message : String(e)) + "); measured results were kept."] } };
  }
  await writeJsonAtomic(momentsFile(p.id), out);
  p.status = "ready";
  p.stage = "complete";
  p.detail = out.aiReport?.used ? `Ollama reviewed ${out.aiReport.analysed} candidate(s)` : "Ollama unavailable or skipped; measured results kept";
  await save(p);
}

/** Persist accept / reject / favorite decisions on candidates. */
export async function setReview(id: string, ids: string[], patch: { review?: "pending" | "accepted" | "rejected"; favorite?: boolean }) {
  const r = await readJson<MomentsResult>(momentsFile(id));
  if (!r) throw Error("No moment analysis for this project.");
  if (patch.review && !["pending", "accepted", "rejected"].includes(patch.review)) throw Error("Invalid review status.");
  for (const c of r.candidates) if (ids.includes(c.id)) Object.assign(c, patch);
  await writeJsonAtomic(momentsFile(id), r);
  return r;
}
