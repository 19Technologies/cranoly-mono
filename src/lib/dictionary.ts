// The personal dictionary: every word you've saved, from the "word :: meaning" lines in your notes.
// Nothing is stored separately. ＋, Add N words, Scan and Format all write cards into notes,
// so a word shows up here as soon as it's saved anywhere.
import type { Card } from "./cards";
import { languageOf } from "./languages";
import { plainLine } from "./links";
import { forLanguage } from "./study";
import type { Note, Settings } from "./vault";

export interface Entry {
  /** The word as you wrote it, with its article ("der Bahnhof"). */
  word: string;
  /** The article in front of it, if any ("der"), shown quietly. */
  article: string;
  /** The word without its article ("Bahnhof"): what it's sorted and filed under. */
  head: string;
  meanings: string[];
  /** Where the word is written: the first one is where "Open in note" goes. */
  sources: Array<{ noteId: string; line: number }>;
}

/** Lower case, without accents: "Café" and "cafe" match. */
const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/** A card front that is a word or a short phrase, not a question or a sentence. */
function isWord(front: string) {
  return !front.includes("\n") && front.length <= 60 && front.split(/\s+/).length <= 5 && /\p{L}/u.test(front) && !/[?.!]$/.test(front);
}

/** "der Bahnhof" → ["der", "Bahnhof"], using the language's articles (and l' in French and Italian). */
function splitArticle(word: string, code: string): [string, string] {
  const articles = Object.values(languageOf(code).articles ?? {});
  const m = /^(\S+)\s+(.+)$/.exec(word);
  if (m && articles.some((a) => a.toLowerCase() === m[1].toLowerCase())) return [m[1], m[2]];
  const elided = /^(l['’])(.+)$/i.exec(word);
  if (elided && (code === "fr" || code === "it")) return [elided[1], elided[2]];
  return ["", word];
}

/** Your words in one language, merged by word and sorted the way that language sorts. */
export function entriesOf(cards: Card[], notes: Record<string, Note>, settings: Settings, code = settings.learning): Entry[] {
  const byWord = new Map<string, Entry>();
  for (const c of forLanguage(cards, notes, settings, code)) {
    // ":::" lines also make a reversed card; the basic one already holds the word.
    if (c.kind !== "basic") continue;
    const word = plainLine(c.front);
    const meaning = plainLine(c.back);
    if (!isWord(word) || !meaning) continue;
    const key = word.normalize("NFC").toLowerCase();
    let entry = byWord.get(key);
    if (!entry) {
      const [article, head] = splitArticle(word, code);
      entry = { word, article, head, meanings: [], sources: [] };
      byWord.set(key, entry);
    }
    if (!entry.meanings.some((m) => m.toLowerCase() === meaning.toLowerCase())) entry.meanings.push(meaning);
    entry.sources.push({ noteId: c.noteId, line: c.line });
  }
  const collator = new Intl.Collator(code, { sensitivity: "base", numeric: true });
  return [...byWord.values()].sort((a, b) => collator.compare(a.head, b.head) || collator.compare(a.word, b.word));
}

/** The letter a word is filed under: its first letter, without accents ("Ä" goes under A). Not a letter: "#". */
export function letterOf(entry: Entry) {
  const first = fold(entry.head).charAt(0).toUpperCase();
  return /\p{L}/u.test(first) ? first : "#";
}

/** Words whose word or meaning contains the search, ignoring case and accents. */
export function searchEntries(entries: Entry[], query: string) {
  const q = fold(query.trim());
  if (!q) return entries;
  return entries.filter((e) => fold(e.word).includes(q) || e.meanings.some((m) => fold(m).includes(q)));
}
