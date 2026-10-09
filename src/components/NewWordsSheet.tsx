"use client";

import { useState } from "react";
import { BookA, Loader2, Plus, Volume2 } from "lucide-react";
import Sheet from "./Sheet";
import { haptic } from "@/lib/native";
import { cardsOf, getVault, toast, useVault, vault } from "@/lib/store";
import { useVoiceWarmup } from "@/lib/voices";
import { languageOf } from "@/lib/languages";
import { lookup, shortMeaning, withArticle } from "@/lib/lookup";
import { knownWords, newWords } from "@/lib/words";
import { say } from "@/lib/smart";
import { titleOf } from "@/lib/vault";
import { setUI, useUI } from "@/lib/ui";

interface Row {
  word: string;
  front: string;
  meaning: string;
  on: boolean;
  status: "idle" | "loading" | "found" | "missing";
}

const close = () => setUI({ newWords: null });

function NewWords({ text, noteId }: { text: string; noteId: string }) {
  const { settings, notes } = useVault();
  const lang = languageOf(settings.learning);
  useVoiceWarmup(lang.code);
  // Worked out once when the sheet opens, so the list doesn't shift while you fill it in.
  const [rows, setRows] = useState<Row[]>(() =>
    newWords(text, knownWords(cardsOf(getVault().notes)), languageOf(getVault().settings.learning)).map((word) => ({
      word,
      front: word,
      meaning: "",
      on: true,
      status: "idle",
    })),
  );
  const [busy, setBusy] = useState(false);
  const note = notes[noteId];
  const update = (word: string, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.word === word ? { ...r, ...patch } : r)));
  const ready = rows.filter((r) => r.on && r.meaning.trim());

  const lookUpAll = async () => {
    setBusy(true);
    const queue = rows.filter((r) => r.on && !r.meaning.trim() && r.status !== "missing");
    const worker = async () => {
      for (let r = queue.shift(); r; r = queue.shift()) {
        update(r.word, { status: "loading" });
        try {
          const result = await lookup(r.word, lang, settings.onlineLookups);
          update(
            r.word,
            result
              ? { status: "found", front: withArticle(result, lang), meaning: shortMeaning(result) }
              : { status: "missing" },
          );
        } catch {
          update(r.word, { status: "idle" });
          toast("Couldn’t reach Wiktionary. Check your connection.");
          queue.length = 0;
        }
      }
    };
    await Promise.all([worker(), worker(), worker()]);
    setBusy(false);
  };

  const add = () => {
    if (!note || !ready.length) return;
    haptic("success");
    vault.appendLine(note.id, ready.map((r) => `${r.front.trim()} :: ${r.meaning.trim()}`).join("\n"));
    toast(`Added ${ready.length} ${ready.length === 1 ? "card" : "cards"} to “${titleOf(note.path)}”`);
    close();
  };

  if (!rows.length) {
    return (
      <p className="ws-empty">
        No new words here: every word already has a card, or is too common to need one.
      </p>
    );
  }

  return (
    <>
      <div className="nw-head">
        <p>
          <b>{rows.length}</b> {rows.length === 1 ? "word" : "words"} you don’t have cards for yet. Untick the ones you know.
        </p>
        <button className="btn btn-sm" onClick={lookUpAll} disabled={busy}>
          {busy ? <Loader2 size={14} className="spin" /> : <BookA size={14} />} Look up meanings
        </button>
      </div>
      <ul className="nw-list">
        {rows.map((r) => (
          <li key={r.word} className={r.on ? "" : "is-off"}>
            <input type="checkbox" checked={r.on} onChange={(e) => update(r.word, { on: e.target.checked })} aria-label={`Include ${r.word}`} />
            <span className="nw-word">
              {r.front}
              <button className="icon-btn" onClick={() => say(r.front, lang)} aria-label={`Hear “${r.word}”`}>
                <Volume2 size={14} />
              </button>
            </span>
            <input
              className="nw-meaning"
              value={r.meaning}
              placeholder={r.status === "loading" ? "Looking up…" : r.status === "missing" ? "Not found, type it" : "Meaning"}
              onChange={(e) => update(r.word, { meaning: e.target.value })}
              aria-label={`Meaning of ${r.word}`}
            />
          </li>
        ))}
      </ul>
      <div className="nw-foot">
        <span>Words without a meaning are skipped.</span>
        <button className="btn btn-primary" onClick={add} disabled={!ready.length}>
          <Plus size={15} /> Add {ready.length || ""} {ready.length === 1 ? "card" : "cards"}
        </button>
      </div>
    </>
  );
}

/** "Find new words": every word in a text you don't have a card for, ready to become cards. */
export default function NewWordsSheet() {
  const { newWords: open } = useUI();
  return open ? (
    <Sheet open title="New words" onClose={close} className="word-sheet">
      <NewWords key={open.text} text={open.text} noteId={open.noteId} />
    </Sheet>
  ) : null;
}
