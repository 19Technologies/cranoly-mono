// "Check my writing": grammar and spelling from LanguageTool's free service.
// Only the text being checked is sent, and only when the user taps Check.
// Markdown, links, tags and flashcard answers are sent as markup so they aren't "corrected".
import type { Language } from "./languages";

export interface Issue {
  from: number;
  to: number;
  label: string;
  message: string;
  replacements: string[];
}

export class GrammarError extends Error {}

/** Longest text the free service accepts in one go (it allows 20 KB). */
export const MAX_CHECK = 18000;

const LABELS: Record<string, string> = {
  TYPOS: "Spelling",
  CASING: "Capital letters",
  GRAMMAR: "Grammar",
  PUNCTUATION: "Punctuation",
  CONFUSED_WORDS: "Easily confused word",
  COLLOCATIONS: "Word choice",
  REDUNDANCY: "Repeated word",
  COMPOUNDING: "Compound word",
  SEMANTICS: "Meaning",
};
const SKIPPED_TYPES = new Set(["typographical", "whitespace", "style"]);

type Segment = { text: string } | { markup: string; interpretAs?: string };

// Parts of a line that aren't prose. Each match is sent as markup, with an optional stand-in.
const INLINE: Array<[RegExp, (match: string) => string]> = [
  [/\[\[[^[\]\n]+?\]\]/g, (m) => { const [t, a] = m.slice(2, -2).split("|"); return (a ?? t.split("#")[0]).trim(); }],
  [/`[^`\n]+`/g, () => "X"],
  [/https?:\/\/\S+/g, () => ""],
  [/\]\([^)\s]+\)/g, () => ""],
  [/\[(?=[^[\]\n]*\]\()/g, () => ""],
  [/(?<=^|\s)#[\p{L}_][\p{L}\p{N}_/-]*/gu, () => ""],
  [/\*\*|__|==|~~/g, () => ""],
];

/** Split a note into prose (checked) and markup (skipped), keeping every character in order. */
function annotate(text: string): Segment[] {
  const out: Segment[] = [];
  const pushText = (t: string) => {
    if (!t) return;
    const last = out[out.length - 1];
    if (last && "text" in last) last.text += t;
    else out.push({ text: t });
  };
  const lines = text.split("\n");
  let fence = false;
  lines.forEach((line, i) => {
    if (i > 0) out.push({ markup: "\n", interpretAs: "\n\n" }); // every line is its own paragraph
    if (/^\s*```/.test(line) || fence) {
      if (/^\s*```/.test(line)) fence = !fence;
      if (line) out.push({ markup: line });
      return;
    }
    if (/^\s*\?{1,2}\s*$/.test(line)) {
      if (line) out.push({ markup: line });
      return;
    }
    // Line prefixes: headings, quotes, list bullets, checkboxes
    const prefix = /^\s*(?:#{1,6}\s+|(?:>\s?)+|(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s+)?)*/.exec(line)![0];
    if (prefix) out.push({ markup: prefix });
    let body = line.slice(prefix.length);
    // Flashcard answers are usually in the learner's own language: skip everything after :: / :::
    let tail = "";
    const sep = /\s:{2,3}(\s|$)/.exec(body);
    if (sep) {
      tail = body.slice(sep.index);
      body = body.slice(0, sep.index);
    }
    const spans: Array<{ from: number; to: number; as: string }> = [];
    for (const [re, as] of INLINE) {
      for (const m of body.matchAll(re)) {
        const from = m.index!;
        const to = from + m[0].length;
        if (!spans.some((x) => from < x.to && to > x.from)) spans.push({ from, to, as: as(m[0]) });
      }
    }
    spans.sort((a, b) => a.from - b.from);
    let at = 0;
    for (const s of spans) {
      pushText(body.slice(at, s.from));
      out.push(s.as ? { markup: body.slice(s.from, s.to), interpretAs: s.as } : { markup: body.slice(s.from, s.to) });
      at = s.to;
    }
    pushText(body.slice(at));
    if (tail) out.push({ markup: tail });
  });
  return out;
}

interface Match {
  offset: number;
  length: number;
  message: string;
  shortMessage?: string;
  replacements: Array<{ value: string }>;
  rule: { issueType: string; category: { id: string } };
}

/** Check `text` (which starts at `base` in the note). Issue positions are note positions. */
export async function check(text: string, base: number, lang: Language, native: Language): Promise<Issue[]> {
  if (!lang.grammar) throw new GrammarError("unsupported");
  const body = new URLSearchParams({
    data: JSON.stringify({ annotation: annotate(text) }),
    language: lang.grammar,
  });
  if (native.grammar && native.code !== lang.code) body.set("motherTongue", native.grammar);
  let res: Response;
  try {
    res = await fetch("https://api.languagetool.org/v2/check", { method: "POST", body });
  } catch {
    throw new GrammarError("offline");
  }
  if (res.status === 429) throw new GrammarError("busy");
  if (!res.ok) throw new GrammarError(`status ${res.status}`);
  const data: { matches: Match[] } = await res.json();
  return data.matches
    .filter((m) => !SKIPPED_TYPES.has(m.rule.issueType) && m.length > 0)
    .map((m) => ({
      from: base + m.offset,
      to: base + m.offset + m.length,
      label: LABELS[m.rule.category.id] ?? "Check this",
      message: m.message,
      replacements: m.replacements.slice(0, 4).map((r) => r.value),
    }));
}
