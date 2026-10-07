"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, ChevronLeft, Download, Layers, Link2, Loader2, Plus, Volume2, Wifi } from "lucide-react";
import Logo from "./Logo";
import VoiceList from "./Voices";
import Tumble from "./Tumble";
import { getVault, useVault, vault } from "@/lib/store";
import { bringIn, replaceWith } from "@/lib/backup";
import { pickBackup } from "./BringIn";
import { LANGUAGES, languageOf } from "@/lib/languages";
import { useMeaning } from "@/lib/useMeaning";
import { haptic } from "@/lib/native";
import { onBack } from "@/lib/ui";
import { say } from "@/lib/smart";
import { downloadSize, downloadVoice, useVoiceWarmup, useVoices, voiceReady } from "@/lib/voices";

const FEATURED = ["de", "es", "fr", "en", "it", "pt", "ja", "sw"];

/** How far through the four setup screens you are: one line that fills up. */
function Progress({ step }: { step: number }) {
  return (
    <div className="wc-progress" role="progressbar" aria-valuemin={1} aria-valuemax={4} aria-valuenow={step} aria-label={`Step ${step} of 4`}>
      <i style={{ width: `${(step / 4) * 100}%` }} />
    </div>
  );
}

/** "German", "German and Spanish", "German, Spanish and French". */
const listOf = (names: string[]) => (names.length < 2 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`);

/** What Cranoly Mono is, in three lines. */
function Intro({ onNext, onRestored }: { onNext: () => void; onRestored: () => void }) {
  return (
    <>
      <div className="wc-hero" aria-hidden>
        <span className="wc-mini is-sky">Hund <i>→</i> dog</span>
        <span className="wc-mini is-sun">la casa <i>→</i> the house</span>
        <span className="wc-mini is-lilac">merci <i>→</i> thank you</span>
      </div>
      <h1 className="wc-title">Your language notebook.</h1>
      <ul className="wc-features">
        <li>
          <span className="wc-icon"><Plus size={19} /></span>
          <span><b>Add a word in seconds</b><small>Type it. The meaning fills itself in.</small></span>
        </li>
        <li>
          <span className="wc-icon"><Volume2 size={19} /></span>
          <span><b>Hear how it sounds</b><small>Natural voices that work offline.</small></span>
        </li>
        <li>
          <span className="wc-icon"><Layers size={19} /></span>
          <span><b>Practise in a minute</b><small>Tap to flip. Swipe for the next one.</small></span>
        </li>
      </ul>
      <div className="wc-foot">
        <button className="btn btn-primary btn-lg" onClick={onNext}>
          <Tumble label="Get started">
            Get started <ArrowRight size={17} />
          </Tumble>
        </button>
      </div>
      <p className="wc-restore">
        Already use Cranoly Mono?{" "}
        <button
          onClick={() =>
            pickBackup((incoming) => {
              // A new device takes everything, settings too; one with notes brings the changes in.
              if (Object.keys(getVault().notes).length) bringIn(incoming);
              else replaceWith(incoming);
              onRestored();
            })
          }
        >
          Bring in your notes
        </button>
      </p>
    </>
  );
}

/** Which languages: one or more. The first one picked is the main one. Coming back, your picks are still there. */
function Languages({ initial, onNext }: { initial: string[]; onNext: (picked: string[]) => void }) {
  const { settings } = useVault();
  const [picked, setPicked] = useState<string[]>(initial);
  const toggle = (code: string) => {
    haptic();
    setPicked((p) => (p.includes(code) ? p.filter((c) => c !== code) : [...p, code]));
  };
  const shown = [...FEATURED, ...picked.filter((c) => !FEATURED.includes(c))];
  return (
    <>
      <h1 className="wc-title">What are you learning?</h1>
      <p className="wc-text">Pick one or more.</p>
      <div className="wc-langs" role="group" aria-label="Languages">
        {shown.map((code) => {
          const lang = languageOf(code);
          const on = picked.includes(code);
          return (
            <button key={code} className={`wc-lang${on ? " is-on" : ""}`} aria-pressed={on} onClick={() => toggle(code)}>
              <b>{lang.name}</b>
              <span lang={code}>{lang.hello}</span>
              {on && <Check size={18} className="wc-lang-check" aria-hidden />}
            </button>
          );
        })}
      </div>
      <label className="wc-more">
        <span>Something else?</span>
        <select value="" onChange={(e) => e.target.value && toggle(e.target.value)}>
          <option value="">More languages…</option>
          {LANGUAGES.filter((l) => !shown.includes(l.code)).map((l) => (
            <option key={l.code} value={l.code}>
              {l.name}
            </option>
          ))}
        </select>
      </label>
      <label className="wc-speak">
        <span>I speak</span>
        <select value={settings.native} onChange={(e) => vault.updateSettings({ native: e.target.value })}>
          {LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>
              {l.name}
            </option>
          ))}
        </select>
      </label>
      <div className="wc-foot">
        <button
          className="btn btn-primary btn-lg"
          disabled={!picked.length}
          onClick={() => {
            vault.updateSettings({ learning: picked[0], languages: picked });
            onNext(picked);
          }}
        >
          <Tumble label="Continue">
            Continue <ArrowRight size={17} />
          </Tumble>
        </button>
      </div>
    </>
  );
}

/** Download a natural voice for each language, right here. It carries on in the background. */
function Voices({ onNext }: { onNext: () => void }) {
  const { settings } = useVault();
  const voices = useVoices();
  const codes = settings.languages.filter((c) => languageOf(c).model);
  const started = codes.some((c) => (voices[c]?.status ?? "none") !== "none");
  const mb = downloadSize(codes);
  const connection = (navigator as Navigator & { connection?: { type?: string; saveData?: boolean } }).connection;
  const metered = connection?.type === "cellular" || connection?.saveData === true;
  return (
    <>
      <h1 className="wc-title">Hear it spoken.</h1>
      <p className="wc-text">
        {codes.length > 1 ? "Get natural" : "Get a natural"} {listOf(codes.map((c) => languageOf(c).name))}{" "}
        {codes.length > 1 ? "voices. They’re saved in Cranoly Mono and work" : "voice. It’s saved in Cranoly Mono and works"} offline.
      </p>
      <VoiceList codes={codes} offer={false} />
      {!started && metered && (
        <p className="wc-fine wc-note">
          <Wifi size={14} /> You’re on mobile data. This is a {mb} MB download.
        </p>
      )}
      <div className="wc-foot">
        {started ? (
          <button className="btn btn-primary btn-lg" onClick={onNext}>
            <Tumble label="Continue">
              Continue <ArrowRight size={17} />
            </Tumble>
          </button>
        ) : (
          <>
            <button className="btn btn-ghost btn-lg" onClick={onNext}>
              Not now
            </button>
            <button className="btn btn-primary btn-lg" onClick={() => codes.forEach((c) => void downloadVoice(c).catch(() => {}))}>
              <Tumble label={`Download · ${mb} MB`}>
                <Download size={17} /> Download · {mb} MB
              </Tumble>
            </button>
          </>
        )}
      </div>
      <p className="wc-fine wc-center">
        {started ? "It keeps downloading while you carry on." : "You can add voices later in Settings."}
      </p>
    </>
  );
}

/** Add a first word. The meaning fills itself in. */
function FirstWord({ onAdded, onSkip }: { onAdded: (front: string, back: string) => void; onSkip: () => void }) {
  const { settings } = useVault();
  const lang = languageOf(settings.learning);
  const [word, setWord] = useState("");
  const [typed, setTyped] = useState<string | null>(null);
  const found = useMeaning(word, lang, settings.onlineLookups);
  const meaning = typed ?? (found.status === "found" ? found.meaning ?? "" : "");
  const front = found.status === "found" && found.front ? found.front : word.trim();
  const add = () => {
    if (!word.trim() || !meaning.trim()) return;
    vault.addCard(front, meaning);
    haptic("success");
    onAdded(front, meaning.trim());
  };
  return (
    <>
      <h1 className="wc-title">Add your first {lang.name} word.</h1>
      <p className="wc-text">Type any word. Cranoly Mono finds what it means and turns it into a flashcard.</p>
      {lang.starter && (
        <div className="wc-chips">
          {lang.starter.map((w) => (
            <button key={w} className={`chip${word === w ? " on" : ""}`} onClick={() => { setWord(w); setTyped(null); }}>
              {w}
            </button>
          ))}
        </div>
      )}
      <div className="wc-form">
        <input
          className="wc-input"
          value={word}
          placeholder={`A ${lang.name} word`}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="next"
          onChange={(e) => {
            setWord(e.target.value);
            setTyped(null);
          }}
        />
        <div className="wc-meaning">
          <input
            className="wc-input"
            value={meaning}
            placeholder={found.status === "loading" ? "Looking it up…" : "Meaning"}
            enterKeyHint="done"
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
          />
          {found.status === "loading" && <Loader2 size={16} className="spin" />}
        </div>
        {front !== word.trim() && word.trim() && <p className="wc-fine">It will be saved as <b>{front}</b>.</p>}
      </div>
      <div className="wc-foot">
        <button className="btn btn-ghost btn-lg" onClick={onSkip}>
          Skip for now
        </button>
        <button className="btn btn-primary btn-lg" onClick={add} disabled={!word.trim() || !meaning.trim()}>
          <Tumble label="Add word">
            <Plus size={17} /> Add word
          </Tumble>
        </button>
      </div>
    </>
  );
}

/** The one thing to know about notes: select a word, then Flashcard or Link. No syntax to learn. */
function NotesTip({ word }: { word: string }) {
  return (
    <div className="wc-howto">
      <span className="wc-howto-demo" aria-hidden>
        <span className="wc-howto-bar">
          <span><Layers size={11} /> Flashcard</span>
          <span><Link2 size={11} /> Link</span>
        </span>
        <mark>{word}</mark>
      </span>
      <p>
        <b>In your notes,</b> select any word to make it a flashcard or a link to another note.
      </p>
    </div>
  );
}

/** Flip the card you just made. */
function TryIt({ card, onDone }: { card: { front: string; back: string } | null; onDone: () => void }) {
  const { settings } = useVault();
  const voices = useVoices();
  const lang = languageOf(settings.learning);
  const voice = voices[lang.code];
  const [flipped, setFlipped] = useState(false);
  useVoiceWarmup(lang.code);
  if (!card) {
    return (
      <>
        <h1 className="wc-title">You’re all set.</h1>
        <ul className="wc-tips">
          <li><b>＋</b> makes a new note. Scan a page or paste a word list from there too.</li>
          <li><b>Practice</b> shows your cards. Tap to flip, swipe up for the next.</li>
          <li><b>Add a word</b> in the Dictionary, or select one in a note and tap Flashcard.</li>
        </ul>
        <NotesTip word={languageOf(settings.learning).starter?.[0] ?? "word"} />
        <div className="wc-foot">
          <button className="btn btn-primary btn-lg" onClick={onDone}>
            <Tumble label="Start using Cranoly Mono">
              Start using Cranoly Mono <ArrowRight size={17} />
            </Tumble>
          </button>
        </div>
      </>
    );
  }
  return (
    <>
      <h1 className="wc-title">{flipped ? "That’s it!" : "Now try it."}</h1>
      <p className="wc-text">
        {flipped ? "Look, think, flip. That’s all practice is. Add words any time from the Dictionary." : "Say what it means in your head, then tap the card."}
      </p>
      <button
        className={`wc-card${flipped ? " is-flipped" : ""}`}
        onClick={() => {
          haptic();
          setFlipped((f) => !f);
        }}
        aria-label={flipped ? `Answer: ${card.back}` : `Card: ${card.front}. Tap to flip`}
      >
        <span className="wc-face wc-front">{card.front}</span>
        <span className="wc-face wc-back">{card.back}</span>
      </button>
      <button className="wc-say" onClick={() => say(card.front, lang)}>
        <Volume2 size={16} /> Hear it
        {voice?.status === "downloading" && <small>· voice {Math.round(voice.progress * 100)}%</small>}
      </button>
      {flipped && <NotesTip word={card.front.split(" ").at(-1) ?? card.front} />}
      <div className="wc-foot">
        <button className="btn btn-primary btn-lg" onClick={onDone} disabled={!flipped}>
          <Tumble label="Start using Cranoly Mono">
            <Check size={17} /> Start using Cranoly Mono
          </Tumble>
        </button>
      </div>
    </>
  );
}

function Flow() {
  const router = useRouter();
  // The screens you've seen, so Back returns to the one you came from (the voices screen only shows for some languages).
  const [seen, setSeen] = useState([0]);
  const step = seen[seen.length - 1];
  const setStep = (next: number) => setSeen((s) => [...s, next]);
  const back = () => setSeen((s) => (s.length > 1 ? s.slice(0, -1) : s));
  const [card, setCard] = useState<{ front: string; back: string } | null>(null);
  const [languages, setLanguages] = useState<string[]>([]);
  // Android's back button steps back too; on the first screen it leaves the app as usual.
  const canBack = seen.length > 1;
  useEffect(
    () =>
      onBack(() => {
        if (!canBack) return false;
        setSeen((s) => s.slice(0, -1));
        return true;
      }),
    [canBack],
  );
  const finish = () => {
    vault.updateSettings({ onboarded: true });
    router.push(window.matchMedia("(max-width: 820px)").matches ? "/notes" : "/");
  };
  return (
    <div className="wc-layer" data-no-swipe role="dialog" aria-modal="true" aria-label="Welcome to Cranoly Mono">
      <div className="wc-card-panel">
        <div className="wc-top">
          {step === 0 ? (
            <span className="wc-brand">
              <Logo size={30} /> Cranoly Mono
            </span>
          ) : (
            <>
              <button className="wc-prev" onClick={back} aria-label="Back">
                <ChevronLeft size={19} strokeWidth={2.3} /> Back
              </button>
              <Progress step={step} />
              <button className="wc-skip" onClick={finish}>
                Skip
              </button>
            </>
          )}
        </div>
        <div className="wc-body" key={step}>
          {step === 0 && <Intro onNext={() => setStep(1)} onRestored={finish} />}
          {step === 1 && (
            <Languages
              initial={languages}
              onNext={(picked) => {
                setLanguages(picked);
                setStep(picked.some((c) => languageOf(c).model && !voiceReady(c)) ? 2 : 3);
              }}
            />
          )}
          {step === 2 && <Voices onNext={() => setStep(3)} />}
          {step === 3 && (
            <FirstWord
              onAdded={(front, back) => {
                setCard({ front, back });
                setStep(4);
              }}
              onSkip={() => setStep(4)}
            />
          )}
          {step === 4 && <TryIt card={card} onDone={finish} />}
        </div>
      </div>
    </div>
  );
}

/** First launch: what Cranoly Mono is, your languages and their voices, a first word, a first card. Shown once. */
export default function Welcome() {
  const { ready, settings } = useVault();
  return ready && !settings.onboarded ? <Flow /> : null;
}
