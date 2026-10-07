"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowLeft, ArrowRight, BookA, ChevronLeft, FileJson, FileText, Folder, FolderOpen, GraduationCap, Moon, MonitorSmartphone, SpellCheck, Sun, Volume2, X,
} from "lucide-react";
import { LANGUAGES, cardExamples } from "@/lib/languages";
import { useVault, vault } from "@/lib/store";
import { onBack, setUI, useUI } from "@/lib/ui";
import { useSlider } from "@/lib/useSlider";
import { haptic } from "@/lib/native";
import { isoDay } from "@/lib/vault";

/* Small live demos, one per step, drawn with the app's own styles. */

function DemoWelcome() {
  return (
    <div className="ob-demo ob-demo-bubbles" aria-hidden>
      <span className="bubble b1">[[Hallo]]</span>
      <span className="bubble b2">Hund :: dog</span>
      <span className="bubble b3">#deutsch</span>
      <span className="bubble b4">Tschüss!</span>
    </div>
  );
}

function DemoLinks() {
  return (
    <div className="ob-demo ob-demo-editor" aria-hidden>
      <div className="ob-line">
        Heute lerne ich <span className="ob-bracket">[[</span>
        <span className="ed-link">Verben</span>
        <span className="ob-bracket">]]</span>
        <span className="ob-caret" />
      </div>
      <div className="ob-suggest">
        <span className="ob-suggest-row is-active">Create note “Verben”</span>
        <span className="ob-suggest-row">Verbs: sein &amp; haben</span>
      </div>
    </div>
  );
}

function DemoCards() {
  const { settings } = useVault();
  const ex = cardExamples(settings.learning, settings.native);
  const rows: Array<[string, string, string, string]> = [
    [ex.one.code, "One card", `Shows ${ex.one.front}. You answer ${ex.one.back}.`, "sun"],
    [ex.both.code, "Two cards", "One asks the meaning, one asks the word.", "sky"],
    [ex.gap.code, "Fill the gap", `Hides ${ex.gap.hidden}. You fill it in.`, "lilac"],
    [ex.question.code, "Long question", "The line with ? splits the question from the answer.", "peach"],
  ];
  return (
    <div className="ob-demo ob-demo-list" aria-hidden>
      {rows.map(([code, label, line, tint]) => (
        <div key={label} className="ob-syntax">
          <span className="ob-syntax-text">
            <code>{code}</code>
            <small>{line}</small>
          </span>
          <span className={`ob-pill tint-${tint}`}>{label}</span>
        </div>
      ))}
    </div>
  );
}

/** A note whose button flips between Edit and Read, the way it does in the app. */
function DemoModes() {
  const { settings } = useVault();
  const ex = cardExamples(settings.learning, settings.native);
  const [reading, setReading] = useState(true);
  useEffect(() => {
    const t = setInterval(() => setReading((r) => !r), 2200);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="ob-demo ob-demo-modes" aria-hidden>
      <div className="ob-modes-bar">
        <span className="ob-modes-title">My words</span>
        <span className="ob-modes-pill">
          <span key={reading ? "edit" : "read"} className="mode-word">
            {reading ? "Edit" : "Read"}
          </span>
        </span>
      </div>
      <div className="ob-modes-body" key={reading ? "r" : "e"}>
        {reading ? (
          <p>
            <b>{ex.one.front}</b> means {ex.one.back}.
          </p>
        ) : (
          <p>
            <span className="ob-bracket">**</span>
            <b>{ex.one.front}</b>
            <span className="ob-bracket">**</span> means {ex.one.back}.<span className="ob-caret" />
          </p>
        )}
        <small>{reading ? "Reading: clean, tap links and flip cards." : "Editing: the formatting shows as you type."}</small>
      </div>
    </div>
  );
}

/** Closes the tour and opens the Formatting guide. */
function GuideLink() {
  const router = useRouter();
  return (
    <button
      type="button"
      className="ob-link"
      onClick={() => {
        setUI({ onboarding: false });
        router.push("/formatting");
      }}
    >
      Formatting guide
    </button>
  );
}

function DemoStudy() {
  return (
    <div className="ob-demo ob-demo-study" aria-hidden>
      <div className="ob-flip">
        <div className="ob-face ob-front">Hallo</div>
        <div className="ob-face ob-back">Hello</div>
      </div>
      <div className="ob-keys">
        <kbd>Space</kbd> flip <kbd>↑</kbd>
        <kbd>↓</kbd> move <span className="ob-no-grade">No grading. Just scroll through.</span>
      </div>
    </div>
  );
}

function DemoGraph() {
  const nodes: Array<[number, number, number, string]> = [
    [150, 80, 6, "Greetings"],
    [60, 50, 4, "Welcome"],
    [240, 45, 4, "Verbs"],
    [85, 140, 4.5, "Cases"],
    [230, 140, 3.5, "Daily"],
  ];
  const links: Array<[number, number]> = [[0, 1], [0, 2], [0, 3], [0, 4], [1, 3], [2, 3]];
  return (
    <div className="ob-demo ob-demo-graph" aria-hidden>
      <svg viewBox="0 0 300 180">
        {links.map(([a, b], i) => (
          <line
            key={i}
            x1={nodes[a][0]}
            y1={nodes[a][1]}
            x2={nodes[b][0]}
            y2={nodes[b][1]}
            className={a === 0 ? "ob-edge is-hot" : "ob-edge"}
          />
        ))}
        {nodes.map(([x, y, r, label], i) => (
          <g key={label}>
            <circle cx={x} cy={y} r={r} className={i === 0 ? "ob-node is-active" : "ob-node"} style={{ fill: i ? `var(--mm-${i})` : undefined }} />
            <text x={x} y={y + r + 13} textAnchor="middle" className="ob-label">
              {label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function DemoSmart() {
  return (
    <div className="ob-demo ob-demo-smart" aria-hidden>
      <div className="ob-sel-bar">
        <span><BookA size={13} /> Explain</span>
        <span><Volume2 size={13} /> Hear</span>
        <span><SpellCheck size={13} /> Check</span>
      </div>
      <div className="ob-line">
        Der <span className="ob-selected">Hund</span> schläft im <span className="ob-issue">garten</span>.
      </div>
      <div className="ob-definition">
        <b><span className="ob-article">der</span> Hund</b>
        <span>dog, hound</span>
        <span className="ob-pill tint-sun">Save card</span>
      </div>
    </div>
  );
}

function DemoShortcuts() {
  const keys: Array<[string, string]> = [
    ["⌘K", "Commands"],
    ["⌘O", "Jump to a note"],
    ["⌘E", "Read / edit"],
    ["⌘⇧F", "Search"],
  ];
  const gestures: Array<[string, string]> = [
    ["Swipe right", "Files"],
    ["Swipe left", "Links & outline"],
    ["Pull down", "Commands"],
    ["Long-press", "File actions"],
  ];
  return (
    <div className="ob-demo ob-demo-grid" aria-hidden>
      <div>
        <b>On a computer</b>
        {keys.map(([k, v]) => (
          <span key={k}>
            <kbd>{k}</kbd> {v}
          </span>
        ))}
      </div>
      <div>
        <b>On a phone</b>
        {gestures.map(([k, v]) => (
          <span key={k}>
            <em>{k}</em> {v}
          </span>
        ))}
      </div>
    </div>
  );
}

/** The Cranoly Mono folder filling up as you write: each note a file, in its folder, and the backup file. */
function DemoFolder() {
  const rows: Array<[ReactNode, string, string]> = [
    [<Folder key="i" size={15} />, "German", "is-dir"],
    [<FileText key="i" size={14} />, "Words.md", "is-file"],
    [<FileText key="i" size={14} />, "Lesson 13.md", "is-file"],
    [<Folder key="i" size={15} />, "Daily", "is-dir"],
    [<FileText key="i" size={14} />, `${isoDay(new Date())}.md`, "is-file"],
    [<FileJson key="i" size={14} />, "Cranoly Mono backup (Phone).json", "is-backup"],
  ];
  return (
    <div className="ob-demo ob-demo-folder" aria-hidden>
      <span className="ob-tree-root">
        <FolderOpen size={16} /> Cranoly Mono
      </span>
      <ul className="ob-tree">
        {rows.map(([icon, name, kind], i) => (
          <li key={name} className={`ob-tree-row ${kind}`} style={{ animationDelay: `${0.25 + i * 0.35}s` }}>
            {icon} {name}
          </li>
        ))}
      </ul>
    </div>
  );
}

function DemoTheme() {
  const { settings } = useVault();
  const options = [
    { id: "graphite", label: "Graphite", icon: <Moon size={18} /> },
    { id: "paper", label: "Paper", icon: <Sun size={18} /> },
    { id: "system", label: "System", icon: <MonitorSmartphone size={18} /> },
  ] as const;
  const seg = useSlider<HTMLDivElement>(".is-on", settings.theme);
  return (
    <div className="ob-demo">
      <div ref={seg} className="seg seg-tall has-slider" role="radiogroup" aria-label="Theme">
        <span className="slider-pill" aria-hidden />
        {options.map((o) => (
          <button
            key={o.id}
            role="radio"
            aria-checked={settings.theme === o.id}
            className={settings.theme === o.id ? "is-on" : ""}
            onClick={() => {
              if (settings.theme !== o.id) haptic();
              vault.updateSettings({ theme: o.id });
            }}
          >
            {o.icon}
            <span>{o.label}</span>
          </button>
        ))}
      </div>
      <label className="ob-lang">
        <span>I’m learning</span>
        <select value={settings.learning} onChange={(e) => vault.updateSettings({ learning: e.target.value })}>
          {LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>
              {l.name}
            </option>
          ))}
        </select>
      </label>
      <p className="ob-fine">
        Tip: add Cranoly Mono to your home screen from Settings → Install the app. It works offline.
      </p>
    </div>
  );
}

interface Step {
  title: string;
  body: ReactNode;
  demo: ReactNode;
}

const STEPS: Step[] = [
  {
    title: "Notes that connect.",
    body: "Cranoly Mono is a notebook for learning languages. Your notes link together, and your flashcards live right inside them.",
    demo: <DemoWelcome />,
  },
  {
    title: "Read or edit.",
    body: (
      <>
        Every note has two views. <b>Read</b> shows it cleanly, with links to tap and cards to flip. <b>Edit</b> is where you
        change it, and the formatting shows as you type. The button at the top names where it takes you: <b>Edit</b> while
        you read, <b>Read</b> while you edit. For full control, <b>Source mode</b> in the ••• menu shows every symbol.
      </>
    ),
    demo: <DemoModes />,
  },
  {
    title: "Link your ideas.",
    body: (
      <>
        Type <b>[[</b> and a note name. If the note doesn&apos;t exist yet, pick <b>Create note</b>. Links show up green,
        and a tap opens them.
      </>
    ),
    demo: <DemoLinks />,
  },
  {
    title: "Write cards as you write notes.",
    body: (
      <>
        Any line can be a flashcard, and cards gather into decks named after the note&apos;s folder. <b>Answer first</b>{" "}
        in practice flips any card the other way. Everything you can write is in the <GuideLink />.
      </>
    ),
    demo: <DemoCards />,
  },
  {
    title: "Scroll through your decks.",
    body: "Open Practice and pick a deck. Cards scroll like a feed, one per screen: tap or press Space to flip, swipe up or press ↓ for the next. Your study days fill the activity heatmap.",
    demo: <DemoStudy />,
  },
  {
    title: "See how it all fits.",
    body: "The right sidebar shows which notes link to the one you're reading. The Mind Map draws all your notes as dots, joined by their links. Tap any dot to open that note.",
    demo: <DemoGraph />,
  },
  {
    title: "Your notebook helps you learn.",
    body: (
      <>
        Select a word to <b>Explain</b> it, <b>Hear</b> it or save it as a card. <b>Check my writing</b> finds mistakes,{" "}
        <b>Find new words</b> turns any text into cards, and search answers questions from your notes.
      </>
    ),
    demo: <DemoSmart />,
  },
  {
    title: "Move fast.",
    body: "A few shortcuts and gestures get you anywhere in a second.",
    demo: <DemoShortcuts />,
  },
  {
    title: "Your notes are safe.",
    body: (
      <>
        Everything you write is also saved in a folder called <b>Cranoly Mono</b>: each note is its own file, in the same folders
        you see here. On a phone it&apos;s in Documents. On a laptop you choose where; pick Google Drive and it&apos;s online
        too. To use your notes on another device, share a copy from one and tap <b>Bring in changes</b> on the other. It&apos;s
        all in Settings › Backup and sync.
      </>
    ),
    demo: <DemoFolder />,
  },
  {
    title: "Make it yours.",
    body: "Pick a look and the language you’re learning. You can change both any time in Settings.",
    demo: <DemoTheme />,
  },
];

function Tour() {
  const router = useRouter();
  const pathname = usePathname();
  const [step, setStep] = useState(0);
  const last = step === STEPS.length - 1;
  const s = STEPS[step];
  const close = () => setUI({ onboarding: false });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setUI({ onboarding: false });
      else if (e.key === "ArrowRight") setStep((n) => Math.min(n + 1, STEPS.length - 1));
      else if (e.key === "ArrowLeft") setStep((n) => Math.max(n - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Android's back button goes one step back; from the first step it closes the tour.
  useEffect(
    () =>
      onBack(() => {
        if (step > 0) setStep(step - 1);
        else setUI({ onboarding: false });
        return true;
      }),
    [step],
  );

  const finish = () => {
    close();
    setUI({ pendingRename: vault.createNote() });
    if (pathname !== "/") router.push("/");
  };

  return (
    <div className="ob-layer" data-no-swipe role="dialog" aria-modal="true" aria-label="Learn Cranoly Mono">
      <div className="ob-backdrop" onClick={close} />
      <div className="ob-card">
        <div className="ob-top">
          <button className="icon-btn" onClick={() => setStep((n) => Math.max(n - 1, 0))} disabled={step === 0} aria-label="Previous step">
            <ArrowLeft size={18} />
          </button>
          <div className="ob-progress" aria-label={`Step ${step + 1} of ${STEPS.length}`}>
            <i style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
          </div>
          <button className="icon-btn" onClick={close} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="ob-body" key={step}>
          <h1 className="ob-title">{s.title}</h1>
          <p className="ob-text">{s.body}</p>
          {s.demo}
        </div>
        <div className="ob-foot">
          {last ? (
            <>
              <button className="btn btn-lg" onClick={close}>
                Explore first
              </button>
              <button className="btn btn-primary btn-lg" onClick={finish}>
                Create my first note
              </button>
            </>
          ) : (
            <>
              {step === 0 ? (
                <button className="btn btn-ghost btn-lg" onClick={close}>
                  Skip
                </button>
              ) : (
                <button className="btn btn-lg ob-back-btn" onClick={() => setStep(step - 1)}>
                  <ChevronLeft size={18} strokeWidth={2.3} /> Back
                </button>
              )}
              <button className="btn btn-primary btn-lg" onClick={() => setStep(step + 1)}>
                {step === 0 ? "Show me" : "Next"} <ArrowRight size={18} />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Onboarding() {
  const { onboarding } = useUI();
  return onboarding ? <Tour /> : null;
}

/** The "Learn" button that opens the tour. */
export function LearnButton({
  className = "learn-btn",
  label = true,
  text = "Learn",
}: {
  className?: string;
  label?: boolean;
  text?: string;
}) {
  return (
    <button className={className} onClick={() => setUI({ onboarding: true, mobileLeft: false, sheet: null })} title="Learn the basics" aria-label="Learn the basics">
      <GraduationCap size={17} />
      {label && <span>{text}</span>}
    </button>
  );
}
