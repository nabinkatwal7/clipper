import { z } from "zod";
import type { Candidate } from "./candidates";

/**
 * Autopilot definitions and the pure decision logic around them. Nothing here publishes
 * anywhere: a run ends with clips saved for human review.
 */
const id = z.string().regex(/^[a-zA-Z0-9-]{8,64}$/);

export const TriggerSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("manual") }),
  z.object({ kind: z.literal("new-video"), creatorId: id, intervalMinutes: z.number().int().min(30).max(10080).default(360) }),
  z.object({ kind: z.literal("file-arrival"), folder: z.string().trim().min(1).max(400), intervalMinutes: z.number().int().min(1).max(1440).default(5) }),
]);

export const AutopilotSchema = z.object({
  id,
  name: z.string().trim().min(1).max(80),
  enabled: z.boolean().default(false),
  trigger: TriggerSchema,
  profile: z.string().trim().max(40).default("general"),
  /** Language routing: first match on the source language picks the profile. */
  routes: z.array(z.object({ language: z.string().trim().min(1).max(20), profile: z.string().trim().max(40) })).max(20).default([]),
  count: z.number().int().min(1).max(20).default(5),
  minScore: z.number().min(0).max(1).default(0.3),
  campaignId: z.string().max(64).optional(),
  useAi: z.boolean().default(false),
  requireApproval: z.boolean().default(true),
  render: z.boolean().default(true),
  /** Branch: stop (not fail) when the source has no transcript. */
  requireTranscript: z.boolean().default(false),
  maxPerRun: z.number().int().min(1).max(5).default(1),
  lastRun: z.string().optional(),
  baselined: z.boolean().default(false),
  seen: z.array(z.string().max(300)).max(1000).default([]),
  pending: z.record(z.string(), z.number()).default({}),
});
export type Autopilot = z.infer<typeof AutopilotSchema>;

export const STEPS = ["import", "analyze", "ai", "select", "approval", "render", "validate"] as const;
export type StepName = (typeof STEPS)[number];
export type StepState = { name: StepName; status: "pending" | "running" | "done" | "skipped" | "failed"; detail?: string; at?: string };
export type Run = {
  id: string;
  autopilotId: string;
  autopilotName: string;
  startedAt: string;
  finishedAt?: string;
  status: "running" | "awaiting-approval" | "done" | "failed" | "cancelled";
  projectId?: string;
  source?: string;
  steps: StepState[];
  selected?: string[];
  compliance?: { clip: string; compliant: boolean; fail: number; needsReview: number }[];
  error?: string;
};

export const newRun = (ap: Autopilot, runId: string, source?: string, projectId?: string): Run => ({
  id: runId,
  autopilotId: ap.id,
  autopilotName: ap.name,
  startedAt: new Date().toISOString(),
  status: "running",
  projectId,
  source,
  steps: STEPS.map((name) => ({ name, status: "pending" as const })),
});

/** First step that still has to run, or null when everything is finished. */
export function resumePoint(run: Run): StepName | null {
  return run.steps.find((s) => s.status !== "done" && s.status !== "skipped")?.name ?? null;
}

export function isDue(ap: Autopilot, now = Date.now()): boolean {
  if (!ap.enabled || ap.trigger.kind === "manual") return false;
  const every = ap.trigger.intervalMinutes * 60_000;
  return !ap.lastRun || now - Date.parse(ap.lastRun) >= every;
}

export function chooseProfile(ap: Pick<Autopilot, "profile" | "routes">, language?: string): string {
  const lang = (language ?? "").toLowerCase();
  const hit = lang && ap.routes.find((r) => r.language.toLowerCase() === lang || lang.startsWith(r.language.toLowerCase() + "-"));
  return hit ? hit.profile : ap.profile;
}

export const VIDEO_EXT = /\.(mp4|mkv|mov|webm|avi|m4v|ts|flv)$/i;
export type Listing = { name: string; size: number; mtimeMs: number };
export const fileKey = (f: Listing) => `${f.name}:${f.size}:${Math.floor(f.mtimeMs)}`;

/**
 * File-arrival detection. A file is ready only when its size is unchanged since the previous
 * check (so a recording still being written is not imported half-finished) and it is new.
 */
export function readyFiles(listing: Listing[], previousSizes: Record<string, number>, seen: Set<string>) {
  const ready: Listing[] = [];
  const nextPending: Record<string, number> = {};
  for (const f of listing) {
    if (!VIDEO_EXT.test(f.name) || f.size <= 0 || seen.has(fileKey(f))) continue;
    if (previousSizes[f.name] === f.size) ready.push(f);
    else nextPending[f.name] = f.size;
  }
  return { ready, pending: nextPending };
}

/** Score-based filtering: drop rejected candidates, enforce the minimum score, take the best N in time order. */
export function pickCandidates(candidates: Candidate[], ap: Pick<Autopilot, "minScore" | "count">): Candidate[] {
  return candidates
    .filter((c) => c.review !== "rejected" && (c.rankScore ?? c.score) >= ap.minScore)
    .sort((a, b) => (b.rankScore ?? b.score) - (a.rankScore ?? a.score))
    .slice(0, ap.count)
    .sort((a, b) => a.start - b.start);
}

export const MAX_RUNS = 200;
export function trimSeen(seen: string[], add: string[]) {
  return [...new Set([...seen, ...add])].slice(-1000);
}
