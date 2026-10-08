// Study helpers. No scheduling or difficulty ratings: just decks you flip through,
// plus a per-day activity log that feeds the heatmap and streak.
import { isoDay, type Note, type Settings } from "./vault";
import type { Card } from "./cards";
import { languageOf } from "./languages";

export function shuffled<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export interface HeatDay {
  date: string;
  count: number;
  level: 0 | 1 | 2 | 3 | 4;
  future: boolean;
}

/** `weeks` columns of 7 days (Mon→Sun), ending with the week containing `today`. */
export function heatmap(activity: Record<string, number>, today: Date, weeks = 16): HeatDay[][] {
  const dow = (today.getDay() + 6) % 7; // Monday = 0
  const start = new Date(today);
  start.setDate(today.getDate() - dow - (weeks - 1) * 7);
  const max = Math.max(1, ...Object.values(activity));
  const todayKey = isoDay(today);
  const cols: HeatDay[][] = [];
  for (let w = 0; w < weeks; w++) {
    const col: HeatDay[] = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(start);
      date.setDate(start.getDate() + w * 7 + d);
      const key = isoDay(date);
      const count = activity[key] ?? 0;
      const ratio = count / max;
      const level = (count === 0 ? 0 : ratio > 0.75 ? 4 : ratio > 0.5 ? 3 : ratio > 0.25 ? 2 : 1) as HeatDay["level"];
      col.push({ date: key, count, level, future: key > todayKey });
    }
    cols.push(col);
  }
  return cols;
}

/** Consecutive days with activity, counting back from today (or yesterday). */
export function streak(activity: Record<string, number>, today: Date) {
  const d = new Date(today);
  if (!activity[isoDay(d)]) d.setDate(d.getDate() - 1);
  let n = 0;
  while (activity[isoDay(d)]) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

export function formatDuration(ms: number) {
  const s = Math.round(ms / 1000);
  const m = Math.floor(s / 60);
  return m ? `${m}m ${String(s % 60).padStart(2, "0")}s` : `${s}s`;
}

const DAY = 86_400_000;

/** Cards never revealed, or not revealed in the last week, oldest first. */
export function notSeenLately(cards: Card[], seen: Record<string, number>, today: Date, days = 7) {
  const cutoff = today.getTime() - (days - 1) * DAY;
  return cards
    .filter((c) => !seen[c.id] || seen[c.id] < cutoff)
    .sort((a, b) => (seen[a.id] ?? 0) - (seen[b.id] ?? 0));
}

/** Cards from notes written or edited in the last week. */
export function fromRecentNotes(cards: Card[], notes: Record<string, Note>, today: Date, days = 7) {
  const cutoff = today.getTime() - (days - 1) * DAY;
  return cards.filter((c) => (notes[c.noteId]?.updated ?? 0) >= cutoff);
}

/**
 * The language a note is in, when where it lives says so: its words note ("Spanish words"), or a top-level folder
 * named after the language ("German/Greetings"). Other notes don't belong to one language.
 */
function noteLanguage(path: string | undefined, settings: Settings) {
  if (!path) return null;
  const slash = path.indexOf("/");
  const top = slash === -1 ? null : path.slice(0, slash).toLowerCase();
  return (
    settings.languages.find((c) => {
      const name = languageOf(c).name;
      return path === `${name} words` || top === name.toLowerCase();
    }) ?? null
  );
}

/** The language a card is in: its note's language, else the one being learned. */
export function cardLanguage(card: Card, notes: Record<string, Note>, settings: Settings) {
  return noteLanguage(notes[card.noteId]?.path, settings) ?? settings.learning;
}

/** Leave out the cards of the other languages being learned (notes that belong to no language stay in). */
export function forLanguage(cards: Card[], notes: Record<string, Note>, settings: Settings, code = settings.learning) {
  if (settings.languages.length < 2) return cards;
  return cards.filter((c) => {
    const lang = noteLanguage(notes[c.noteId]?.path, settings);
    return !lang || lang === code;
  });
}
