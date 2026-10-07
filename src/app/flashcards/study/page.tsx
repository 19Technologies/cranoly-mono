"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowUpRight, Check, Repeat2, RotateCcw, Shuffle, Volume2, X } from "lucide-react";
import { languageOf } from "@/lib/languages";
import { say } from "@/lib/smart";
import { prepareSpeech, useVoiceWarmup } from "@/lib/voices";
import { haptic } from "@/lib/native";
import MarkdownView from "@/components/MarkdownView";
import { Card, inDeck } from "@/lib/cards";
import { cardLanguage, forLanguage, formatDuration, fromRecentNotes, notSeenLately, shuffled } from "@/lib/study";
import { parseDay, useToday } from "@/lib/useToday";
import { titleOf } from "@/lib/vault";
import { getVault, useCards, useVault, vault } from "@/lib/store";
import { getUI, setUI } from "@/lib/ui";

const KIND_LABEL: Record<Card["kind"], string> = {
  basic: "Card",
  reversed: "Two-way",
  multiline: "Question",
  cloze: "Fill the gap",
};

const short = (s: string) => s.replace(/[*_=`[\]]/g, "").length <= 42 && !s.includes("\n");

/** One card, filling the screen: tap to flip, hear either side, open the note it came from. */
function CardSlide({ card, reversed, flipped, onFlip, onOpen }: {
  card: Card;
  reversed: boolean;
  flipped: boolean;
  onFlip: () => void;
  onOpen: () => void;
}) {
  const { notes, settings } = useVault();
  const source = notes[card.noteId];
  const front = reversed ? card.back : card.front;
  const back = reversed ? card.front : card.back;
  // Card fronts are in the language being learned, answers in your own (except fill-the-gap cards).
  const learning = languageOf(cardLanguage(card, notes, settings));
  const own = card.kind === "cloze" ? learning : languageOf(settings.native);
  const frontLang = reversed ? own : learning;
  const backLang = reversed ? learning : own;
  return (
    <div className="flip-wrap" onClick={(e) => !(e.target as HTMLElement).closest("button, a") && onFlip()}>
      <div
        className={`flip-card${flipped ? " is-flipped" : ""}`}
        role="button"
        tabIndex={-1}
        aria-label={flipped ? "Answer shown. Tap to show the question" : "Tap to reveal the answer"}
      >
        <div className="face face-front">
          <span className="face-kind">{reversed ? "Reversed" : KIND_LABEL[card.kind]}</span>
          <button
            className="face-say"
            onPointerDown={() => prepareSpeech([front], frontLang.code, "now")}
            onClick={() => say(front, frontLang)}
            aria-label="Hear the question"
            title="Hear it"
          >
            <Volume2 size={16} />
          </button>
          <div className={`face-content${short(front) ? " is-short" : ""}`}>
            <MarkdownView content={front} interactive={false} />
          </div>
          <span className="face-hint">
            <span className="hint-touch">Tap to flip · Swipe up for the next</span>
            <span className="hint-keys">Click or press Space to flip · Scroll or ↓ for the next</span>
          </span>
        </div>
        <div className="face face-back">
          <span className="face-kind">Answer</span>
          <button
            className="face-say"
            onPointerDown={() => prepareSpeech([back], backLang.code, "now")}
            onClick={() => say(back, backLang)}
            aria-label="Hear the answer"
            title="Hear it"
          >
            <Volume2 size={16} />
          </button>
          {card.kind !== "cloze" && (
            <div className="face-question">
              <MarkdownView content={front} interactive={false} />
            </div>
          )}
          <div className={`face-content${short(back) ? " is-short" : ""}`}>
            <MarkdownView content={back} interactive={false} />
          </div>
          {source && (
            <button className="face-source" onClick={onOpen} title="Open the note (O)">
              {titleOf(source.path)} <ArrowUpRight size={12} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * A study session as a feed: one card per screen, swipe (or scroll) up for the next and down for the
 * one before, tap to flip. Only the cards near the one on screen are drawn, so long decks stay quick.
 * The last screen is the summary.
 */
function Session({ cards: initial, title, shuffle, startWithBack, limit }: {
  cards: Card[];
  title: string;
  shuffle: boolean;
  startWithBack: boolean;
  /** Study only this many (a quick session). Shuffled decks pick them at random. */
  limit: number;
}) {
  const router = useRouter();
  const { notes, settings } = useVault();
  const [cards] = useState(() => {
    if (!limit) return initial;
    return (shuffle ? shuffled(initial) : initial).slice(0, limit);
  });
  const [order, setOrder] = useState(() => (shuffle ? shuffled(cards) : cards));
  // The screen in view: a card, or order.length for the summary at the end.
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [reversed, setReversed] = useState(startWithBack);
  // How the session went, worked out when the summary comes into view.
  const [summary, setSummary] = useState({ elapsed: 0, revealed: 0 });
  const seen = useRef(new Set<string>());
  const started = useRef(0);
  const feed = useRef<HTMLDivElement>(null);
  const atEnd = index >= order.length;
  const card = atEnd ? undefined : order[index];

  useEffect(() => {
    started.current = Date.now();
  }, []);

  // Hearing a card should be instant: the voice loads with the session, and this card and the next
  // are prepared before you tap them.
  useVoiceWarmup(card ? cardLanguage(card, notes, settings) : null, settings.native);
  useEffect(() => {
    for (const c of [order[index], order[index + 1]]) {
      if (!c) continue;
      const learn = cardLanguage(c, notes, settings);
      const mine = c.kind === "cloze" ? learn : settings.native;
      prepareSpeech([reversed ? c.back : c.front], reversed ? mine : learn);
      prepareSpeech([reversed ? c.front : c.back], reversed ? learn : mine);
    }
  }, [order, index, reversed, notes, settings]);

  const flip = useCallback(() => {
    if (!card) return;
    if (!flipped && !seen.current.has(card.id)) {
      seen.current.add(card.id);
      vault.logStudy();
      vault.markSeen(card.id);
    }
    haptic();
    setFlipped(!flipped);
  }, [card, flipped]);

  /** Bring a screen into view (the swipe does this by itself; keys and buttons use it). */
  const goTo = useCallback(
    (i: number) => {
      const el = feed.current;
      if (!el) return;
      el.scrollTo({ top: Math.max(0, Math.min(i, order.length)) * el.clientHeight, behavior: "smooth" });
    },
    [order.length],
  );

  // Which screen is in view follows the scroll.
  const onScroll = () => {
    const el = feed.current;
    if (!el || !el.clientHeight) return;
    const i = Math.round(el.scrollTop / el.clientHeight);
    if (i === index) return;
    setIndex(i);
    setFlipped(false);
    if (i >= order.length) {
      haptic("success");
      setSummary({ elapsed: Date.now() - started.current, revealed: seen.current.size });
    } else haptic();
  };

  const restart = useCallback(
    (mix: boolean) => {
      setOrder(mix ? shuffled(cards) : cards);
      setIndex(0);
      setFlipped(false);
      seen.current = new Set();
      started.current = Date.now();
      feed.current?.scrollTo({ top: 0 });
    },
    [cards],
  );

  /** Back to wherever practice was started from (Practice, the Dictionary or a note). */
  const leave = useCallback(() => {
    if (window.history.length > 1) router.back();
    else router.push("/flashcards");
  }, [router]);

  const openSource = useCallback(() => {
    if (!card) return;
    vault.openNote(card.noteId);
    vault.setMode("edit");
    setUI({ pendingLine: card.line });
    router.push("/");
  }, [card, router]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (getUI().palette || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement;
      if (el.closest("input, textarea")) return;
      const onButton = !!el.closest("button, a");
      if ((e.key === " " || e.key === "Enter") && !onButton && !atEnd) {
        e.preventDefault();
        flip();
      } else if (["ArrowDown", "ArrowRight", "PageDown", "j"].includes(e.key)) {
        e.preventDefault();
        goTo(index + 1);
      } else if (["ArrowUp", "ArrowLeft", "PageUp", "k"].includes(e.key)) {
        e.preventDefault();
        goTo(index - 1);
      } else if (e.key === "s") restart(true);
      else if (e.key === "r" && !atEnd) setReversed((r) => !r);
      else if (e.key === "o" && !atEnd) openSource();
      else if (e.key === "Escape") leave();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [flip, goTo, index, restart, openSource, leave, atEnd]);

  const progress = atEnd ? 1 : (index + (flipped ? 1 : 0.5)) / order.length;

  return (
    <div className="study">
      <header className="study-bar">
        <button className="btn btn-ghost" onClick={leave}>
          <X size={16} /> Close
        </button>
        <div className="study-title">
          <span>{title}</span>
          <small>
            {Math.min(index + 1, order.length)} / {order.length}
          </small>
        </div>
        <div className="btn-row">
          <button className="btn btn-ghost" onClick={() => restart(true)} title="Shuffle (S)" aria-label="Shuffle">
            <Shuffle size={15} /> <span className="hide-sm">Shuffle</span>
          </button>
          <button
            className={`btn btn-ghost${reversed ? " is-on" : ""}`}
            onClick={() => setReversed((r) => !r)}
            aria-pressed={reversed}
            aria-label="Answer first"
            title="Show the answer side first (R)"
          >
            <Repeat2 size={15} /> <span className="hide-sm">Answer first</span>
          </button>
        </div>
      </header>
      <div className="progress" aria-hidden>
        <span style={{ width: `${progress * 100}%` }} />
      </div>

      <div ref={feed} className="feed" onScroll={onScroll} aria-label="Cards">
        {order.map((c, i) => (
          <section key={`${c.id}|${reversed}`} className="feed-slide" aria-hidden={i !== index}>
            {Math.abs(i - index) <= 2 && (
              <CardSlide
                card={c}
                reversed={reversed}
                flipped={i === index && flipped}
                onFlip={() => i === index && flip()}
                onOpen={openSource}
              />
            )}
          </section>
        ))}
        <section className="feed-slide feed-end" aria-hidden={!atEnd}>
          <div className="study-done">
            <div className="done-badge">
              <Check size={34} strokeWidth={2.5} />
            </div>
            <h1>Deck complete</h1>
            <p>
              You went through <b>{order.length}</b> {order.length === 1 ? "card" : "cards"}
              {summary.elapsed > 0 && (
                <>
                  {" "}in <b>{formatDuration(summary.elapsed)}</b>
                </>
              )}
              {summary.revealed < order.length && <> and revealed {summary.revealed} answers</>}.
            </p>
            <div className="btn-row">
              <button className="btn" onClick={() => restart(false)}>
                <RotateCcw size={14} /> Study again
              </button>
              <button className="btn" onClick={() => restart(true)}>
                <Shuffle size={14} /> Shuffle &amp; go again
              </button>
              <button className="btn btn-primary" onClick={leave}>
                Done
              </button>
            </div>
          </div>
        </section>
      </div>
      <p className="study-keys">
        <kbd>Space</kbd> flip <kbd>↑</kbd><kbd>↓</kbd> move <kbd>S</kbd> shuffle <kbd>R</kbd> answer first <kbd>O</kbd> open
        note <kbd>Esc</kbd> exit
      </p>
    </div>
  );
}

function StudyRoute() {
  const params = useSearchParams();
  const { notes, settings } = useVault();
  const every = useCards();
  const deck = params.get("deck");
  const noteId = params.get("note");
  const shuffleParam = params.get("shuffle") === "1";
  const smart = params.get("smart");
  const limit = Number(params.get("limit")) || 0;
  const lang = params.get("lang");
  const today = useToday();
  // Smart decks are worked out from the moment you start, so studying doesn't shrink the deck under you.
  const [seenAtStart] = useState(() => getVault().seen);

  const { cards, title } = useMemo(() => {
    const all = lang ? forLanguage(every, notes, settings, lang) : every;
    if (smart === "stale") return { cards: today ? notSeenLately(all, seenAtStart, parseDay(today)) : [], title: "Not seen lately" };
    if (smart === "recent") return { cards: today ? fromRecentNotes(all, notes, parseDay(today)) : [], title: "From this week’s notes" };
    if (noteId) return { cards: all.filter((c) => c.noteId === noteId), title: notes[noteId] ? titleOf(notes[noteId].path) : "Note" };
    if (deck) return { cards: all.filter((c) => inDeck(c, deck)), title: deck.split("/").join(" / ") };
    return { cards: all, title: "All cards" };
  }, [every, lang, deck, noteId, notes, settings, smart, today, seenAtStart]);

  if (smart && !today) return null;

  if (!cards.length) {
    return (
      <div className="study-done">
        <h1>Nothing to study here</h1>
        <p>This deck has no cards. Write a line like <code>Hallo :: Hello</code> in any note to add one.</p>
        <Link href="/flashcards" className="btn btn-primary">
          Back to decks
        </Link>
      </div>
    );
  }

  return (
    <Session
      key={`${deck}|${noteId}|${shuffleParam}|${smart}|${limit}|${lang}`}
      cards={cards}
      limit={limit}
      title={limit ? "Practice" : title}
      shuffle={shuffleParam || settings.shuffle}
      startWithBack={settings.startWithBack}
    />
  );
}

export default function StudyPage() {
  return (
    <Suspense fallback={null}>
      <StudyRoute />
    </Suspense>
  );
}
