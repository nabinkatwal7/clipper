import { promises as fs } from "node:fs";
import path from "node:path";
import { uuid } from "./id";
import { workspaceRoot } from "./store";

export type AiLabPrompt = {
  version: 1;
  id: string;
  name: string;
  system: string;
  user: string;
  model?: string;
  updatedAt: string;
};

export type AiLabRun = {
  id: string;
  promptId: string;
  model: string;
  output: string;
  createdAt: string;
};

function promptsPath() {
  return path.join(workspaceRoot(), "ai-lab-prompts.json");
}

function runsPath() {
  return path.join(workspaceRoot(), "ai-lab-runs.json");
}

export function emptyPrompt(name = "Untitled prompt"): AiLabPrompt {
  return {
    version: 1,
    id: uuid(),
    name: name.slice(0, 80),
    system:
      "You are a local editing assistant for Clipper Studio. Stay factual and concise.",
    user: "Suggest three tighter titles for a gaming highlight about a clutch play.",
    updatedAt: new Date().toISOString(),
  };
}

export function validatePrompt(input: unknown): AiLabPrompt {
  const p = input as AiLabPrompt;
  if (
    !p ||
    p.version !== 1 ||
    typeof p.id !== "string" ||
    !/^[0-9a-f-]{36}$/i.test(p.id) ||
    typeof p.name !== "string" ||
    !p.name.trim() ||
    p.name.length > 80 ||
    typeof p.system !== "string" ||
    p.system.length > 4000 ||
    typeof p.user !== "string" ||
    !p.user.trim() ||
    p.user.length > 8000
  )
    throw Error("Invalid AI lab prompt");
  return {
    version: 1,
    id: p.id,
    name: p.name.trim(),
    system: p.system,
    user: p.user.trim(),
    model: typeof p.model === "string" ? p.model.slice(0, 80) : undefined,
    updatedAt: new Date().toISOString(),
  };
}

export async function listPrompts(): Promise<AiLabPrompt[]> {
  try {
    const raw = JSON.parse(await fs.readFile(promptsPath(), "utf8"));
    if (!Array.isArray(raw) || !raw.length) return [emptyPrompt("Default")];
    return raw.map((p) => validatePrompt(p)).slice(0, 40);
  } catch {
    return [emptyPrompt("Default")];
  }
}

export async function savePrompt(prompt: AiLabPrompt) {
  const row = validatePrompt(prompt);
  const rows = await listPrompts();
  const next = [row, ...rows.filter((r) => r.id !== row.id)].slice(0, 40);
  const tmp = promptsPath() + "." + uuid() + ".tmp";
  try {
    await fs.writeFile(tmp, JSON.stringify(next, null, 2));
    await fs.rename(tmp, promptsPath());
  } finally {
    await fs.rm(tmp, { force: true });
  }
  return row;
}

export async function listRuns(): Promise<AiLabRun[]> {
  try {
    const raw = JSON.parse(await fs.readFile(runsPath(), "utf8"));
    return Array.isArray(raw) ? raw.slice(0, 50) : [];
  } catch {
    return [];
  }
}

export async function appendRun(run: AiLabRun) {
  const rows = await listRuns();
  rows.unshift(run);
  const tmp = runsPath() + "." + uuid() + ".tmp";
  try {
    await fs.writeFile(tmp, JSON.stringify(rows.slice(0, 50), null, 2));
    await fs.rename(tmp, runsPath());
  } finally {
    await fs.rm(tmp, { force: true });
  }
  return run;
}

/** Run a free-text Ollama generate (not JSON mode). */
export async function runPrompt(
  prompt: AiLabPrompt,
  model: string,
  signal?: AbortSignal,
) {
  const p = validatePrompt(prompt);
  const chosen = (model || p.model || process.env.OLLAMA_MODEL || "llama3.2").slice(
    0,
    80,
  );
  const text = `${p.system.trim()}\n\nUser:\n${p.user.trim()}\n\nAssistant:`;
  const r = await fetch(
    (process.env.OLLAMA_URL || "http://127.0.0.1:11434") + "/api/generate",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: chosen,
        prompt: text,
        stream: false,
        options: { temperature: 0.4, num_ctx: 4096, num_predict: 800 },
      }),
      signal: AbortSignal.any([
        signal || AbortSignal.timeout(240000),
        AbortSignal.timeout(240000),
      ]),
    },
  );
  if (!r.ok) throw Error("Ollama could not complete this lab run");
  const data = await r.json();
  if (typeof data.response !== "string")
    throw Error("Incomplete Ollama response");
  const output = data.response.slice(0, 12000);
  const run: AiLabRun = {
    id: uuid(),
    promptId: p.id,
    model: chosen,
    output,
    createdAt: new Date().toISOString(),
  };
  await appendRun(run);
  await savePrompt(p);
  return run;
}
