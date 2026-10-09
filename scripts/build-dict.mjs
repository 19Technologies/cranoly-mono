// Builds one public/dict/<code>.json.gz: the most common words of a language with their English meanings,
// gender and dictionary form, from English Wiktionary as extracted by kaikki.org (CC BY-SA 4.0). The extract
// is streamed from stdin and never saved (scripts/build-dicts.sh runs this for every language):
//   curl --compressed -sL <kaikki.org …jsonl> | node scripts/build-dict.mjs de de.freq public/dict/de.json.gz [de.jsonl.gz]
// freq: "word count" per line, most common first (FrequencyWords, from film subtitles; CC BY-SA 4.0).
// The optional last file keeps a small copy of the entries read, to rebuild without downloading again:
//   gunzip -c de.jsonl.gz | node scripts/build-dict.mjs de de.freq public/dict/de.json.gz
import fs from "node:fs";
import readline from "node:readline";
import zlib from "node:zlib";

const [code, freqFile, out, slimFile] = process.argv.slice(2);
const LIMIT = 50000;

const freq = new Set(
  fs
    .readFileSync(freqFile, "utf8")
    .split("\n")
    .slice(0, LIMIT)
    .map((line) => line.split(" ")[0].toLowerCase())
    .filter(Boolean),
);
const han = (s) => /\p{Script=Han}/u.test(s);
// Japanese lists split verbs and adjectives at their kana ending ("分か" for 分かる): a common stem with kanji in
// it, plus a kana ending, counts as common. So does a single kanji that common words are written with (犬, seen
// only in 犬死 and 犬種).
const kanji = new Set(code === "ja" ? [...freq].flatMap((w) => [...w].filter(han)) : []);
function common(key) {
  if (freq.has(key)) return true;
  if (code !== "ja") return false;
  if (key.length === 1 && kanji.has(key)) return true;
  for (let i = key.length - 1; i > 0 && /^[぀-ゟ]+$/.test(key.slice(i)); i--)
    if (freq.has(key.slice(0, i)) && han(key.slice(0, i))) return true;
  return false;
}
// Chinese and Japanese spellings often only point to another one ("我们" to "我們", "ねこ" to "猫"), which may
// not be a common word itself: every entry is kept aside until the end.
const keepAll = code === "zh" || code === "ja";

// French words starting with h take l' (l'homme, l'heure) unless the h is aspirated (le haricot). The extract
// doesn't say which, so Wiktionary's list of aspirated ones is asked for (about 1,100 words).
async function aspirated() {
  const words = new Set();
  let next = "";
  do {
    const url = `https://en.wiktionary.org/w/api.php?action=query&list=categorymembers&cmtitle=Category:French_terms_with_aspirated_h&cmnamespace=0&cmlimit=500&format=json${next ? `&cmcontinue=${encodeURIComponent(next)}` : ""}`;
    const res = await fetch(url, { headers: { "User-Agent": "cranoly-mono dictionary build (https://github.com/19Technologies/cranoly-mono)" } });
    if (!res.ok) throw new Error(`Wiktionary said ${res.status} for the aspirated h list`);
    const data = await res.json();
    for (const m of data.query.categorymembers) words.add(m.title);
    next = data.continue?.cmcontinue;
  } while (next);
  return words;
}
const aspiratedH = code === "fr" ? await aspirated() : new Set();

const GENDER = { masculine: "m", feminine: "f", neuter: "n", common: "m" };
const SKIP_POS = new Set(["symbol", "suffix", "prefix", "infix", "interfix", "affix", "circumfix", "romanization", "punct", "soft-redirect"]);
// Used only when a spelling has nothing better: a single kanji's entry, or a name ("Essen", the city). In
// Chinese and Japanese a name is as good as any entry (中國, China).
const low = (pos) => pos === "character" || (pos === "name" && !keepAll);
const PERSON = /\b(given name|surname|family name|patronymic)\b/i;
const OLD = new Set(["obsolete", "archaic", "rare", "dated", "misspelling", "nonstandard", "dialectal", "Classical"]);
// Chinese senses used outside Mandarin only ("to get drunk", Cantonese).
const OTHER_CHINESE = /^(Cantonese|Hokkien|Teochew|Hakka|Wu|Gan|Xiang|Jin|Hainanese|Shanghainese|Taishanese|Dungan)$|-(Min|Hokkien|Cantonese|Wu)$/;
// A sense under another reads best as its parent ("house", not "structure serving as an abode of human
// beings"), unless the parent only introduces it ("agent noun of leiten", "Used as an interjection."). Under
// "inflection of schwarz:" it reads like a form's own sense: "strong genitive singular of schwarz".
function glossOf(g) {
  if (g.length < 2) return g[0];
  const of = /^.* of (\S+):$/.exec(g[0]);
  if (of) return `${g[g.length - 1]} of ${of[1]}`;
  return /:$/.test(g[0]) || /^Used\b/.test(g[0]) || /^[\w\s/-]{0,40} of \S+$/.test(g[0]) ? g[g.length - 1] : g[0];
}
// Russian dictionary forms are linked with stress marks (де́лать); the word itself is spelled without them.
const unstressed = (w) => (code === "ru" ? w.normalize("NFD").replace(/[\u0300\u0301]/g, "").normalize("NFC") : w);
// Meanings in the app read like the online lookup's first sense: short, without "(…)" notes or long dashes,
// and in Japanese without the other spellings in front ("貴方, 貴女: you").
function clean(g) {
  let s = code === "ja" ? g.replace(/^[^:A-Za-z]+:\s*/, "") : g;
  // Brackets inside brackets ("(the author(s) of …)") go from the inside out.
  while (/\([^()]*\)/.test(s)) s = s.replace(/\s*\([^()]*\)/g, "");
  return s
    .replace(/(\d)–(\d)/g, "$1 to $2")
    .replace(/\s*[–—]\s*/g, ", ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.;:]$/, "");
}
const cut = (s, n) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);

/**
 * [word, pos, gender, senses, formOf, muteH, rank]: muteH is 1 for a French word with a mute h; rank 0 is a
 * plain entry, 1 a low one, 2 one with only old senses.
 */
function rowOf(e) {
  let gender = "";
  let formOf = "";
  const senses = [];
  const old = [];
  for (const t of e.tags || []) gender ||= GENDER[t] || "";
  for (const s of e.senses || []) {
    const tags = s.tags || [];
    for (const t of tags) gender ||= GENDER[t] || "";
    if (s.form_of?.length && !formOf) formOf = unstressed(s.form_of[0].word || "");
    if (code === "zh" && !tags.includes("Mandarin") && tags.some((t) => OTHER_CHINESE.test(t))) continue;
    const g = s.glosses?.length ? glossOf(s.glosses) : "";
    if (!g || g.startsWith("Template:") || (e.pos === "name" ? PERSON.test(g) : /^a surname\b/i.test(g))) continue;
    const c = cut(clean(g), 140);
    const list = tags.some((t) => OLD.has(t)) ? old : senses;
    if (c && !senses.includes(c) && !old.includes(c)) list.push(c);
    if (senses.length === 3) break;
  }
  if (!senses.length && !old.length && !formOf) return null;
  const rank = !senses.length && old.length ? 2 : low(e.pos) ? 1 : 0;
  const muteH = code === "fr" && /^h/i.test(e.word) && !aspiratedH.has(e.word) ? 1 : 0;
  return [e.word, e.pos, e.pos === "noun" ? gender : "", senses.length ? senses : old.slice(0, 1), formOf, muteH, rank];
}

const words = new Map(); // lowercase spelling -> rows
const aside = new Map(); // the same, for words that aren't common (Chinese and Japanese)
const pointers = new Map(); // a common spelling that only points to another: key -> [spelling, target]
// A word with two entries of the same kind (two etymologies: der See, die See) keeps both.
function add(map, key, row) {
  if (!map.has(key)) map.set(key, []);
  const rows = map.get(key);
  const id = JSON.stringify(row.slice(0, 5));
  if (!rows.some((r) => JSON.stringify(r.slice(0, 5)) === id)) rows.push(row);
}

const slim = slimFile ? zlib.createGzip() : null;
slim?.pipe(fs.createWriteStream(slimFile));
let read = 0;
const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
rl.on("line", (line) => {
  read++;
  let e;
  try {
    e = JSON.parse(line);
  } catch {
    return;
  }
  const word = e.word;
  if (!word || /\s/.test(word)) return;
  const key = word.toLowerCase();
  const isCommon = common(key);
  if (!isCommon && !keepAll) return;
  slim?.write(
    JSON.stringify({
      word,
      pos: e.pos,
      tags: e.tags,
      redirects: e.redirects,
      senses: e.senses?.map((s) => ({ glosses: s.glosses, tags: s.tags, form_of: s.form_of?.slice(0, 1).map((f) => ({ word: f.word })) })),
    }) + "\n",
  );
  if (isCommon && e.redirects?.length && !pointers.has(key)) pointers.set(key, [word, e.redirects[0]]);
  if (SKIP_POS.has(e.pos)) return;
  const row = rowOf(e);
  if (row) add(isCommon ? words : aside, key, row);
});
rl.on("close", () => {
  slim?.end();
  // A spelling that only points to another takes that one's entries ("我们": we; us).
  for (const [key, [word, target]] of pointers) {
    if (words.has(key)) continue;
    const all = words.get(target.toLowerCase()) ?? aside.get(target.toLowerCase()) ?? [];
    const exact = all.filter((r) => r[0] === target);
    if (all.length) words.set(key, (exact.length ? exact : all).map((r) => [word, ...r.slice(1)]));
  }
  // Each spelling keeps its best entries: no kanji or name entry beside real ones, no old-only entry beside
  // current ones (大丈夫 is "all right", not the archaic "a great man"). Five at most.
  let rows = 0;
  for (const [key, list] of words) {
    const best = new Map();
    for (const r of list) best.set(r[0], Math.min(best.get(r[0]) ?? 9, r[6]));
    const kept = list.filter((r) => r[6] === best.get(r[0])).map((r) => r.slice(0, r[5] ? 6 : 5));
    const spellings = [...new Set(kept.map((r) => r[0]))];
    words.set(key, spellings.flatMap((s) => kept.filter((r) => r[0] === s).slice(0, 5)));
    rows += words.get(key).length;
  }
  const doc = {
    v: 1,
    lang: code,
    source: "English Wiktionary (en.wiktionary.org), extracted by kaikki.org; word list from FrequencyWords (OpenSubtitles)",
    license: "CC BY-SA 4.0",
    words: Object.fromEntries(words),
  };
  // Stored gzipped: the app opens it with the browser's DecompressionStream.
  const json = JSON.stringify(doc);
  fs.writeFileSync(out, zlib.gzipSync(json, { level: 9 }));
  const mb = (n) => (n / 1024 / 1024).toFixed(2);
  console.log(`${code}: ${read} entries read, ${words.size} words, ${rows} entries kept, ${mb(json.length)} MB, ${mb(fs.statSync(out).size)} MB gzipped`);
});
