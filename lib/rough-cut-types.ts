import type { TimeRange, TranscriptCutState } from "./transcript-edit";

export type RoughCutPlan = {
  version: 1;
  title: string;
  why: string;
  ranges: TimeRange[];
  estimatedDuration: number;
};

export type { TimeRange, TranscriptCutState };
