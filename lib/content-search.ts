import { createHash, randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import { file, list, transcript } from "./store";
import { ledger } from "./production-store";
export type SearchOptions = {
  query: string;
  mode: "exact" | "fuzzy" | "semantic";
  model?: string;
  minScore?: number;
  maxScore?: number;
  minDuration?: number;
  favorite?: boolean;
  missingCaptions?: boolean;
  maxDuration?: number;
  after?: string;
  before?: string;
  status?: string;
  project?: string;
  scope?: "clips" | "transcripts" | "all";
};
export type SearchHit = {
  project: string;
  clip?: string;
  title: string;
  start: number;
  end: number;
  text: string;
  similarity?: number;
};
export function cosine(a: number[], b: number[]) {
  if (!a.length || a.length !== b.length) return 0;
  let d = 0,
    x = 0,
    y = 0;
  for (let i = 0; i < a.length; i++) {
    d += a[i] * b[i];
    x += a[i] * a[i];
    y += b[i] * b[i];
  }
  return x && y ? d / Math.sqrt(x * y) : 0;
}
async function embed(text: string[], model: string, signal: AbortSignal) {
  const r = await fetch(
    (process.env.OLLAMA_URL || "http://127.0.0.1:11434") + "/api/embed",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, input: text }),
      signal: AbortSignal.any([signal, AbortSignal.timeout(180000)]),
    },
  );
  if (!r.ok)
    throw Error(
      "Embedding request failed. Select an installed model supporting embeddings.",
    );
  const data = await r.json();
  if (
    !Array.isArray(data.embeddings) ||
    data.embeddings.length !== text.length ||
    data.embeddings.some(
      (v: unknown) =>
        !Array.isArray(v) ||
        !v.length ||
        v.some((n) => typeof n !== "number" || !Number.isFinite(n)),
    )
  )
    throw Error("Invalid embedding response");
  return data.embeddings as number[][];
}
export async function searchContent(s: SearchOptions, signal: AbortSignal) {
  if (
    typeof s.query !== "string" ||
    s.query.length > 500 ||
    !["exact", "fuzzy", "semantic"].includes(s.mode)
  )
    throw Error("Invalid search");
  const model = s.model || "";
  if (
    s.mode === "semantic" &&
    (!s.query.trim() || !model || model.length > 120)
  )
    throw Error("Enter a query and select a local embedding model.");
  const query = s.query.trim().toLowerCase();
  const projects = (await list()).filter(
    (p) =>
      (!s.project || s.project === p.id) &&
      (!s.after || p.createdAt.slice(0, 10) >= s.after) &&
      (!s.before || p.createdAt.slice(0, 10) <= s.before),
  );
  const vector =
    s.mode === "semantic" ? (await embed([query], model, signal))[0] : [];
  const result: SearchHit[] = [];
  for (const p of projects) {
    signal.throwIfAborted();
    const d = await ledger(p.id);
    const hits: SearchHit[] = [];
    if (s.scope !== "transcripts")
      for (const c of p.clips) {
        const rev = d.reviews[c.editorialId || c.id];
        if (
          (s.favorite && !rev?.favorite) ||
          (s.missingCaptions && c.segments.length > 0 && c.settings.captions) ||
          (s.maxScore !== undefined &&
            (c.score === null || c.score > s.maxScore)) ||
          (s.minDuration !== undefined && c.end - c.start < s.minDuration) ||
          (s.minScore ?? 0) > (c.score ?? 0) ||
          (s.maxDuration && c.end - c.start > s.maxDuration) ||
          (s.status && s.status !== (rev?.status || "unreviewed"))
        )
          continue;
        hits.push({
          project: p.id,
          clip: c.id,
          title: c.title,
          start: c.start,
          end: c.end,
          text: [
            p.title,
            c.reason,
            c.postCaption,
            c.category,c.settings.category,
            rev?.notes,
          ]
            .filter(Boolean)
            .join(" · "),
        });
      }
    if (
      s.scope !== "clips" &&
      !s.status &&
      !s.minScore &&
      s.maxScore === undefined &&
      !s.favorite &&
      !s.missingCaptions
    ) {
      const rows = await transcript(p.id).catch(() => []);
      for (let i = 0; i < rows.length;) {
        const start = rows[i].start;
        let end = start,
          text = "";
        do {
          end = rows[i].end;
          text += " " + rows[i++].text;
        } while (
          i < rows.length &&
          text.length < 650 &&
          rows[i].start - start < 60
        );
        if (
          (!s.maxDuration || end - start <= s.maxDuration) &&
          (!s.minDuration || end - start >= s.minDuration)
        )
          hits.push({
            project: p.id,
            title: p.title,
            start,
            end,
            text: text.trim(),
          });
      }
    }
    if (s.mode === "semantic") {
      for (let i = 0; i < hits.length; i += 16) {
        signal.throwIfAborted();
        const group = hits.slice(i, i + 16),
          texts = group.map((v) => v.title + "\n" + v.text);
        const key = createHash("sha256")
            .update(JSON.stringify([model, texts]))
            .digest("hex"),
          path = file("temp", p.id, key + ".embeddings.json");
        let vectors: number[][];
        try {
          vectors = JSON.parse(await fs.readFile(path, "utf8"));
        } catch {
          vectors = await embed(texts, model, signal);
          const tmp = path + "." + randomUUID() + ".tmp";
          try {
            await fs.writeFile(tmp, JSON.stringify(vectors));
            await fs.rename(tmp, path);
          } finally {
            await fs.rm(tmp, { force: true });
          }
        }
        group.forEach((h, j) =>
          result.push({ ...h, similarity: cosine(vector, vectors[j]) }),
        );
      }
    } else
      for (const h of hits) {
        const text = (h.title + " " + h.text).toLowerCase();
        let pos = -1;
        if (
          !query ||
          (s.mode === "exact"
            ? text.includes(query)
            : [...query].every((ch) => (pos = text.indexOf(ch, pos + 1)) >= 0))
        )
          result.push(h);
      }
  }
  if (s.mode === "semantic")
    result.sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0));
  return { total: result.length, hits: result.slice(0, 200) };
}
