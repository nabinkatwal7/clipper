// Real-Ollama smoke test for the optional AI layer: npx tsx --env-file=.env.local scripts/moments-ai-smoke.ts
import { computeMoments } from "../lib/clipping/engine";
import { enrichCandidates, resolveModels } from "../lib/clipping/ai";

const n = 200;
const rms = Array.from({ length: n }, (_, i) => -35 + (i % 4));
const peak = rms.map((x) => x + 6);
for (let i = 100; i < 106; i++) (rms[i] = -8), (peak[i] = -2);
const result = computeMoments({ duration: n, signals: { version: 1, interval: 1, duration: n, audio: { rmsDb: rms, peakDb: peak, silences: [] } }, options: { count: 1 } });
const segments = [
  { start: 92, end: 100, text: "So we finally reached the last boss after three hours of trying.", words: [] },
  { start: 100, end: 108, text: "No way, I actually did it! That was the craziest clutch ever, let's go!", words: [] },
  { start: 108, end: 114, text: "I can't believe it worked on the very last try.", words: [] },
];
async function main() {
const plan = await resolveModels();
  console.log("plan", { main: plan.main, light: plan.light, reachable: plan.reachable });
  const t = Date.now();
  const out = await enrichCandidates(result, segments, { mode: "intelligent", plan, signal: AbortSignal.timeout(240000) });
  console.log("seconds", (Date.now() - t) / 1000);
  console.log(JSON.stringify({ report: out.aiReport, c: out.candidates.map((c) => ({ id: c.id, score: c.score, ai: c.ai, metadata: c.metadata })) }, null, 1));
  
}
main();
