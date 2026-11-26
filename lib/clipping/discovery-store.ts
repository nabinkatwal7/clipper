import { z } from "zod";
import { validateUrl } from "../network";
import { mutateCollection, readCollection, upsert } from "./collection";
import { addObservation, parseFeed, youtubeFeedUrl, type FeedItem, type TrackedVideo } from "./feeds";

export const CreatorSchema = z.object({
  id: z.string().regex(/^[a-zA-Z0-9-]{8,64}$/),
  name: z.string().trim().min(1).max(80),
  channelUrl: z.string().trim().max(300).default(""),
  feedUrl: z.string().trim().max(400).default(""),
  categories: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  language: z.string().trim().max(20).default(""),
  profile: z.string().trim().max(40).default(""),
  campaign: z.string().trim().max(64).default(""),
  intervalMinutes: z.number().int().min(30).max(10080).default(360),
  lastChecked: z.string().optional(),
  lastCheckStatus: z.string().max(300).optional(),
  lastSource: z.string().max(300).optional(),
});
export type Creator = z.infer<typeof CreatorSchema>;

export function parseCreator(input: unknown): Creator {
  const c = CreatorSchema.parse(input);
  for (const u of [c.channelUrl, c.feedUrl].filter(Boolean)) {
    const p = new URL(u);
    if (!/^https?:$/.test(p.protocol) || p.username || p.password) throw Error("Use a public http(s) URL without credentials.");
  }
  return c;
}

/** Where to look for new uploads, or why automatic discovery is unavailable. */
export function feedFor(c: Creator): { url?: string; unavailable?: string } {
  if (c.feedUrl) return { url: c.feedUrl };
  const y = c.channelUrl && youtubeFeedUrl(c.channelUrl);
  if (y) return { url: y };
  return {
    unavailable: c.channelUrl
      ? "No keyless feed is known for this URL. Add its RSS/Atom feed URL, or import videos from a CSV/JSON file."
      : "Add a channel URL or feed URL.",
  };
}

const MAX_BYTES = 2_000_000;

/** Fetch a public feed with per-hop SSRF validation, size and time limits. */
export async function fetchFeedText(url: string, signal?: AbortSignal): Promise<string> {
  let current = url;
  for (let hop = 0; hop < 4; hop++) {
    await validateUrl(current);
    const r = await fetch(current, {
      redirect: "manual",
      headers: { Accept: "application/atom+xml, application/rss+xml, application/xml, text/xml", "User-Agent": "ClipperStudio/1.0 (self-hosted)" },
      signal: AbortSignal.any([...(signal ? [signal] : []), AbortSignal.timeout(15000)]),
    });
    if (r.status >= 300 && r.status < 400 && r.headers.get("location")) {
      current = new URL(r.headers.get("location")!, current).href;
      continue;
    }
    if (!r.ok) throw Error(`Feed returned HTTP ${r.status}.`);
    const len = Number(r.headers.get("content-length") || 0);
    if (len > MAX_BYTES) throw Error("Feed is too large.");
    const reader = r.body?.getReader();
    if (!reader) throw Error("Empty feed response.");
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > MAX_BYTES) {
        await reader.cancel();
        throw Error("Feed is too large.");
      }
      chunks.push(value);
    }
    return Buffer.concat(chunks).toString("utf8");
  }
  throw Error("Too many redirects.");
}

export function videoKey(item: FeedItem) {
  return item.videoId || Buffer.from(item.url).toString("base64url").slice(0, 40);
}

export async function recordItems(creatorId: string, items: FeedItem[], source: string, at = new Date().toISOString()) {
  return mutateCollection<TrackedVideo, { added: number; updated: number }>("videos", (rows) => {
    let added = 0, updated = 0;
    for (const it of items) {
      const id = `${creatorId}:${videoKey(it)}`;
      let v = rows.find((r) => r.id === id);
      if (!v) {
        if (rows.length >= 5000) throw Error("Tracked video limit reached; remove old creators or videos.");
        v = { id, creatorId, title: it.title, url: it.url, published: it.published, thumbnail: it.thumbnail, source, observations: [] };
        rows.push(v);
        added++;
      }
      if (addObservation(v, { at, views: it.views, ratingCount: it.ratingCount })) updated++;
    }
    return { added, updated };
  });
}

/** Respectful polling: refuses to hit a creator's feed again before its interval has passed. */
export async function checkCreator(id: string, force = false, signal?: AbortSignal) {
  const creators = await readCollection<Creator>("creators");
  const c = creators.find((x) => x.id === id);
  if (!c) throw Error("Creator not found.");
  const now = Date.now();
  if (!force && c.lastChecked && now - Date.parse(c.lastChecked) < c.intervalMinutes * 60_000)
    return { skipped: true as const, reason: "Checked recently; next check allowed after the configured interval.", creator: c };
  const feed = feedFor(c);
  if (!feed.url) {
    const upd = { ...c, lastCheckStatus: feed.unavailable };
    await upsert("creators", upd);
    return { skipped: true as const, reason: feed.unavailable!, creator: upd };
  }
  try {
    const parsed = parseFeed(await fetchFeedText(feed.url, signal));
    const { added, updated } = await recordItems(c.id, parsed.items, feed.url);
    const upd = { ...c, lastChecked: new Date().toISOString(), lastCheckStatus: `ok · ${parsed.items.length} items, ${added} new`, lastSource: parsed.items[0]?.url ?? c.lastSource };
    await upsert("creators", upd);
    return { skipped: false as const, added, updated, creator: upd };
  } catch (e) {
    if (signal?.aborted) throw e;
    // Record the failure but leave lastChecked alone so a retry is not blocked by the interval.
    const upd = { ...c, lastCheckStatus: "failed · " + (e instanceof Error ? e.message : String(e)).slice(0, 200) };
    await upsert("creators", upd);
    throw Error(upd.lastCheckStatus!);
  }
}
