import os from "node:os";

/**
 * Memory gate for heavy work. Job serialisation is done by the existing single in-process
 * queue (lib/jobs.ts: one active job at a time). This adds the missing piece: do not start
 * (or keep going) while the machine is short on free memory.
 */
export type ResourceSnapshot = {
  totalMb: number;
  freeMb: number;
  cpuCount: number;
  load1: number;
  /** Measured by Node; load average is always 0 on Windows. */
  loadMeasured: boolean;
};

export function snapshot(): ResourceSnapshot {
  return {
    totalMb: Math.round(os.totalmem() / 1048576),
    freeMb: Math.round(os.freemem() / 1048576),
    cpuCount: os.cpus().length,
    load1: os.loadavg()[0],
    loadMeasured: process.platform !== "win32",
  };
}

export const MIN_FREE_MB = Number(process.env.CLIPPER_MIN_FREE_MB) || 700;

/** Wait until free memory is above the threshold. Aborts with the signal; gives up after maxWaitMs. */
export async function waitForMemory(
  signal: AbortSignal,
  onWait?: (freeMb: number) => void,
  minFreeMb = MIN_FREE_MB,
  maxWaitMs = 10 * 60 * 1000,
  pollMs = 5000,
) {
  const started = Date.now();
  for (;;) {
    signal.throwIfAborted();
    const { freeMb } = snapshot();
    if (freeMb >= minFreeMb) return;
    if (Date.now() - started > maxWaitMs)
      throw Error(`Only ${freeMb} MB of memory is free (need ${minFreeMb} MB). Close other applications and retry.`);
    onWait?.(freeMb);
    await new Promise((r) => setTimeout(r, pollMs));
  }
}
