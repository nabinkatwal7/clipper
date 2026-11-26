import { promises as fs } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { workspaceRoot } from "./store";

export type CreatorMemory = {
  version: 1;
  id: string;
  name: string;
  updatedAt: string;
  topics: string[];
  names: string[];
  expressions: string[];
  jokes: string[];
  stories: string[];
  preferredStyles: string[];
  acceptedHighlights: string[];
  rejectedHighlights: string[];
  feedback: string[];
  languages: string[];
  glossary: { term: string; meaning: string }[];
};

function memoryPath(id: string) {
  return path.join(workspaceRoot(), "creator-memory", id + ".json");
}

export function emptyMemory(name: string): CreatorMemory {
  return {
    version: 1,
    id: randomUUID(),
    name: name.trim().slice(0, 120) || "Creator",
    updatedAt: new Date().toISOString(),
    topics: [],
    names: [],
    expressions: [],
    jokes: [],
    stories: [],
    preferredStyles: [],
    acceptedHighlights: [],
    rejectedHighlights: [],
    feedback: [],
    languages: [],
    glossary: [],
  };
}

export function validateMemory(input: unknown): CreatorMemory {
  if (!input || typeof input !== "object") throw Error("Invalid creator memory");
  const m = input as CreatorMemory;
  if (m.version !== 1 || typeof m.id !== "string" || !/^[0-9a-f-]{36}$/i.test(m.id))
    throw Error("Unsupported creator memory");
  if (typeof m.name !== "string" || !m.name.trim() || m.name.length > 120)
    throw Error("Invalid creator name");
  const lists: (keyof CreatorMemory)[] = [
    "topics",
    "names",
    "expressions",
    "jokes",
    "stories",
    "preferredStyles",
    "acceptedHighlights",
    "rejectedHighlights",
    "feedback",
    "languages",
  ];
  for (const key of lists) {
    const v = m[key];
    if (
      !Array.isArray(v) ||
      v.length > 200 ||
      v.some((x) => typeof x !== "string" || x.length > 400)
    )
      throw Error("Invalid memory field: " + key);
  }
  if (
    !Array.isArray(m.glossary) ||
    m.glossary.length > 200 ||
    m.glossary.some(
      (g) =>
        !g ||
        typeof g.term !== "string" ||
        typeof g.meaning !== "string" ||
        !g.term.trim() ||
        g.term.length > 80 ||
        g.meaning.length > 400,
    )
  )
    throw Error("Invalid glossary");
  return {
    ...m,
    name: m.name.trim(),
    topics: m.topics.map((t) => t.slice(0, 400)),
    names: m.names.map((t) => t.slice(0, 400)),
    expressions: m.expressions.map((t) => t.slice(0, 400)),
    jokes: m.jokes.map((t) => t.slice(0, 400)),
    stories: m.stories.map((t) => t.slice(0, 400)),
    preferredStyles: m.preferredStyles.map((t) => t.slice(0, 400)),
    acceptedHighlights: m.acceptedHighlights.map((t) => t.slice(0, 400)),
    rejectedHighlights: m.rejectedHighlights.map((t) => t.slice(0, 400)),
    feedback: m.feedback.map((t) => t.slice(0, 400)),
    languages: m.languages.map((t) => t.slice(0, 40)),
    glossary: m.glossary.map((g) => ({
      term: g.term.trim().slice(0, 80),
      meaning: g.meaning.trim().slice(0, 400),
    })),
    updatedAt: new Date().toISOString(),
  };
}

export async function listMemories() {
  const dir = path.join(workspaceRoot(), "creator-memory");
  await fs.mkdir(dir, { recursive: true });
  const names = await fs.readdir(dir);
  return Promise.all(
    names
      .filter((n) => n.endsWith(".json"))
      .map(async (n) =>
        validateMemory(
          JSON.parse(await fs.readFile(path.join(dir, n), "utf8")),
        ),
      ),
  );
}

export async function readMemory(id: string) {
  return validateMemory(
    JSON.parse(await fs.readFile(memoryPath(id), "utf8")),
  );
}

export async function saveMemory(input: CreatorMemory) {
  const m = validateMemory(input);
  const dir = path.join(workspaceRoot(), "creator-memory");
  await fs.mkdir(dir, { recursive: true });
  const tmp = memoryPath(m.id) + "." + randomUUID() + ".tmp";
  try {
    await fs.writeFile(tmp, JSON.stringify(m, null, 2));
    await fs.rename(tmp, memoryPath(m.id));
  } finally {
    await fs.rm(tmp, { force: true });
  }
  return m;
}

export async function deleteMemory(id: string) {
  await fs.rm(memoryPath(id), { force: true });
}

/** Merge user-editable evidence into memory — never claims model retraining. */
export function mergeEvidence(
  memory: CreatorMemory,
  patch: Partial<
    Pick<
      CreatorMemory,
      | "topics"
      | "names"
      | "expressions"
      | "jokes"
      | "stories"
      | "preferredStyles"
      | "feedback"
      | "languages"
      | "glossary"
    >
  >,
) {
  const next = { ...memory };
  for (const key of [
    "topics",
    "names",
    "expressions",
    "jokes",
    "stories",
    "preferredStyles",
    "feedback",
    "languages",
  ] as const) {
    if (patch[key])
      next[key] = [...new Set([...next[key], ...patch[key]!])].slice(0, 200);
  }
  if (patch.glossary)
    next.glossary = [...next.glossary, ...patch.glossary].slice(0, 200);
  return validateMemory(next);
}
