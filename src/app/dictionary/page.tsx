"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BookA, FileText, Plus, Search, Volume2, X } from "lucide-react";
import LanguageSwitch from "@/components/LanguageSwitch";
import Sheet from "@/components/Sheet";
import Tumble from "@/components/Tumble";
import { entriesOf, letterOf, searchEntries, type Entry } from "@/lib/dictionary";
import { languageOf, type Language } from "@/lib/languages";
import { say } from "@/lib/smart";
import { useCards, useVault, vault } from "@/lib/store";
import { setUI } from "@/lib/ui";
import { useMeaning } from "@/lib/useMeaning";
import { useToday } from "@/lib/useToday";
import { prepareSpeech, useVoiceWarmup, useVoices } from "@/lib/voices";
import { titleOf } from "@/lib/vault";

const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

/** "der Bahnhof", with the article quiet so the eye lands on the word. */
function Word({ entry }: { entry: Entry }) {
  return (
    <>
      {entry.article && <span className="dict-article">{/['’]$/.test(entry.article) ? entry.article : `${entry.article} `}</span>}
      {entry.head}
    </>
  );
}

/** A search none of your words match: the word looked up (the dictionary on this device first), ready to add. */
function NotYours({ query, lang, online }: { query: string; lang: Language; online: boolean }) {
  const word = query.trim();
  const found = useMeaning(word, lang, online);
  return (
    <section className="dict-lookup" aria-live="polite">
      <p className="dict-none">None of your words match “{word}”.</p>
      {found.status === "found" && (
        <div className="dict-lookup-card">
          <span>
            <b>{found.front}</b>
            {found.meaning}
          </span>
          <button className="btn btn-primary" onClick={() => setUI({ addWord: { noteId: null, mode: "word", word } })}>
            <Plus size={15} /> Add
          </button>
        </div>
      )}
      {found.status === "missing" && (
        <p className="dict-none">
          {online
            ? "It isn’t in the dictionary either. Check the spelling, or add it with your own meaning."
            : "It isn’t in the dictionary on this device. Turn on online lookups in Settings to ask Wiktionary too."}
        </p>
      )}
      {found.status === "offline" && <p className="dict-none">It isn’t in this device’s dictionary, and looking further needs the internet.</p>}
    </section>
  );
}

/** Your own dictionary: every word you've saved, A to Z, with its meaning and a way to hear it. */
export default function DictionaryPage() {
  const router = useRouter();
  const { notes, settings } = useVault();
  const cards = useCards();
  const today = useToday();
  const lang = languageOf(settings.learning);
  const entries = useMemo(() => entriesOf(cards, notes, settings), [cards, notes, settings]);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<Entry | null>(null);
  const [revealed, setRevealed] = useState(false);

  const shown = useMemo(() => searchEntries(entries, query), [entries, query]);
  const groups = useMemo(() => {
    const out: Array<{ letter: string; entries: Entry[] }> = [];
    for (const e of shown) {
      const letter = letterOf(e);
      const last = out.at(-1);
      if (last?.letter === letter) last.entries.push(e);
      else out.push({ letter, entries: [e] });
    }
    return out;
  }, [shown]);
  const daily = today && entries.length > 2 ? entries[hash(today) % entries.length] : null;

  // Hearing a word should be instant: the voice loads as the page opens, and the words on screen
  // (and the word of the day) are prepared before you tap them.
  useVoiceWarmup(lang.code);
  const voices = useVoices();
  const list = useRef<HTMLDivElement>(null);
  const ready = voices[lang.code]?.status === "ready";
  useEffect(() => {
    if (!ready) return;
    if (daily) prepareSpeech([daily.word], lang.code);
    const root = list.current;
    if (!root) return;
    const watch = new IntersectionObserver(
      (items) => {
        const words = items.filter((i) => i.isIntersecting).map((i) => (i.target as HTMLElement).dataset.word);
        items.filter((i) => i.isIntersecting).forEach((i) => watch.unobserve(i.target));
        prepareSpeech(words, lang.code);
      },
      { rootMargin: "120px 0px" },
    );
    root.querySelectorAll("[data-word]").forEach((el) => watch.observe(el));
    return () => watch.disconnect();
  }, [ready, lang.code, shown, daily]);
  const press = (word: string) => () => prepareSpeech([word], lang.code, "now");

  const add = () => setUI({ addWord: { noteId: null, mode: "word" } });
  const openNote = (source: Entry["sources"][number]) => {
    setOpen(null);
    vault.openNote(source.noteId);
    vault.setMode("edit");
    setUI({ pendingLine: source.line });
    router.push("/");
  };

  return (
    <div className="page page-narrow dict-page">
      <header className="page-header">
        <div className="dict-title">
          <h1>Dictionary</h1>
          <button className="btn btn-primary" onClick={add}>
            <Tumble label="Add a word">
              <Plus size={16} /> Add a word
            </Tumble>
          </button>
        </div>
        <p className="page-lede">
          {entries.length
            ? `${entries.length} ${lang.name} ${entries.length === 1 ? "word" : "words"} from your notes. New words show up here as soon as you save them.`
            : `Every ${lang.name} word you save shows up here, A to Z.`}
        </p>
        <LanguageSwitch />
      </header>

      {!entries.length ? (
        <section className="card-panel dict-empty">
          <BookA size={28} />
          <h2>Words you save show up here</h2>
          <p>Add a word with ＋, paste a word list, or scan a page. Each one lands in your dictionary with its meaning.</p>
          <button className="btn btn-primary btn-lg" onClick={add}>
            <Plus size={17} /> Add a word
          </button>
        </section>
      ) : (
        <>
          {daily && !query && (
            <section className="dict-daily" aria-label="Word of the day">
              <div className="dict-daily-row">
                <button
                  className="dict-daily-card"
                  onClick={() => setRevealed((r) => !r)}
                  aria-label={revealed ? "Hide the meaning" : "Word of the day. Show the meaning"}
                >
                  <b>
                    <Word entry={daily} />
                  </b>
                  <span>{revealed ? daily.meanings.join(", ") : "Word of the day. Tap to see the meaning."}</span>
                </button>
                <button className="icon-btn" onPointerDown={press(daily.word)} onClick={() => say(daily.word, lang)} aria-label={`Hear ${daily.word}`}>
                  <Volume2 size={19} />
                </button>
              </div>
            </section>
          )}

          <label className="search-box dict-search">
            <Search size={15} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search words or meanings"
              aria-label="Search your dictionary"
            />
            {query && (
              <button className="icon-btn" aria-label="Clear search" onClick={() => setQuery("")}>
                <X size={14} />
              </button>
            )}
          </label>

          {!shown.length &&
            (/^\S+$/.test(query.trim()) ? (
              <NotYours key={query.trim()} query={query} lang={lang} online={settings.onlineLookups} />
            ) : (
              <p className="dict-none">No word or meaning matches “{query}”.</p>
            ))}

          <div ref={list} className="dict-list">
            {groups.map((g) => (
              <section key={g.letter} className="dict-group" aria-label={g.letter}>
                <h2 className="dict-letter">{g.letter}</h2>
                <ul>
                  {g.entries.map((e) => (
                    <li key={e.word} className="dict-entry" data-word={e.word}>
                      <button className="dict-row" onClick={() => setOpen(e)}>
                        <b className="dict-word">
                          <Word entry={e} />
                        </b>
                        <span className="dict-meaning">{e.meanings.join(", ")}</span>
                      </button>
                      <button className="icon-btn dict-say" onPointerDown={press(e.word)} onClick={() => say(e.word, lang)} aria-label={`Hear ${e.word}`}>
                        <Volume2 size={17} />
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </>
      )}

      <Sheet open={!!open} onClose={() => setOpen(null)} title={open ? open.word : undefined} className="dict-sheet">
        {open && (
          <div className="dict-detail">
            <ul className="dict-meanings">
              {open.meanings.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
            <div className="dict-actions">
              <button className="btn" onPointerDown={press(open.word)} onClick={() => say(open.word, lang)}>
                <Volume2 size={15} /> Hear it
              </button>
              <button
                className="btn"
                onClick={() => {
                  // The word without its article: "der See" is looked up as "See".
                  const word = open.head;
                  setOpen(null);
                  setUI({ explain: { word, noteId: open.sources[0]?.noteId ?? null } });
                }}
              >
                <BookA size={15} /> Explain
              </button>
            </div>
            <div className="sheet-list">
              {open.sources.map((s) =>
                notes[s.noteId] ? (
                  <button key={`${s.noteId}:${s.line}`} className="sheet-item" onClick={() => openNote(s)}>
                    <FileText size={16} />
                    <span>Open in “{titleOf(notes[s.noteId].path)}”</span>
                  </button>
                ) : null,
              )}
            </div>
          </div>
        )}
      </Sheet>
    </div>
  );
}
