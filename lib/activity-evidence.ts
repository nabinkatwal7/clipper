import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import { file } from "./store";
export function chatBins(times: unknown, duration: number) {
  if (
    !Array.isArray(times) ||
    !times.length ||
    times.length > 200000 ||
    duration <= 0
  )
    throw Error(
      "Import a JSON array of up to 200,000 timestamps in recording seconds.",
    );
  const bins = Array<number>(120).fill(0);
  for (const time of times) {
    if (
      typeof time !== "number" ||
      !Number.isFinite(time) ||
      time < 0 ||
      time > duration
    )
      throw Error("Chat timestamps must fall within the recording.");
    bins[
      Math.min(bins.length - 1, Math.floor((time / duration) * bins.length))
    ]++;
  }
  return bins;
}
export async function saveChat(id: string, times: unknown, duration: number) {
  const counts = chatBins(times, duration),
    target = file("temp", id, "chat.json"),
    tmp = target + "." + randomUUID() + ".tmp";
  try {
    await fs.writeFile(tmp, JSON.stringify({ version: 1, counts }));
    await fs.rename(tmp, target);
  } finally {
    await fs.rm(tmp, { force: true });
  }
  return counts;
}
export async function evidence(id: string) {
  const get = async (ext: string) =>
    fs
      .readFile(file("temp", id, ext), "utf8")
      .then(JSON.parse)
      .catch((e: NodeJS.ErrnoException) => {
        if (e.code === "ENOENT") return null;
        throw e;
      });
  const [idx, chat] = await Promise.all([get("index.json"), get("chat.json")]);
  return {
    index: idx as { scenes: number[]; peaks: number[] } | null,
    chat: chat?.counts as number[] | undefined,
  };
}
export function windowEvidence(
  start: number,
  end: number,
  duration: number,
  idx: { scenes: number[]; peaks: number[] } | null,
  chat?: number[],
) {
  return Array.from(
    { length: Math.min(24, Math.max(1, Math.ceil((end - start) / 20))) },
    (_, i) => i,
  ).map((i, _, bins) => {
    const from = start + ((end - start) * i) / bins.length,
      to = start + ((end - start) * (i + 1)) / bins.length;
    const range = (v: number[]) =>
      v.slice(
        Math.floor((from / duration) * v.length),
        Math.ceil((to / duration) * v.length),
      );
    return {
      from: Math.round(from),
      to: Math.round(to),
      ...(idx
        ? {
            audioPeak: Math.max(0, ...range(idx.peaks)),
            sceneChanges: idx.scenes.filter((t) => t >= from && t < to).length,
          }
        : {}),
      ...(chat ? { chatActivity: range(chat).reduce((a, b) => a + b, 0) } : {}),
    };
  });
}
