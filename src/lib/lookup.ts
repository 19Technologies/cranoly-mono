// "Explain a word": meanings, examples and grammatical gender from Wiktionary.
// Only the looked-up word is sent, and only when the user asks for it.
import type { Language } from "./languages";

interface Sense {
  text: string;
  example?: { text: string; translation?: string };
}

interface Entry {
  partOfSpeech: string;
  senses: Sense[];
  /** For inflected forms ("ging"), the dictionary form ("gehen"). */
  formOf?: string;
}

export interface Lookup {
  /** The spelling Wiktionary knows the word by ("hund" → "Hund"). */
  word: string;
  entries: Entry[];
  gender?: "m" | "f" | "n";
  url: string;
}

export class LookupError extends Error {}

const API = "https://en.wiktionary.org";
const cache = new Map<string, Promise<Lookup | null>>();

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'", nbsp: " ", ndash: "\u2013", mdash: "\u2014" };
function text(html: string) {
  return html
    // Some definitions carry their template's CSS inline ("house", "water"): drop it with its tags.
    .replace(/<(style|script)\b[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&(amp|lt|gt|quot|#39|nbsp|ndash|mdash);/g, (_m, e: string) => ENTITIES[e])
    .replace(/&#(\d+);/g, (_m, n: string) => String.fromCharCode(Number(n)))
    // No long dashes in your notes: "1990 to 2000", and a comma where a dash joined two phrases.
    .replace(/(\d)\u2013(\d)/g, "$1 to $2")
    .replace(/\s*[\u2013\u2014]\s*/g, ", ")
    .replace(/\s+/g, " ")
    .trim();
}

interface RawDefinition {
  definition: string;
  parsedExamples?: Array<{ example: string; translation?: string }>;
  examples?: string[];
}
interface RawEntry {
  partOfSpeech: string;
  definitions: RawDefinition[];
}

async function get(url: string) {
  let res: Response;
  try {
    res = await fetch(url);
  } catch {
    throw new LookupError("offline");
  }
  if (res.status === 404) return null;
  if (!res.ok) throw new LookupError(`status ${res.status}`);
  return res.json();
}

function parseEntries(raw: RawEntry[]): Entry[] {
  return raw
    .map((e) => {
      let formOf: string | undefined;
      const senses: Sense[] = [];
      for (const d of e.definitions) {
        const link = /class="form-of-definition-link"[\s\S]*?title="([^"]+)"/.exec(d.definition);
        if (link && !formOf) formOf = link[1];
        const t = text(d.definition);
        if (!t) continue;
        const ex = d.parsedExamples?.[0];
        senses.push({
          text: t,
          example: ex ? { text: text(ex.example), translation: ex.translation ? text(ex.translation) : undefined } : undefined,
        });
      }
      return { partOfSpeech: e.partOfSpeech, senses, formOf };
    })
    .filter((e) => e.senses.length);
}

/** Grammatical gender from the entry's source, e.g. {{de-noun|m,es,e}} → "m". */
async function genderOf(word: string, lang: Language) {
  const data = await get(
    `${API}/w/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&format=json&formatversion=2&origin=*&titles=${encodeURIComponent(word)}`,
  ).catch(() => null);
  const source: string | undefined = data?.query?.pages?.[0]?.revisions?.[0]?.slots?.main?.content;
  if (!source) return undefined;
  const start = source.indexOf(`==${lang.name}==`);
  if (start === -1) return undefined;
  const next = source.slice(start + 4).search(/\n==[^=]/);
  const section = next === -1 ? source.slice(start) : source.slice(start, start + 4 + next);
  const m =
    new RegExp(`\\{\\{${lang.code}-noun\\|([mfn])`).exec(section) ??
    new RegExp(`\\{\\{head\\|${lang.code}\\|nouns?\\|[^}]*?\\bg=([mfn])`).exec(section);
  return m?.[1] as Lookup["gender"];
}

async function fetchLookup(word: string, lang: Language): Promise<Lookup | null> {
  const variants = [...new Set([word, word.toLowerCase(), word[0].toUpperCase() + word.slice(1).toLowerCase()])];
  for (const w of variants) {
    const data = await get(`${API}/api/rest_v1/page/definition/${encodeURIComponent(w)}`);
    const raw: RawEntry[] | undefined = data?.[lang.code];
    if (!raw?.length) continue;
    const entries = parseEntries(raw);
    if (!entries.length) continue;
    const gender = lang.articles && entries.some((e) => e.partOfSpeech === "Noun") ? await genderOf(w, lang) : undefined;
    return { word: w, entries, gender, url: `${API}/wiki/${encodeURIComponent(w)}#${lang.name}` };
  }
  return null;
}

/** Look a word up in the language being learned. Null when Wiktionary has no entry. */
export function lookup(word: string, lang: Language) {
  const clean = word.trim().replace(/^[^\p{L}]+|[^\p{L}]+$/gu, "");
  if (!clean) return Promise.resolve(null);
  const key = `${lang.code}:${clean}`;
  let hit = cache.get(key);
  if (!hit) {
    hit = fetchLookup(clean, lang);
    cache.set(key, hit);
    hit.catch(() => cache.delete(key)); // don't remember failures (e.g. offline)
  }
  return hit;
}

/** A short meaning for a flashcard back: the first sense, trimmed. */
export function shortMeaning(result: Lookup) {
  const sense = result.entries.find((e) => !e.formOf)?.senses[0] ?? result.entries[0]?.senses[0];
  if (!sense) return "";
  // First sense, without notes in brackets or Latin species names ("house cat, Felis catus" → "house cat").
  const parts = sense.text
    .replace(/\s*\([^)]*\)/g, "")
    .split(/;/)[0]
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  const latin = /^[A-Z][a-z]+ [a-z]+(us|a|um|is|ae|ii|ensis|oides|atus|ata)( [a-z]+)?$/;
  const plain = parts.filter((part) => !latin.test(part));
  const first = (plain.length ? plain : parts).slice(0, 3).join(", ");
  return first.length > 60 ? first.slice(0, 57).trimEnd() + "…" : first;
}

/** "Hund" → "der Hund" for languages with articles. */
export function withArticle(result: Lookup, lang: Language) {
  const article = result.gender && lang.articles?.[result.gender];
  return article ? `${article} ${result.word}` : result.word;
}
