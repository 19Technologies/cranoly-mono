"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, KeyRound, RotateCcw, Square, LetterText } from "lucide-react";
import Sheet from "./Sheet";
import Tumble from "./Tumble";
import MarkdownView from "./MarkdownView";
import { haptic } from "@/lib/native";
import { toast, useVault, vault } from "@/lib/store";
import { setUI, useUI } from "@/lib/ui";
import { LANGUAGES, cardExamples } from "@/lib/languages";
import { titleOf } from "@/lib/vault";
import { TASKS, cleanResult, formatParts, type FormatTask } from "@/lib/format";
import { AiProblem, MODEL_NAME, askClaude, looksLikeKey, setAiKey, useAiKey } from "@/lib/ai";

const close = () => setUI({ format: null });
const nameOf = (code: string) => LANGUAGES.find((l) => l.code === code)?.name ?? "English";

/** Paste your Anthropic API key once; it stays on this device. Also used in Settings › AI. */
export function KeyBox({ onSaved }: { onSaved?: () => void }) {
  const [key, setKey] = useState("");
  const ok = looksLikeKey(key);
  return (
    <div className="ai-key">
      <label className="add-field">
        <span>Your Anthropic API key</span>
        <input
          type="password"
          autoComplete="off"
          spellCheck={false}
          placeholder="sk-ant-…"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          aria-label="Anthropic API key"
        />
      </label>
      <p className="format-fine">
        Get one at{" "}
        <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer">
          console.anthropic.com
        </a>{" "}
        under API keys. It stays on this device and is never saved in your backups.
      </p>
      <button
        className="btn btn-primary"
        disabled={!ok}
        onClick={() => {
          setAiKey(key);
          haptic("success");
          toast("API key saved on this device");
          onSaved?.();
        }}
      >
        <KeyRound size={15} /> Save key
      </button>
      {key && !ok && <p className="format-fine">That doesn’t look like an Anthropic key. They start with sk-ant-.</p>}
    </div>
  );
}

type Step = { at: "pick" } | { at: "writing"; text: string } | { at: "ready"; text: string } | { at: "failed"; message: string };

function FormatFlow({ noteId }: { noteId: string }) {
  const { notes, settings } = useVault();
  const key = useAiKey();
  const note = notes[noteId];
  const [tasks, setTasks] = useState<FormatTask[]>(["tidy"]);
  const [step, setStep] = useState<Step>({ at: "pick" });
  const stop = useRef<AbortController | null>(null);
  // Stop writing if the sheet closes.
  useEffect(() => () => stop.current?.abort(), []);
  if (!note) return null;
  const empty = !note.content.trim();

  const run = async () => {
    const ex = cardExamples(settings.learning, settings.native).both;
    const { system, user } = formatParts({ title: titleOf(note.path), content: note.content }, tasks, {
      learning: nameOf(settings.learning),
      native: nameOf(settings.native),
      word: ex.front,
      meaning: ex.back,
    });
    haptic();
    const ctl = new AbortController();
    stop.current = ctl;
    setStep({ at: "writing", text: "" });
    // The preview redraws at most a few times a second while the reply streams in.
    let latest = "";
    let frame = 0;
    try {
      const text = await askClaude(
        system,
        user,
        (sofar) => {
          latest = sofar;
          if (!frame) frame = requestAnimationFrame(() => ((frame = 0), setStep({ at: "writing", text: latest })));
        },
        ctl.signal,
      );
      cancelAnimationFrame(frame);
      setStep({ at: "ready", text: cleanResult(text) });
      haptic("success");
    } catch (e) {
      cancelAnimationFrame(frame);
      const problem = e instanceof AiProblem ? e : new AiProblem("Something went wrong. Try again.");
      setStep(problem.stopped ? { at: "pick" } : { at: "failed", message: problem.message });
    } finally {
      stop.current = null;
    }
  };

  const apply = (how: "replace" | "below", text: string) => {
    const before = note.content;
    vault.updateNote(note.id, how === "replace" ? text : `${before.replace(/\s+$/, "")}\n\n${text}`);
    haptic("success");
    toast(how === "replace" ? "Note formatted" : "Added to the note", { label: "Undo", run: () => vault.updateNote(note.id, before) });
    close();
  };

  const title =
    step.at === "writing" ? `${MODEL_NAME} is writing…` : step.at === "ready" ? "Formatted" : step.at === "failed" ? "Couldn’t format" : "Format with AI";

  return (
    <Sheet open title={title} onClose={close} className="add-sheet format-sheet">
      {step.at === "pick" && (
        <>
          <p className="add-hint format-lede">Pick what to do. {MODEL_NAME} formats the note right here, and you choose whether to keep it.</p>
          <div className="format-tasks" role="group" aria-label="What to do">
            {TASKS.map((t) => {
              const on = tasks.includes(t.id);
              return (
                <button
                  key={t.id}
                  className={`chip${on ? " on" : ""}`}
                  aria-pressed={on}
                  onClick={() => {
                    haptic();
                    setTasks(on ? tasks.filter((x) => x !== t.id) : [...tasks, t.id]);
                  }}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
          {key ? (
            <>
              {empty && <p className="add-hint">This note is empty. Write something first.</p>}
              <div className="add-actions">
                <button className="btn btn-primary btn-lg" disabled={!tasks.length || empty} onClick={run}>
                  <Tumble label="Format">
                    <LetterText size={17} /> Format
                  </Tumble>
                </button>
              </div>
              <p className="format-fine">
                The note goes to Anthropic only when you tap Format. A typical note costs a few cents on your Anthropic
                account.
              </p>
            </>
          ) : (
            <KeyBox />
          )}
          <p className="format-fine">
            Rather do it yourself? See the{" "}
            <Link href="/formatting" onClick={close}>
              Formatting guide
            </Link>
            .
          </p>
        </>
      )}

      {(step.at === "writing" || step.at === "ready") && (
        <>
          <div className={`ai-preview${step.at === "writing" ? " is-writing" : ""}`} aria-live="polite">
            {step.text ? <MarkdownView content={step.text} interactive={false} /> : <p className="ai-waiting">Reading your note…</p>}
          </div>
          {step.at === "writing" ? (
            <div className="add-actions">
              <button className="btn btn-lg" onClick={() => stop.current?.abort()}>
                <Square size={15} /> Stop
              </button>
            </div>
          ) : (
            <>
              <div className="add-actions">
                <button className="btn btn-lg" onClick={() => apply("below", step.text)}>
                  Add below
                </button>
                <button className="btn btn-primary btn-lg" onClick={() => apply("replace", step.text)}>
                  <Check size={17} /> Replace note
                </button>
              </div>
              <div className="format-foot">
                <button className="format-link" onClick={run}>
                  <RotateCcw size={14} /> Try again
                </button>
              </div>
            </>
          )}
        </>
      )}

      {step.at === "failed" && (
        <>
          <p className="add-hint format-lede ai-problem">{step.message}</p>
          <div className="add-actions">
            <button className="btn btn-lg" onClick={() => setStep({ at: "pick" })}>
              Back
            </button>
            <button className="btn btn-primary btn-lg" onClick={run}>
              <RotateCcw size={16} /> Try again
            </button>
          </div>
        </>
      )}
    </Sheet>
  );
}

/** Format: Claude tidies, arranges, summarises, translates or makes cards from the note, right in the app. */
export default function FormatSheet() {
  const { format } = useUI();
  if (!format) return null;
  return <FormatFlow key={format.noteId} noteId={format.noteId} />;
}
