import { save } from "./store";
import type { Project, ProcessingStage, StageProgress } from "./types";
export function beginProgress(
  p: Project,
  stage: ProcessingStage,
  detail: string,
  total = 0,
  unit: StageProgress["unit"] = "steps",
) {
  p.progress ??= {};
  const previous = p.progress[p.stage as ProcessingStage];
  if (p.stage !== stage && previous?.state === "active") {
    previous.state = "complete";
    previous.current = previous.total;
    previous.updatedAt = new Date().toISOString();
  }
  const now = new Date().toISOString();
  p.progress[stage] = {
    current: 0,
    total,
    unit,
    state: "active",
    detail,
    startedAt: now,
    updatedAt: now,
  };
}
export function completeProgress(p: Project, stage: ProcessingStage) {
  const data = p.progress?.[stage];
  if (data) {
    data.state = "complete";
    data.current = data.total;
    data.updatedAt = new Date().toISOString();
  }
}
export function reporter(p: Project, stage: ProcessingStage) {
  let writes = Promise.resolve(),
    last = 0;
  return {
    update(
      current: number,
      total: number,
      unit: StageProgress["unit"],
      detail: string,
      etaSeconds?: number,
    ) {
      p.progress ??= {};
      const now = new Date().toISOString();
      const previous = p.progress[stage];
      p.progress[stage] = {
        current: Math.max(
          previous?.current || 0,
          Math.max(0, Math.min(current, total || current)),
        ),
        total,
        unit,
        detail,
        state: "active",
        startedAt: previous?.startedAt || now,
        updatedAt: now,
        etaSeconds,
      };
      p.detail = detail;
      if (Date.now() - last >= 1000) {
        last = Date.now();
        // A transient Windows sharing violation must not poison every later update.
        // flush() still propagates a persistent failure through the job error path.
        writes = writes.then(() => save(p)).catch(() => {});
      }
    },
    async flush() {
      await writes;
      await save(p);
    },
  };
}
export function ffmpegSeconds(line: string) {
  const match = /^out_time_(?:us|ms)=(\d+)/.exec(line);
  return match ? Number(match[1]) / 1_000_000 : undefined;
}
