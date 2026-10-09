"use client";
// Looks a word up while you type (after a short pause), for adding cards without any syntax. The dictionary
// on the device always answers; `online` lets it ask Wiktionary for words it doesn't have.
import { useEffect, useState } from "react";
import type { Language } from "./languages";
import { lookup, lookupNow, shortMeaning, withArticle } from "./lookup";

export interface Meaning {
  word: string;
  status: "idle" | "loading" | "found" | "missing" | "offline";
  /** The word as it should go on the card, e.g. "der Hund". */
  front?: string;
  meaning?: string;
}

export function useMeaning(word: string, lang: Language, online: boolean): Meaning {
  const w = word.trim();
  const [state, setState] = useState<Meaning>({ word: "", status: "idle" });
  // A word in the dictionary on this device answers as you type; the pause is only for asking Wiktionary.
  const now = w.length >= 2 ? lookupNow(w, lang) : null;
  const known = !!now;
  useEffect(() => {
    if (w.length < 2 || known) return;
    let live = true;
    const timer = setTimeout(() => {
      setState({ word: w, status: "loading" });
      lookup(w, lang, online).then(
        (r) => live && setState(r ? { word: w, status: "found", front: withArticle(r, lang), meaning: shortMeaning(r) } : { word: w, status: "missing" }),
        () => live && setState({ word: w, status: "offline" }),
      );
    }, 450);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [w, lang, online, known]);
  if (now) return { word: w, status: "found", front: withArticle(now, lang), meaning: shortMeaning(now) };
  return state.word === w ? state : { word: w, status: "idle" };
}
