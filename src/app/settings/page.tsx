"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  ArrowDownToLine, Check, Download, FolderOpen, GraduationCap, KeyRound, RotateCcw, Save, Share, Share2, Smartphone, Hand, Sun, Moon, MonitorSmartphone, Type, X,
} from "lucide-react";
import VoiceList from "@/components/Voices";
import { download } from "@/components/CommandPalette";
import { pickBackup } from "@/components/BringIn";
import { KeyBox } from "@/components/FormatSheet";
import { MODEL_NAME, maskKey, setAiKey, useAiKey } from "@/lib/ai";
import { allowFolder, chooseFolder, downloadZip, folderKind, forgetFolder, saveNow, setAutoSave, shareCopy, useBackupStatus } from "@/lib/backup";
import { toast, useVault, vault } from "@/lib/store";
import type { Settings } from "@/lib/vault";
import { LANGUAGES, languageOf } from "@/lib/languages";
import { ENGINE_MB, downloadVoice, useVoices } from "@/lib/voices";
import { setUI, useUI } from "@/lib/ui";
import { useSlider } from "@/lib/useSlider";
import { haptic } from "@/lib/native";

function Appearance() {
  const { settings } = useVault();
  const options = [
    { id: "graphite", label: "Graphite", hint: "Graphite black", icon: <Moon size={18} /> },
    { id: "paper", label: "Paper", hint: "Warm and light", icon: <Sun size={18} /> },
    { id: "system", label: "System", hint: "Follow device", icon: <MonitorSmartphone size={18} /> },
  ] as const;
  const seg = useSlider<HTMLDivElement>(".is-on", settings.theme);
  return (
    <section className="card-panel">
      <div className="card-panel-head"><h2>Appearance</h2></div>
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
            <small>{o.hint}</small>
          </button>
        ))}
      </div>
    </section>
  );
}

function LanguageSettings() {
  const { settings } = useVault();
  const learning = languageOf(settings.learning);
  const others = settings.languages.filter((c) => c !== settings.learning);
  const addable = LANGUAGES.filter((l) => !settings.languages.includes(l.code));
  const picker = (label: string, field: "learning" | "native") => (
    <label className="field">
      <span>{label}</span>
      <select value={settings[field]} onChange={(e) => vault.updateSettings({ [field]: e.target.value })}>
        {LANGUAGES.map((l) => (
          <option key={l.code} value={l.code}>
            {l.name}
          </option>
        ))}
      </select>
    </label>
  );
  return (
    <section className="card-panel">
      <div className="card-panel-head"><h2>Languages</h2></div>
      <div className="field-row">
        {picker("I\u2019m learning", "learning")}
        {picker("I speak", "native")}
      </div>
      <div className="lang-also">
        <span>Also learning</span>
        <div className="lang-chips">
          {others.map((c) => (
            <span key={c} className="lang-chip">
              <button onClick={() => vault.updateSettings({ learning: c })} title="Switch to this language">
                {languageOf(c).name}
              </button>
              <button
                onClick={() => vault.updateSettings({ languages: settings.languages.filter((x) => x !== c) })}
                aria-label={`Stop learning ${languageOf(c).name}`}
              >
                <X size={14} />
              </button>
            </span>
          ))}
          {addable.length > 0 && (
            <select
              className="lang-add"
              value=""
              aria-label="Add a language"
              onChange={(e) => e.target.value && vault.updateSettings({ languages: [...settings.languages, e.target.value] })}
            >
              <option value="">＋ Add a language</option>
              {addable.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>
      <p className="setting-note">
        Used for pronunciation, Explain, Check my writing and new-word lists. With more than one language, each gets its
        own words note, and Practice and the Dictionary let you switch between them.
        {!learning.grammar && ` Check my writing isn\u2019t available for ${learning.name} yet.`}
      </p>
      <Toggle
        field="onlineLookups"
        label="Online lookups"
        hint="Explain asks Wiktionary and Check asks LanguageTool. Only the word or text you chose is sent, and only when you tap. Everything else stays on this device."
      />
    </section>
  );
}

/** Natural voices: download, hear, remove. Also offered during onboarding and from "Hear it". */
function VoiceSettings() {
  const { settings } = useVault();
  const voices = useVoices();
  const has = (code: string) => (voices[code]?.status ?? "none") !== "none";
  const codes = [...settings.languages, ...LANGUAGES.filter((l) => has(l.code) && !settings.languages.includes(l.code)).map((l) => l.code)];
  const more = LANGUAGES.filter((l) => l.model && !codes.includes(l.code));
  const engineNeeded = !LANGUAGES.some((l) => voices[l.code]?.status === "ready");
  return (
    <section className="card-panel" id="voices">
      <div className="card-panel-head"><h2>Voices</h2></div>
      <p className="setting-note">
        Natural voices for <b>Hear it</b>. They&apos;re saved in Cranoly Mono and work offline.
        {engineNeeded && ` The first one also brings the speech engine (${ENGINE_MB} MB).`}
      </p>
      <VoiceList codes={codes} removable />
      {more.length > 0 && (
        <label className="field voice-more">
          <span>Another language</span>
          <select value="" onChange={(e) => e.target.value && void downloadVoice(e.target.value).catch(() => {})}>
            <option value="">Download a voice…</option>
            {more.map((l) => (
              <option key={l.code} value={l.code}>
                {l.name} · {l.model!.mb} MB
              </option>
            ))}
          </select>
        </label>
      )}
    </section>
  );
}

function InstallApp() {
  const { installPrompt } = useUI();
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent));

  return (
    <section className="card-panel">
      <div className="card-panel-head"><h2>Install the app</h2></div>
      {standalone ? (
        <p className="setting-note">Cranoly Mono is installed on this device and works offline.</p>
      ) : installPrompt ? (
        <>
          <p className="setting-note">Add Cranoly Mono to your home screen. It opens full-screen and works offline.</p>
          <button
            className="btn btn-primary"
            onClick={async () => {
              await installPrompt.prompt();
              const { outcome } = await installPrompt.userChoice;
              setUI({ installPrompt: null });
              if (outcome === "accepted") toast("Installing Cranoly Mono…");
            }}
          >
            <Smartphone size={14} /> Install Cranoly Mono
          </button>
        </>
      ) : ios ? (
        <p className="setting-note install-steps">
          In Safari, tap <Share size={14} /> <b>Share</b>, then <b>Add to Home Screen</b>. Cranoly Mono then opens
          full-screen like a regular app and works offline.
        </p>
      ) : (
        <p className="setting-note">
          Use your browser&apos;s <b>Install app</b> or <b>Add to Home screen</b> option. Cranoly Mono then opens in its own
          window and works offline.
        </p>
      )}
    </section>
  );
}

type Switchable = { [K in keyof Settings]: Settings[K] extends boolean ? K : never }[keyof Settings];

function Toggle({ label, hint, field }: { label: string; hint: string; field: Switchable }) {
  const { settings } = useVault();
  return (
    <label className="setting">
      <span className="setting-text">
        <b>{label}</b>
        <span>{hint}</span>
      </span>
      <span className="switch">
        <input
          type="checkbox"
          checked={settings[field]}
          onChange={(e) => {
            haptic();
            vault.updateSettings({ [field]: e.target.checked });
          }}
        />
        <span className="switch-track" />
      </span>
    </label>
  );
}

const SHORTCUTS: Array<[string, string]> = [
  ["⌘K", "Command palette"],
  ["⌘O", "Quick switcher: open or create a note"],
  ["⌘E", "Switch between reading and editing"],
  ["⌘⇧F", "Search every note"],
  ["⌘\\", "Show or hide the file explorer"],
  ["⌘⌥← / →", "Back and forward"],
  ["[[", "Link to a note while typing"],
  ["⌘-click", "Open a link in a new tab"],
];

/** Re-render every half minute, so "2 min ago" stays true. */
function useClock() {
  return useSyncExternalStore(
    (tick) => {
      const id = setInterval(tick, 30_000);
      return () => clearInterval(id);
    },
    () => Math.floor(Date.now() / 30_000),
    () => 0,
  );
}

/** How long ago, in plain words: "just now", "4 min ago", "2 h ago", "yesterday", "3 Oct". */
function ago(t: number) {
  const s = (Date.now() - t) / 1000;
  if (s < 45) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86_400) return `${Math.round(s / 3600)} h ago`;
  if (s < 2 * 86_400) return "yesterday";
  return new Date(t).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

/**
 * Backup and sync: the Cranoly Mono folder (each note as a file, plus one backup file), saved as you go,
 * and how to move notes between devices by bringing in a backup from the other one.
 */
function BackupSettings() {
  const { notes, activity } = useVault();
  const s = useBackupStatus();
  const kind = folderKind();
  const count = Object.keys(notes).length;
  const bytes = vault.exportJSON().length;
  useClock();

  const where = kind === "app" ? s.folder ?? "Documents › Cranoly Mono" : s.folder;
  const state = s.saving
    ? "Saving…"
    : s.error
      ? s.error
      : s.lastSaved
        ? `Saved ${ago(s.lastSaved)}${where && kind !== "zip" ? ` to ${where}` : ""}`
        : kind === "zip"
          ? "No backup saved on this device yet"
          : "Not saved yet";

  return (
    <section className="card-panel" id="backup">
      <div className="card-panel-head"><h2>Backup and sync</h2></div>
      {kind === "app" && (
        <p className="setting-note">
          Cranoly Mono keeps a copy of everything in <b>Documents › Cranoly Mono</b> on this phone and updates it as you go. Each note is
          its own file, in the same folders as here, next to one backup file with your study history. A copy from each of the
          last 7 days is kept too. Open the Files app to see it.
        </p>
      )}
      {kind === "pick" && (
        <p className="setting-note">
          {s.where === "folder"
            ? "Cranoly Mono keeps a copy of everything in this folder and updates it as you go: each note as its own file, in the same folders as here, next to one backup file with your study history."
            : "Choose a folder and Cranoly Mono keeps a copy of everything in it as you go: each note as its own file, in the same folders as here, next to one backup file with your study history. Choose a folder in Google Drive, Dropbox or iCloud Drive and your notes are online too."}
        </p>
      )}
      {kind === "zip" && (
        <p className="setting-note">
          Save a backup to download <b>Cranoly Mono.zip</b>: each note as its own file, in the same folders as here, next to one
          backup file with your study history. Keep it somewhere safe, like Google Drive.
        </p>
      )}

      {(kind !== "pick" || s.where === "folder") && (
        <p className={`backup-status${s.error ? " is-error" : s.lastSaved ? " is-saved" : ""}`} role="status">
          {s.lastSaved && !s.error && !s.saving ? <Check size={15} /> : <FolderOpen size={15} />} {state}
          {kind === "app" && ` · ${count} ${count === 1 ? "note" : "notes"}`}
        </p>
      )}
      {s.needsPermission && (
        <div className="backup-allow">
          <span>Your browser asks once after a restart before Cranoly Mono can save to the folder again.</span>
          <button className="btn btn-primary" onClick={() => void allowFolder()}>
            <FolderOpen size={14} /> Allow
          </button>
        </div>
      )}

      <div className="btn-row">
        {kind === "app" && (
          <>
            <button className="btn" onClick={() => void saveNow({ all: true })}>
              <Save size={14} /> Save now
            </button>
            <button className="btn" onClick={() => void shareCopy().catch(() => toast("Couldn’t open the share sheet"))}>
              <Share2 size={14} /> Share a copy
            </button>
          </>
        )}
        {kind === "pick" &&
          (s.where === "folder" ? (
            <>
              <button className="btn" onClick={() => void saveNow({ all: true })}>
                <Save size={14} /> Save now
              </button>
              <button className="btn" onClick={() => void chooseFolder().catch(() => {})}>
                <FolderOpen size={14} /> Change folder
              </button>
              <button className="btn" onClick={() => void forgetFolder()}>
                <X size={14} /> Stop saving here
              </button>
            </>
          ) : (
            <>
              <button className="btn btn-primary" onClick={() => void chooseFolder().catch(() => {})}>
                <FolderOpen size={14} /> Choose a folder
              </button>
              <button className="btn" onClick={downloadZip}>
                <Download size={14} /> Save a backup (.zip)
              </button>
            </>
          ))}
        {kind === "zip" && (
          <button className="btn btn-primary" onClick={downloadZip}>
            <Download size={14} /> Save a backup
          </button>
        )}
        <button className="btn" onClick={() => pickBackup()}>
          <ArrowDownToLine size={14} /> Bring in changes
        </button>
      </div>
      {kind === "app" && (
        <label className="setting">
          <span className="setting-text">
            <b>Save automatically</b>
            <span>Update the Cranoly Mono folder a few seconds after each change.</span>
          </span>
          <span className="switch">
            <input type="checkbox" checked={s.auto} onChange={(e) => setAutoSave(e.target.checked)} />
            <span className="switch-track" />
          </span>
        </label>
      )}

      <h3 className="setting-sub">Your notes on another device</h3>
      <ol className="sync-steps">
        <li>
          {kind === "app" ? (
            <>On the device with your newest notes, tap <b>Share a copy</b> and send it to Google Drive, Quick Share or email.</>
          ) : (
            <>Save a backup on the device with your newest notes. On a phone, that&apos;s <b>Share a copy</b>.</>
          )}
        </li>
        <li>
          On the other device, tap <b>Bring in changes</b> and pick that backup. On a phone, the picker can open Google Drive
          directly.
        </li>
        <li>New notes are added and edits come across. A note changed on both devices is kept twice, so nothing is lost.</li>
      </ol>
      {kind === "pick" && (
        <p className="setting-note">
          Keep the Cranoly Mono folder in Google Drive, and a backup your phone shares into it is brought in when you open Cranoly Mono here.
        </p>
      )}
      <p className="setting-fine">
        {count} {count === 1 ? "note" : "notes"}, {Object.keys(activity).length} days of study history, {(bytes / 1024).toFixed(1)} KB.{" "}
        <button
          className="link-btn"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(vault.exportMarkdown());
              toast("All notes copied as Markdown");
            } catch {
              download("cranoly-notes.md", vault.exportMarkdown(), "text/markdown");
            }
          }}
        >
          Copy all as Markdown
        </button>
      </p>
    </section>
  );
}

/** Built-in AI: Claude with your own Anthropic API key, kept on this device only. */
function AiSettings() {
  const key = useAiKey();
  return (
    <section className="card-panel" id="ai">
      <div className="card-panel-head"><h2>AI</h2></div>
      <p className="setting-note">
        Format with AI uses <b>{MODEL_NAME}</b> with your own Anthropic API key. The key stays on this device and is never
        saved in your backups. A note goes to Anthropic only when you tap Format, and each one costs a few cents on your
        Anthropic account.
      </p>
      {key ? (
        <div className="ai-key-saved">
          <span>
            <KeyRound size={15} /> Key saved: <code>{maskKey(key)}</code>
          </span>
          <button className="btn" onClick={() => setAiKey(null)}>
            <X size={14} /> Remove
          </button>
        </div>
      ) : (
        <KeyBox />
      )}
    </section>
  );
}

export default function SettingsPage() {
  const { notes } = useVault();
  const [confirmReset, setConfirmReset] = useState(false);

  return (
    <div className="page page-narrow">
      <header className="page-header">
        <p className="eyebrow">Settings</p>
        <h1>Settings</h1>
      </header>

      <Appearance />
      <BackupSettings />
      <AiSettings />
      <LanguageSettings />
      <VoiceSettings />
      <InstallApp />

      <section className="card-panel">
        <div className="card-panel-head"><h2>Flashcards</h2></div>
        <Toggle field="shuffle" label="Shuffle decks" hint="Mix up the card order each time you start studying." />
        <Toggle field="startWithBack" label="Answer side first" hint="Show the back of each card first, to practise recall the other way round." />
        <Toggle field="blurAnswersInNotes" label="Blur answers in notes" hint="Card answers in reading view stay blurred until you hover over them." />
      </section>

      <section className="card-panel">
        <div className="card-panel-head"><h2>Mind Map</h2></div>
        <Toggle field="showTagsInGraph" label="Show tags" hint="Draw #tags as their own dots, linked to the notes that use them." />
        <Toggle field="showOrphansInGraph" label="Show orphans" hint="Include notes that don't link to anything." />
      </section>

      <section className="card-panel">
        <div className="card-panel-head"><h2>Help</h2></div>
        <div className="btn-row">
          <button className="btn" onClick={() => setUI({ onboarding: true })}>
            <GraduationCap size={14} /> Take the tour
          </button>
          <Link className="btn" href="/formatting">
            <Type size={14} /> Formatting guide
          </Link>
          <button className="btn" onClick={() => vault.updateSettings({ onboarded: false })}>
            <Hand size={14} /> Show the welcome again
          </button>
        </div>
      </section>

      <section className="card-panel only-wide">
        <div className="card-panel-head"><h2>Keyboard</h2></div>
        <dl className="shortcuts">
          {SHORTCUTS.map(([k, v]) => (
            <div key={k}>
              <dt><kbd>{k}</kbd></dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="card-panel danger">
        <div className="card-panel-head"><h2>Reset</h2></div>
        <p className="setting-note">Delete every note on this device and start again. Save a backup first if you want to keep them.</p>
        {confirmReset ? (
          <div className="btn-row">
            <span className="confirm-text">This deletes all {Object.keys(notes).length} notes.</span>
            <button
              className="btn btn-danger"
              onClick={() => {
                vault.reset();
                setConfirmReset(false);
                toast("All notes deleted");
              }}
            >
              Yes, delete everything
            </button>
            <button className="btn btn-ghost" onClick={() => setConfirmReset(false)}>
              Cancel
            </button>
          </div>
        ) : (
          <button className="btn btn-danger-outline" onClick={() => setConfirmReset(true)}>
            <RotateCcw size={14} /> Delete all notes…
          </button>
        )}
      </section>
    </div>
  );
}
