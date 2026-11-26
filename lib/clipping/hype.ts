import type { Segment } from "../types";
import { mean } from "./signals";

/**
 * Multilingual excitement / reaction dictionaries.
 * These are starting vocabularies, not exhaustive or validated lexicons.
 * A hit contributes to the combined score; it never decides clip quality alone.
 */
export type HypePhrase = { text: string; weight: number };
export type HypeDictionary = {
  id: string;
  label: string;
  languages: string[];
  phrases: HypePhrase[];
};
const p = (weight: number, ...texts: string[]): HypePhrase[] =>
  texts.map((text) => ({ text, weight }));

export const BUILTIN_DICTIONARIES: HypeDictionary[] = [
  {
    id: "en",
    label: "English",
    languages: ["en"],
    phrases: [
      ...p(1, "no way", "oh my god", "oh my gosh", "that's crazy", "thats crazy", "let's go", "lets go", "what happened", "are you kidding", "holy"),
      ...p(0.8, "incredible", "unbelievable", "insane", "amazing", "wow", "oh no", "what the", "wait what"),
      ...p(0.5, "really", "seriously", "nice", "yes"),
    ],
  },
  {
    id: "ne",
    label: "Nepali (Devanagari)",
    languages: ["ne"],
    phrases: [
      ...p(1, "के भयो", "हे भगवान", "अचम्मै भयो", "साच्चै", "दामी"),
      ...p(0.8, "गजब", "कस्तो रमाइलो", "ए हो", "लौ"),
    ],
  },
  {
    id: "ne-latn",
    label: "Romanized Nepali",
    languages: ["ne-Latn"],
    phrases: [
      ...p(1, "k bhayo", "ke bhayo", "he bhagwan", "sachhai", "sacchai", "dami", "kasto ramailo"),
      ...p(0.8, "gajab", "ho ra", "lau", "aachamma", "achamma"),
    ],
  },
  {
    id: "hi",
    label: "Hindi (Devanagari)",
    languages: ["hi"],
    phrases: [
      ...p(1, "क्या हुआ", "ऐसा नहीं हो सकता", "सच में", "हे भगवान", "अरे बाप रे"),
      ...p(0.8, "कमाल", "गजब", "ग़ज़ब", "जबरदस्त", "ज़बरदस्त", "क्या बात"),
    ],
  },
  {
    id: "hinglish",
    label: "Hinglish / Romanized Hindi",
    languages: ["hi-Latn"],
    phrases: [
      ...p(1, "kya hua", "aisa nahi ho sakta", "sach mein", "sach me", "arre baap re", "he bhagwan"),
      ...p(0.8, "kamaal", "gajab", "zabardast", "jabardast", "kya baat"),
    ],
  },
  {
    id: "ur",
    label: "Urdu",
    languages: ["ur"],
    phrases: [
      ...p(1, "یہ کیا ہوا", "ہو ہی نہیں سکتا", "یا اللہ", "سچ میں"),
      ...p(0.8, "کمال", "غضب", "زبردست", "ماشاءاللہ"),
    ],
  },
  {
    id: "bn",
    label: "Bengali",
    languages: ["bn"],
    phrases: [
      ...p(1, "কি হলো", "হায় ভগবান", "সত্যি নাকি", "বলো কি"),
      ...p(0.8, "দারুণ", "অসাধারণ", "দুর্দান্ত", "কি কান্ড"),
    ],
  },
  {
    id: "es",
    label: "Spanish",
    languages: ["es"],
    phrases: [
      ...p(1, "no puede ser", "dios mío", "dios mio", "qué locura", "que locura", "vamos", "qué pasó", "que paso"),
      ...p(0.8, "increíble", "increible", "impresionante", "guau", "no me lo creo"),
    ],
  },
  {
    id: "gaming",
    label: "Gaming terms",
    languages: ["en"],
    phrases: [
      ...p(1, "clutch", "ace", "pentakill", "headshot", "wipe", "one tap", "let's gooo"),
      ...p(0.7, "gg", "rip", "noooo", "close one", "so close", "diff", "cracked"),
    ],
  },
];

/** NFKC, lowercase, fold Latin diacritics only (keeps Indic/Arabic marks), strip punctuation. */
export function normalizeText(input: string): string {
  return input
    .normalize("NFKC")
    .toLowerCase()
    .normalize("NFD")
    .replace(/(\p{Script=Latin})\p{Mn}+/gu, "$1")
    .normalize("NFC")
    .replace(/[\p{P}\p{S}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const NO_SPACE_SCRIPTS = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Thai}]/u;
type Compiled = { phrase: HypePhrase; norm: string; re?: RegExp }[];
const cache = new WeakMap<HypeDictionary, Compiled>();

function compile(d: HypeDictionary): Compiled {
  let c = cache.get(d);
  if (c) return c;
  c = d.phrases
    .map((phrase) => ({ phrase, norm: normalizeText(phrase.text) }))
    .filter((x) => x.norm)
    .map((x) => ({
      ...x,
      re: NO_SPACE_SCRIPTS.test(x.norm)
        ? undefined
        : new RegExp(
            `(?<![\\p{L}\\p{M}\\p{N}])${x.norm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}\\p{M}\\p{N}])`,
            "gu",
          ),
    }));
  cache.set(d, c);
  return c;
}

export type HypeHit = { phrase: string; dictionary: string; count: number; weight: number };

/** Mixed-language matching: every supplied dictionary is applied to the same text. */
export function scoreText(text: string, dictionaries: HypeDictionary[]) {
  const norm = normalizeText(text);
  const hits: HypeHit[] = [];
  let score = 0;
  if (!norm) return { score, hits };
  for (const d of dictionaries)
    for (const { phrase, norm: n, re } of compile(d)) {
      let count = 0;
      if (re) {
        re.lastIndex = 0;
        count = (norm.match(re) || []).length;
      } else {
        for (let i = norm.indexOf(n); i >= 0; i = norm.indexOf(n, i + n.length)) count++;
      }
      if (!count) continue;
      // Repeated expressions get diminishing returns, not linear credit.
      score += phrase.weight * (1 + 0.5 * Math.log2(count));
      hits.push({ phrase: phrase.text, dictionary: d.id, count, weight: phrase.weight });
    }
  return { score, hits };
}

export function selectDictionaries(
  ids: string[] | undefined,
  custom: HypeDictionary[] = [],
): HypeDictionary[] {
  const all = [...BUILTIN_DICTIONARIES, ...custom];
  if (!ids) return all.filter((d) => d.id !== "gaming");
  return all.filter((d) => ids.includes(d.id));
}

/** Spread each transcript segment's hype score over the interval bins it overlaps. */
export function hypeTimeline(
  segments: Pick<Segment, "start" | "end" | "text">[],
  duration: number,
  interval: number,
  dictionaries: HypeDictionary[],
) {
  const bins = Math.max(1, Math.ceil(duration / interval));
  const values = new Array<number>(bins).fill(0);
  const evidence: { at: number; text: string; hits: HypeHit[] }[] = [];
  for (const s of segments) {
    const { score, hits } = scoreText(s.text, dictionaries);
    if (!score) continue;
    const a = Math.max(0, Math.floor(s.start / interval));
    const b = Math.min(bins - 1, Math.max(a, Math.floor((s.end - 1e-6) / interval)));
    for (let i = a; i <= b; i++) values[i] += score / (b - a + 1);
    evidence.push({ at: s.start, text: s.text.slice(0, 160), hits });
  }
  return { values, evidence, density: mean(values) };
}
