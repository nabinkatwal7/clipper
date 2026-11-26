import { normalizeText } from "./hype";

/**
 * Keyless discovery from public RSS/Atom feeds. Only fields present in the feed are recorded;
 * everything else stays undefined and is reported as missing. Nothing is estimated.
 */
export type FeedItem = {
  videoId?: string;
  title: string;
  url: string;
  published?: string;
  author?: string;
  thumbnail?: string;
  views?: number;
  likes?: number;
  ratingCount?: number;
};

const decode = (s: string) =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, e: string) => {
      if (e[0] === "#") {
        const code = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : "";
      }
      return ({ amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" } as Record<string, string>)[e.toLowerCase()] ?? "";
    })
    .trim();

const tag = (xml: string, name: string) => {
  const m = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i"));
  return m ? decode(m[1]) : undefined;
};
const attr = (xml: string, name: string, a: string) => {
  const m = xml.match(new RegExp(`<${name}\\s[^>]*?\\b${a}="([^"]*)"`, "i"));
  return m ? decode(m[1]) : undefined;
};
const int = (v: string | undefined) => (v !== undefined && /^\d{1,15}$/.test(v) ? Number(v) : undefined);

export const MAX_FEED_ITEMS = 100;

/** Parse Atom (YouTube-style, with media statistics) or RSS 2.0. */
export function parseFeed(xml: string): { title?: string; items: FeedItem[] } {
  if (!/<(feed|rss|channel)[\s>]/i.test(xml)) throw Error("This URL did not return an RSS or Atom feed.");
  const atom = /<feed[\s>]/i.test(xml);
  const blocks = xml.match(new RegExp(atom ? "<entry[\\s>][\\s\\S]*?</entry>" : "<item[\\s>][\\s\\S]*?</item>", "gi")) ?? [];
  const head = xml.slice(0, xml.search(new RegExp(atom ? "<entry[\\s>]" : "<item[\\s>]", "i")) >>> 0 || undefined);
  const items: FeedItem[] = [];
  for (const b of blocks.slice(0, MAX_FEED_ITEMS)) {
    const title = tag(b, "title");
    const url = atom ? attr(b, "link", "href") : tag(b, "link");
    if (!title || !url || !/^https?:\/\//i.test(url)) continue;
    items.push({
      videoId: tag(b, "yt:videoId"),
      title,
      url,
      published: tag(b, atom ? "published" : "pubDate") ?? tag(b, "updated"),
      author: tag(tag(b, "author") ?? "", "name") ?? tag(b, "author") ?? tag(b, "dc:creator"),
      thumbnail: attr(b, "media:thumbnail", "url"),
      views: int(attr(b, "media:statistics", "views")),
      likes: undefined, // the public feed exposes a star-rating count, not a like count
      ratingCount: int(attr(b, "media:starRating", "count")),
    });
  }
  return { title: tag(head, "title"), items };
}

/** Feed URL for a YouTube channel URL that contains the channel id. Handles (@name) need yt-dlp. */
export function youtubeFeedUrl(input: string): string | null {
  try {
    const u = new URL(input);
    if (u.hostname === "www.youtube.com" && u.pathname === "/feeds/videos.xml") return u.href;
    if (/(^|\.)youtube\.com$/.test(u.hostname)) {
      const id = u.pathname.match(/^\/channel\/(UC[\w-]{20,24})/)?.[1];
      if (id) return `https://www.youtube.com/feeds/videos.xml?channel_id=${id}`;
    }
  } catch {}
  return null;
}

export type Observation = { at: string; views?: number; ratingCount?: number };
export type TrackedVideo = {
  id: string; // creatorId:videoKey
  creatorId: string;
  title: string;
  url: string;
  published?: string;
  thumbnail?: string;
  source: string; // feed URL or "import"
  observations: Observation[];
};

export const MAX_OBSERVATIONS = 200;

/** Append an observation, skipping duplicates that carry no new information. */
export function addObservation(v: TrackedVideo, o: Observation) {
  const last = v.observations[v.observations.length - 1];
  if (last && last.views === o.views && last.ratingCount === o.ratingCount && Date.parse(o.at) - Date.parse(last.at) < 6 * 3600_000) return false;
  v.observations.push(o);
  if (v.observations.length > MAX_OBSERVATIONS) v.observations.splice(1, v.observations.length - MAX_OBSERVATIONS);
  return true;
}

export type Trend = {
  ageHours?: number;
  views?: number;
  /** Observed view change between the two most recent observations at least 10 minutes apart. */
  viewsPerHour?: number;
  observedSpanHours?: number;
  observations: number;
  observedAt?: string;
  stale: boolean;
  missing: string[];
  basis: string;
};

export function trendFor(v: TrackedVideo, now = Date.now(), staleHours = 24): Trend {
  const obs = v.observations.filter((o) => o.views !== undefined);
  const latest = v.observations[v.observations.length - 1];
  const missing: string[] = [];
  if (!v.published) missing.push("published date");
  if (!obs.length) missing.push("view count");
  let viewsPerHour: number | undefined;
  let span: number | undefined;
  if (obs.length >= 2) {
    const b = obs[obs.length - 1];
    const a = [...obs].reverse().find((o) => Date.parse(b.at) - Date.parse(o.at) >= 600_000);
    if (a) {
      span = (Date.parse(b.at) - Date.parse(a.at)) / 3600_000;
      viewsPerHour = ((b.views! - a.views!) / span);
    }
  }
  if (obs.length && viewsPerHour === undefined) missing.push("second observation (velocity needs two readings 10+ minutes apart)");
  const pub = v.published ? Date.parse(v.published) : NaN;
  return {
    ageHours: Number.isFinite(pub) ? Math.max(0, (now - pub) / 3600_000) : undefined,
    views: obs[obs.length - 1]?.views,
    viewsPerHour,
    observedSpanHours: span,
    observations: v.observations.length,
    observedAt: latest?.at,
    stale: !latest || now - Date.parse(latest.at) > staleHours * 3600_000,
    missing,
    basis: "Local observations of public feed data only; not a platform-wide ranking.",
  };
}

/** Recent upload frequency within the locally tracked set. */
export function uploadFrequency(videos: TrackedVideo[], now = Date.now()) {
  const days = (d: number) => videos.filter((v) => v.published && now - Date.parse(v.published) <= d * 86400_000).length;
  const dated = videos.filter((v) => v.published).length;
  return { last7: days(7), last30: days(30), tracked: videos.length, withDate: dated };
}

const STOP = new Set("the a an and or of to in on for with is are was were this that it you i we they my your our at as be by from how what why when who not no do does did vs".split(" "));

/** Plain token frequency over tracked titles — the evidence behind any AI topic summary. */
export function topicFrequency(titles: string[], top = 30) {
  const counts = new Map<string, number>();
  for (const t of titles) {
    const seen = new Set<string>();
    for (const w of normalizeText(t).split(" ")) {
      if (w.length < 3 || STOP.has(w) || /^\d+$/.test(w) || seen.has(w)) continue;
      seen.add(w);
      counts.set(w, (counts.get(w) ?? 0) + 1);
    }
  }
  return [...counts].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).slice(0, top).map(([word, count]) => ({ word, count }));
}

/** Import tracked videos from CSV or JSON the user supplies (columns: title, url, views, published). */
export function parseVideoImport(text: string, parseCsv: (s: string) => string[][]): FeedItem[] {
  const t = text.trim();
  let rows: Record<string, unknown>[];
  if (/^[[{]/.test(t)) {
    const d = JSON.parse(t);
    const l = Array.isArray(d) ? d : d?.videos ?? d?.items;
    if (!Array.isArray(l)) throw Error("JSON must be an array of videos.");
    rows = l;
  } else {
    const [h, ...r] = parseCsv(t);
    if (!h) throw Error("CSV is empty.");
    const names = h.map((x) => x.trim().toLowerCase());
    rows = r.map((row) => Object.fromEntries(names.map((n, i) => [n, row[i]])));
  }
  if (rows.length > 5000) throw Error("Import is limited to 5,000 rows.");
  const out: FeedItem[] = [];
  for (const r of rows) {
    const title = String(r.title ?? "").trim();
    const url = String(r.url ?? r.link ?? "").trim();
    if (!title || !/^https?:\/\//i.test(url)) continue;
    const views = r.views === undefined || r.views === "" ? undefined : Number(r.views);
    const pub = r.published ? new Date(String(r.published)) : null;
    out.push({
      title, url,
      views: views !== undefined && Number.isFinite(views) && views >= 0 ? Math.floor(views) : undefined,
      published: pub && !isNaN(pub.getTime()) ? pub.toISOString() : undefined,
    });
  }
  if (!out.length) throw Error("No usable rows: each needs a title and an http(s) url.");
  return out;
}
