// "Explain a word": meanings and grammatical gender from the dictionary that ships with the app (the most
// common words of 12 languages, from Wiktionary), and from Wiktionary online for words it doesn't have.
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
  /** A noun's own gender, where one spelling has two (der See, lake; die See, sea). */
  gender?: "m" | "f" | "n";
}

export interface Lookup {
  /** The spelling Wiktionary knows the word by ("hund" → "Hund"). */
  word: string;
  entries: Entry[];
  gender?: "m" | "f" | "n";
  /** French: the h is mute, so the article is l' (l'homme, but le haricot). */
  muteH?: boolean;
  /** For a word that's only an inflected form ("ging"): its dictionary form and that form's first meaning. */
  lemma?: { word: string; sense: string };
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

/**
 * A word in the dictionary that ships with the app: its spelling, part of speech, gender ("" unless a noun),
 * up to three meanings, the dictionary form when it's an inflected one ("ging" → "gehen"), and 1 for a French
 * mute h.
 */
type Row = [word: string, pos: string, gender: "" | "m" | "f" | "n", senses: string[], formOf: string, muteH?: 1];

/** Languages with a dictionary in public/dict (scripts/build-dicts.sh builds them from English Wiktionary). */
const DICTIONARIES = new Set(["de", "es", "fr", "it", "pt", "nl", "sv", "pl", "ru", "ja", "zh", "tr"]);
export const hasDictionary = (code: string) => DICTIONARIES.has(code);
const DICTIONARY_VERSION = 1;
const dictionaries = new Map<string, Promise<Record<string, Row[]> | null>>();
const loaded = new Map<string, Record<string, Row[]>>();

/** One dictionary file's words, gzipped or not; null when it isn't there or can't be read. */
async function readDictionary(url: string) {
  const res = await fetch(url);
  if (!res.ok) return null;
  const bytes = new Uint8Array(await res.arrayBuffer());
  // Stored gzipped; a server may have unzipped it on the way already.
  const gzipped = bytes[0] === 0x1f && bytes[1] === 0x8b;
  const text = gzipped
    ? await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"))).text()
    : new TextDecoder().decode(bytes);
  return (JSON.parse(text) as { words: Record<string, Row[]> }).words;
}

/** Load a language's dictionary once (about 1 MB); null when there's none or it can't be loaded. */
export function loadDictionary(code: string) {
  if (!hasDictionary(code)) return Promise.resolve(null);
  let words = dictionaries.get(code);
  if (!words) {
    // Android's build unzips .gz files it packs into the app and drops the ".gz", so there it's "de.json".
    const file = `/dict/${code}.json`;
    words = readDictionary(`${file}.gz?v=${DICTIONARY_VERSION}`)
      .catch(() => null)
      .then((w) => w ?? readDictionary(`${file}?v=${DICTIONARY_VERSION}`))
      .catch(() => null);
    dictionaries.set(code, words);
    words.then((w) => (w ? loaded.set(code, w) : dictionaries.delete(code))); // a failure tries again next time
  }
  return words;
}

const PART_OF_SPEECH: Record<string, string> = {
  noun: "Noun",
  verb: "Verb",
  adj: "Adjective",
  adv: "Adverb",
  pron: "Pronoun",
  prep: "Preposition",
  conj: "Conjunction",
  intj: "Interjection",
  num: "Numeral",
  det: "Determiner",
  article: "Article",
  particle: "Particle",
};

// An inflected form ("ging", "imágenes"), rather than a word of its own made from another ("das Essen").
const INFLECTION = /\b(singular|plural|definite|genitive|dative|accusative|nominative|vocative|instrumental|locative|prepositional)\b/;
const inflected = (r: Row) => !!r[4] && (r[1] !== "noun" || INFLECTION.test(r[3][0] ?? ""));

/** The dictionary's entry for a word, shaped like Wiktionary's: the spelling typed comes first ("essen", not "Essen"). */
function fromDictionary(words: Record<string, Row[]>, word: string, lang: Language): Lookup | null {
  // In the language's own way: Turkish "İyi" is "iyi".
  const key = (w: string) => w.toLocaleLowerCase(lang.code);
  const rows = words[key(word)];
  if (!rows?.length) return null;
  const exact = rows.filter((r) => r[0] === word);
  const pick = exact.length ? exact : rows.filter((r) => r[0] === rows[0][0]);
  const spelled = pick[0][0];
  // The article goes with the entry the card's meaning comes from (see shortMeaning): "merci" is "thank you",
  // not "la merci". An inflected form has none ("imágenes", not "la imágenes").
  const main = pick.find((r) => !inflected(r));
  // Only an inflected form: its card takes the dictionary form's meaning ("ging": "to go, to walk (gehen)"),
  // from the first entry whose dictionary form is in the dictionary too.
  let lemma: Row | undefined;
  for (const r of main ? [] : pick) {
    const base = (words[key(r[4])] ?? []).filter((b) => !b[4]);
    lemma = base.find((b) => b[0] === r[4]) ?? base[0];
    if (lemma) break;
  }
  return {
    word: spelled,
    entries: pick.map(([, pos, gender, senses, formOf]) => ({
      partOfSpeech: PART_OF_SPEECH[pos] ?? pos[0].toUpperCase() + pos.slice(1),
      senses: senses.map((text) => ({ text })),
      formOf: formOf || undefined,
      gender: gender || undefined,
    })),
    gender: main?.[2] || undefined,
    muteH: main?.[5] === 1 || undefined,
    lemma: lemma?.[3][0] ? { word: lemma[0], sense: lemma[3][0] } : undefined,
    url: `${API}/wiki/${encodeURIComponent(spelled)}#${lang.name}`,
  };
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

/** The dictionary's entry for a word right away, if that language's dictionary is loaded and has it. */
export function lookupNow(word: string, lang: Language) {
  const words = loaded.get(lang.code);
  const clean = word.trim().replace(/^[^\p{L}]+|[^\p{L}]+$/gu, "");
  return words && clean ? fromDictionary(words, clean, lang) : null;
}

/**
 * Look a word up in the language being learned: in the dictionary that ships with the app first (instant,
 * offline), and on Wiktionary only for words it doesn't have, when `online` lookups are allowed. Null when
 * neither has an entry.
 */
export function lookup(word: string, lang: Language, online = true) {
  const clean = word.trim().replace(/^[^\p{L}]+|[^\p{L}]+$/gu, "");
  if (!clean) return Promise.resolve(null);
  const key = `${lang.code}:${clean}`;
  let hit = cache.get(key);
  if (!hit) {
    hit = loadDictionary(lang.code).then((words) => (words && fromDictionary(words, clean, lang)) ?? (online ? fetchLookup(clean, lang) : null));
    cache.set(key, hit);
    // Don't remember failures (offline) or a miss that didn't ask Wiktionary.
    hit.then(
      (r) => r || online || cache.delete(key),
      () => cache.delete(key),
    );
  }
  return hit;
}

/** A short meaning for a flashcard back: the first sense, trimmed; for an inflected form, its dictionary form's. */
export function shortMeaning(result: Lookup) {
  if (result.lemma) return `${short(result.lemma.sense)} (${result.lemma.word})`;
  const sense = result.entries.find((e) => !e.formOf)?.senses[0] ?? result.entries[0]?.senses[0];
  return sense ? short(sense.text) : "";
}

function short(text: string) {
  // First sense, without notes in brackets or Latin species names ("house cat, Felis catus" → "house cat"): its
  // first part, or a short one after a description ("A building for a family to reside in; house, home").
  const chunks = text.replace(/\s*\([^)]*\)/g, "").split(/;/);
  const words = (t: string) => t.trim().split(/\s+/).length;
  const parts = (words(chunks[0]) > 4 ? (chunks.find((c) => words(c) <= 4 && !c.endsWith("…")) ?? chunks[0]) : chunks[0])
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  const latin = /^[A-Z][a-z]+ [a-z]+(us|a|um|is|ae|ii|ensis|oides|atus|ata)( [a-z]+)?$/;
  const plain = parts.filter((part) => !latin.test(part));
  const list = plain.length ? plain : parts;
  // Synonyms, up to three, but not the description after them ("dog, domesticated for thousands of years" → "dog").
  const long = list.findIndex((part, i) => i > 0 && part.split(" ").length > 3);
  const first = list.slice(0, Math.min(3, long === -1 ? list.length : long)).join(", ");
  return first.length > 60 ? first.slice(0, 57).trimEnd() + "…" : first;
}

/** "Hund" → "der Hund" for languages with articles, with the article as it's said: "l'eau", "lo zio", "el agua". */
export function withArticle(result: Lookup, lang: Language) {
  const article = result.gender && lang.articles?.[result.gender];
  if (!article) return result.word;
  const w = result.word.toLowerCase();
  if (lang.code === "fr" ? /^[aeiouâàäéèêëîïôöûùüœæ]/.test(w) || (w[0] === "h" && result.muteH) : lang.code === "it" && /^[aeiouàèéìíòóùú]/.test(w))
    return `l'${result.word}`;
  if (lang.code === "it" && article === "il" && /^(s[^aeiouàèéìòù]|z|gn|ps|pn|x|y)/.test(w)) return `lo ${result.word}`;
  // A feminine noun stressed on its first a takes "el": "el área", or two syllables with no accent ("el agua").
  const syllables = w.match(/[aeiouáéíóúü]+/g)?.length;
  if (lang.code === "es" && article === "la" && (/^h?á/.test(w) || (/^h?a/.test(w) && syllables === 2 && /[aeiouns]$/.test(w) && !/[áéíóú]/.test(w))))
    return `el ${result.word}`;
  return `${article} ${result.word}`;
}
