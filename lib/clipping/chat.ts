import { scoreText, normalizeText, type HypeDictionary } from "./hype";

export type ChatMessage = { t: number; text: string; user?: string };
export const MAX_CHAT_MESSAGES = 500_000;

function toSeconds(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
  const m = s.match(/^(?:(\d+):)?(\d{1,2}):(\d{1,2})(?:\.(\d+))?$/);
  if (!m) return null;
  return Number(m[1] || 0) * 3600 + Number(m[2]) * 60 + Number(m[3]) + (m[4] ? Number("0." + m[4]) : 0);
}

type Obj = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" ? v : "");

function fromObject(o: Obj): ChatMessage | null {
  const msg = o.message as Obj | string | undefined;
  const t = [o.content_offset_seconds, o.time_in_seconds, o.timestamp, o.offset, o.time, o.t, o.seconds]
    .map(toSeconds)
    .find((x) => x !== null && x !== undefined);
  if (t === undefined || t === null) return null;
  const text =
    str(o.text) || str(o.body) || (typeof msg === "string" ? msg : str(msg?.body) || str(msg?.text)) || str(o.content);
  const commenter = o.commenter as Obj | undefined;
  const author = o.author as Obj | string | undefined;
  const user =
    str(o.user) || str(o.username) || str(commenter?.name) || (typeof author === "string" ? author : str(author?.name));
  return { t, text, ...(user ? { user } : {}) };
}

/** Minimal RFC-4180-style parser (quoted fields, escaped quotes, CRLF). */
export function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (quoted) {
      if (c === '"' && input[i + 1] === '"') (cell += '"'), i++;
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") (row.push(cell), (cell = ""));
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && input[i + 1] === "\n") i++;
      row.push(cell);
      cell = "";
      if (row.some((x) => x !== "")) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x !== "")) rows.push(row);
  return rows;
}

/**
 * Parse an imported chat log. Accepts a JSON array of seconds, a JSON array of message
 * objects, a TwitchDownloader-style `{ comments: [...] }` document, or CSV with a header row.
 * Rows that cannot be read are counted, never invented.
 */
export function parseChat(input: string, format: "json" | "csv" | "auto" = "auto") {
  const trimmed = input.trim();
  const kind = format === "auto" ? (/^[[{]/.test(trimmed) ? "json" : "csv") : format;
  const messages: ChatMessage[] = [];
  let skipped = 0;
  const push = (m: ChatMessage | null) => {
    if (!m || m.t < 0) return void skipped++;
    if (messages.length >= MAX_CHAT_MESSAGES) throw Error(`Chat logs are limited to ${MAX_CHAT_MESSAGES.toLocaleString()} messages.`);
    messages.push(m);
  };
  if (kind === "json") {
    const doc = JSON.parse(trimmed) as unknown;
    const list = Array.isArray(doc) ? doc : (doc as Obj)?.comments ?? (doc as Obj)?.messages;
    if (!Array.isArray(list)) throw Error("Chat JSON must be an array or contain a comments/messages array.");
    for (const row of list) {
      if (typeof row === "number") push({ t: row, text: "" });
      else if (row && typeof row === "object") push(fromObject(row as Obj));
      else skipped++;
    }
  } else {
    const [header, ...rows] = parseCsv(trimmed);
    if (!header) throw Error("Chat CSV is empty.");
    const names = header.map((h) => h.trim().toLowerCase());
    const col = (...keys: string[]) => names.findIndex((n) => keys.includes(n));
    const ti = col("time", "timestamp", "t", "offset", "seconds", "time_in_seconds", "content_offset_seconds");
    if (ti < 0) throw Error("Chat CSV needs a time, timestamp or offset column.");
    const mi = col("text", "message", "body", "content");
    const ui = col("user", "username", "author", "name");
    for (const r of rows) {
      const t = toSeconds(r[ti]);
      push(t === null ? null : { t, text: mi >= 0 ? r[mi] ?? "" : "", ...(ui >= 0 && r[ui] ? { user: r[ui] } : {}) });
    }
  }
  if (!messages.length) throw Error("No readable chat messages were found.");
  messages.sort((a, b) => a.t - b.t);
  return { messages, skipped };
}

const REACTION = /^(lul|lmao|lol|kekw|omegalul|pog|pogchamp|pogg+|kappa|gg|ez|wow|haha+|hehe+|f|rip)$/i;
const EMOJI = /\p{Extended_Pictographic}/gu;

export type ChatTimeline = {
  interval: number;
  rate: number[];
  unique: number[];
  reactions: number[];
  repeated: number[];
  hype: number[];
  perMinutePeak: number;
  totalMessages: number;
  hasText: boolean;
};

/**
 * Per-interval chat measurements aligned to source time.
 * `offset` (seconds) is added to every message time: positive when chat is behind the video.
 */
export function chatTimeline(
  messages: ChatMessage[],
  offset: number,
  duration: number,
  interval: number,
  dictionaries: HypeDictionary[] = [],
): ChatTimeline {
  const bins = Math.max(1, Math.ceil(duration / interval));
  const z = () => new Array<number>(bins).fill(0);
  const rate = z(), reactions = z(), repeated = z(), hype = z();
  const users = Array.from({ length: bins }, () => new Set<string>());
  const hasText = messages.some((m) => m.text);
  const byText = new Map<string, { bin: number; t: number }[]>();
  let counted = 0;
  for (const m of messages) {
    const t = m.t + offset;
    if (t < 0 || t >= duration) continue;
    const i = Math.min(bins - 1, Math.floor(t / interval));
    counted++;
    rate[i]++;
    if (m.user) users[i].add(m.user);
    if (!m.text) continue;
    reactions[i] += (m.text.match(EMOJI) || []).length;
    for (const w of m.text.split(/\s+/)) if (REACTION.test(w)) reactions[i]++;
    if (dictionaries.length) hype[i] += scoreText(m.text, dictionaries).score;
    const key = normalizeText(m.text).slice(0, 40);
    if (key.length > 1) {
      const list = byText.get(key) ?? [];
      list.push({ bin: i, t });
      byText.set(key, list);
    }
  }
  // A message is "repeated" if the same text appears at least 3 times within 10 seconds.
  for (const list of byText.values()) {
    if (list.length < 3) continue;
    let lo = 0;
    for (let hi = 0; hi < list.length; hi++) {
      while (list[hi].t - list[lo].t > 10) lo++;
      if (hi - lo + 1 >= 3) repeated[list[hi].bin]++;
    }
  }
  let perMinutePeak = 0;
  const perMin = Math.max(1, Math.round(60 / interval));
  let run = 0;
  for (let i = 0; i < bins; i++) {
    run += rate[i] - (i >= perMin ? rate[i - perMin] : 0);
    perMinutePeak = Math.max(perMinutePeak, run);
  }
  return {
    interval,
    rate,
    unique: users.map((u) => u.size),
    reactions,
    repeated,
    hype,
    perMinutePeak,
    totalMessages: counted,
    hasText,
  };
}
