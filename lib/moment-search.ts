import { promises as fs } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import path from "node:path";
import { searchContent, type SearchHit, type SearchOptions } from "./content-search";
import { workspaceRoot } from "./store";

export type SavedSearch = {
  id: string;
  name: string;
  query: string;
  mode: SearchOptions["mode"];
  model?: string;
  createdAt: string;
};

export type MomentQuery = SearchOptions & {
  languageHint?: string;
};

function savedPath() {
  return path.join(workspaceRoot(), "moment-searches.json");
}

export async function listSavedSearches(): Promise<SavedSearch[]> {
  try {
    const raw = JSON.parse(await fs.readFile(savedPath(), "utf8"));
    if (!Array.isArray(raw)) return [];
    return raw.filter(
      (s) =>
        s &&
        typeof s.id === "string" &&
        typeof s.name === "string" &&
        typeof s.query === "string",
    );
  } catch {
    return [];
  }
}

export async function saveSearch(input: {
  name: string;
  query: string;
  mode: SearchOptions["mode"];
  model?: string;
}) {
  if (
    typeof input.name !== "string" ||
    !input.name.trim() ||
    input.name.length > 80 ||
    typeof input.query !== "string" ||
    !input.query.trim() ||
    input.query.length > 500
  )
    throw Error("Invalid saved search");
  const rows = await listSavedSearches();
  const row: SavedSearch = {
    id: randomUUID(),
    name: input.name.trim(),
    query: input.query.trim(),
    mode: input.mode,
    model: input.model,
    createdAt: new Date().toISOString(),
  };
  const next = [row, ...rows].slice(0, 50);
  const tmp = savedPath() + "." + randomUUID() + ".tmp";
  try {
    await fs.writeFile(tmp, JSON.stringify(next));
    await fs.rename(tmp, savedPath());
  } finally {
    await fs.rm(tmp, { force: true });
  }
  return row;
}

export async function deleteSavedSearch(id: string) {
  const next = (await listSavedSearches()).filter((s) => s.id !== id);
  await fs.writeFile(savedPath(), JSON.stringify(next));
}

/**
 * Unified moment search across authorized workspace media.
 * Semantic mode requires an embedding-capable Ollama model.
 */
export async function momentSearch(
  query: MomentQuery,
  signal: AbortSignal,
): Promise<{
  hits: SearchHit[];
  fingerprint: string;
  note: string;
}> {
  const result = await searchContent(
    {
      query: query.query,
      mode: query.mode,
      model: query.model,
      minScore: query.minScore,
      maxScore: query.maxScore,
      minDuration: query.minDuration,
      maxDuration: query.maxDuration,
      favorite: query.favorite,
      missingCaptions: query.missingCaptions,
      after: query.after,
      before: query.before,
      status: query.status,
      project: query.project,
      scope: query.scope || "all",
    },
    signal,
  );
  const hits = result.hits;
  const fingerprint = createHash("sha256")
    .update(
      JSON.stringify({
        q: query.query,
        mode: query.mode,
        n: hits.length,
      }),
    )
    .digest("hex")
    .slice(0, 16);
  return {
    hits,
    fingerprint,
    note:
      query.mode === "semantic"
        ? "Semantic hits use local Ollama embeddings when available; scores are cosine similarity."
        : "Results are grounded in stored transcripts and clip metadata only.",
  };
}
