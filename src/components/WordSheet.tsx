"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, Plus, Volume2, WifiOff } from "lucide-react";
import Sheet from "./Sheet";
import { haptic } from "@/lib/native";
import { cardsOf, toast, useVault, vault } from "@/lib/store";
import { useVoiceWarmup } from "@/lib/voices";
import { languageOf, type Language } from "@/lib/languages";
import { LookupError, lookup, shortMeaning, withArticle, type Lookup } from "@/lib/lookup";
import { say } from "@/lib/smart";
import { titleOf } from "@/lib/vault";
import { setUI, useUI } from "@/lib/ui";

type Status = { kind: "loading" } | { kind: "done"; result: Lookup | null } | { kind: "error"; offline: boolean };

const close = () => setUI({ explain: null });

/** One lookup. Keyed by word, so looking up another word starts fresh. */
function Result({ word, lang, noteId, onLookUp }: { word: string; lang: Language; noteId: string | null; onLookUp: (w: string) => void }) {
  const { notes, settings } = useVault();
  const online = settings.onlineLookups;
  const [status, setStatus] = useState<Status>({ kind: "loading" });
  const [card, setCard] = useState("");

  useEffect(() => {
    let live = true;
    lookup(word, lang, online).then(
      (result) => {
        if (!live) return;
        setStatus({ kind: "done", result });
        if (result) setCard(`${withArticle(result, lang)} :: ${shortMeaning(result)}`);
      },
      (e) => live && setStatus({ kind: "error", offline: e instanceof LookupError && e.message === "offline" }),
    );
    return () => {
      live = false;
    };
  }, [word, lang, online]);

  if (status.kind === "loading") {
    return (
      <div className="ws-loading" aria-busy="true">
        <span className="skeleton" style={{ width: "40%" }} />
        <span className="skeleton" style={{ width: "85%" }} />
        <span className="skeleton" style={{ width: "70%" }} />
      </div>
    );
  }
  if (status.kind === "error") {
    return (
      <p className="ws-empty">
        {status.offline ? <><WifiOff size={15} /> You’re offline. Looking words up needs an internet connection.</> : "Couldn’t reach Wiktionary. Try again in a moment."}
      </p>
    );
  }
  const { result } = status;
  if (!result) {
    const parts = word.split(/\s+/).filter((w) => /\p{L}/u.test(w));
    return (
      <div className="ws-empty">
        <p>
          {online
            ? `Wiktionary has no ${lang.name} entry for “${word}”.`
            : `“${word}” isn’t in the dictionary on this device. With online lookups on, Wiktionary is asked too.`}
        </p>
        {!online && (
          <button className="btn" onClick={() => vault.updateSettings({ onlineLookups: true })}>
            Turn on online lookups
          </button>
        )}
        {parts.length > 1 && (
          <div className="ws-words">
            <span>Look up one word:</span>
            {parts.slice(0, 8).map((w) => (
              <button key={w} className="chip" onClick={() => onLookUp(w)}>
                {w}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  const front = card.split("::")[0].trim().toLowerCase();
  const known = cardsOf(notes).some((c) => c.front.trim().toLowerCase() === front);
  const note = noteId ? notes[noteId] : undefined;
  const save = () => {
    if (!note || !/\S\s*::\s*\S/.test(card)) return;
    haptic("success");
    vault.appendLine(note.id, card.trim());
    toast(`Added a card to “${titleOf(note.path)}”`);
    close();
  };

  return (
    <>
      <div className="ws-head">
        <h2 className="ws-word">
          {result.gender && lang.articles?.[result.gender] && <span className="ws-article">{lang.articles[result.gender]}</span>}
          {result.word}
        </h2>
        <button className="icon-btn ws-say" onClick={() => say(withArticle(result, lang), lang)} aria-label={`Hear “${result.word}”`} title="Hear it">
          <Volume2 size={18} />
        </button>
      </div>
      <div className="ws-entries">
        {result.entries.slice(0, 3).map((e, i) => (
          <section key={i} className="ws-entry">
            <span className="ws-pos">{e.partOfSpeech}</span>
            {e.formOf && (
              <button className="ws-formof" onClick={() => onLookUp(e.formOf!)}>
                Look up <b>{e.formOf}</b> <ArrowUpRight size={13} />
              </button>
            )}
            <ol>
              {e.senses.slice(0, 4).map((s, j) => (
                <li key={j}>
                  {s.text}
                  {s.example && (
                    <span className="ws-example">
                      <i>{s.example.text}</i>
                      {s.example.translation && <> · {s.example.translation}</>}
                    </span>
                  )}
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>
      <div className="ws-save">
        <label className="ws-card">
          <span>Flashcard</span>
          <input value={card} onChange={(e) => setCard(e.target.value)} onKeyDown={(e) => e.key === "Enter" && save()} spellCheck={false} />
        </label>
        <button className="btn btn-primary" onClick={save} disabled={!note}>
          <Plus size={15} /> Save card
        </button>
      </div>
      <p className="ws-foot">
        {known && <>You already have a card for this. </>}
        {note ? <>Saves to “{titleOf(note.path)}”. </> : null}
        <a href={result.url} target="_blank" rel="noreferrer">
          From Wiktionary <ArrowUpRight size={12} />
        </a>
      </p>
    </>
  );
}

function Explain({ word, noteId }: { word: string; noteId: string | null }) {
  const { settings } = useVault();
  const lang = languageOf(settings.learning);
  useVoiceWarmup(lang.code);
  const [current, setCurrent] = useState(word);
  return (
    <Sheet open title={`Explain · ${lang.name}`} onClose={close} className="word-sheet">
      <Result key={current} word={current} lang={lang} noteId={noteId} onLookUp={setCurrent} />
    </Sheet>
  );
}

/** "Explain a word" sheet, opened from the selection bar, the phone toolbar or ⌘K. */
export default function WordSheet() {
  const { explain } = useUI();
  return explain ? <Explain key={explain.word} word={explain.word} noteId={explain.noteId} /> : null;
}
