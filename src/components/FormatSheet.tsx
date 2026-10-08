"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, ClipboardCopy, ClipboardPaste, ExternalLink } from "lucide-react";
import Sheet from "./Sheet";
import Tumble from "./Tumble";
import MarkdownView from "./MarkdownView";
import { haptic } from "@/lib/native";
import { toast, useVault, vault } from "@/lib/store";
import { setUI, useUI } from "@/lib/ui";
import { LANGUAGES, cardExamples } from "@/lib/languages";
import { titleOf } from "@/lib/vault";
import { TASKS, buildPrompt, claudeLink, cleanResult, type FormatTask } from "@/lib/format";

const close = () => setUI({ format: null });
const nameOf = (code: string) => LANGUAGES.find((l) => l.code === code)?.name ?? "English";

/** Claude is open. `filled`: with the request typed in. `copied`: the request is on the clipboard (null while copying). */
interface Sent {
  prompt: string;
  url: string;
  filled: boolean;
  copied: boolean | null;
}

function FormatFlow({ noteId }: { noteId: string }) {
  const { notes, settings } = useVault();
  const note = notes[noteId];
  const [tasks, setTasks] = useState<FormatTask[]>(["tidy"]);
  const [sent, setSent] = useState<Sent | null>(null);
  const [reply, setReply] = useState<string | null>(null);
  // Reading the clipboard isn't allowed everywhere; then the reply is pasted into a box by hand.
  const [byHand, setByHand] = useState(false);
  const [typed, setTyped] = useState("");
  if (!note) return null;
  const empty = !note.content.trim();

  const send = () => {
    const ex = cardExamples(settings.learning, settings.native).both;
    const prompt = buildPrompt({ title: titleOf(note.path), content: note.content }, tasks, {
      learning: nameOf(settings.learning),
      native: nameOf(settings.native),
      word: ex.front,
      meaning: ex.back,
    });
    const { url, filled } = claudeLink(prompt);
    // Copy first, while the tap still counts, then open Claude. The Claude app may open a blank chat
    // instead of the typed-in request, so the clipboard is the backup.
    let copying: Promise<boolean>;
    try {
      copying = navigator.clipboard.writeText(prompt).then(
        () => true,
        () => false,
      );
    } catch {
      copying = Promise.resolve(false);
    }
    window.open(url, "_blank", "noopener,noreferrer");
    haptic();
    setSent({ prompt, url, filled, copied: null });
    setReply(null);
    copying.then((copied) => setSent((s) => s && { ...s, copied }));
  };

  const take = (raw: string, prompt: string) => {
    const text = raw.trim();
    if (!text) return toast("Nothing to paste yet. Copy Claude’s reply first.");
    if (text === prompt.trim()) return toast("That’s still the request. Copy Claude’s reply first.");
    haptic("success");
    setReply(cleanResult(text));
  };

  const paste = async (prompt: string) => {
    try {
      take(await navigator.clipboard.readText(), prompt);
    } catch {
      setByHand(true);
    }
  };

  const copyAgain = (prompt: string) =>
    navigator.clipboard?.writeText(prompt).then(
      () => toast("Request copied"),
      () => toast("Couldn’t copy. Select the request and copy it."),
    );

  const apply = (how: "replace" | "below", text: string) => {
    const before = note.content;
    vault.updateNote(note.id, how === "replace" ? text : `${before.replace(/\s+$/, "")}\n\n${text}`);
    haptic("success");
    toast(how === "replace" ? "Note formatted" : "Added to the note", { label: "Undo", run: () => vault.updateNote(note.id, before) });
    close();
  };

  const title = reply ? "Formatted" : sent ? "Bring the reply back" : "Format with AI";

  return (
    <Sheet open title={title} onClose={close} className="add-sheet format-sheet">
      {!sent && (
        <>
          <p className="add-hint format-lede">Pick what to do. Claude opens with your note and the request typed in, and you choose whether to keep its reply.</p>
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
          {empty && <p className="add-hint">This note is empty. Write something first.</p>}
          <div className="add-actions">
            <button className="btn btn-primary btn-lg" disabled={!tasks.length || empty} onClick={send}>
              <Tumble label="Open Claude">
                <ExternalLink size={17} /> Open Claude
              </Tumble>
            </button>
          </div>
          <p className="format-fine">
            Claude opens signed in as you: the Claude app on your phone, or claude.ai on a computer. There’s no key to add. Your note
            leaves this device only when you tap Open Claude.
          </p>
          <p className="format-fine">
            Rather do it yourself? See the{" "}
            <Link href="/formatting" onClick={close}>
              Formatting guide
            </Link>
            .
          </p>
        </>
      )}

      {sent && reply === null && (
        <>
          <p className="add-hint format-lede">
            {sent.filled
              ? "When Claude has answered, tap Copy under its reply, then come back and paste it here."
              : "This note is too long to type in for you. Paste the request into Claude, then copy its reply and come back."}
            {sent.copied ? " The request is on your clipboard too, in case Claude opens empty." : ""}
          </p>
          {!sent.filled && sent.copied === false && (
            <label className="add-field">
              <span>Couldn’t copy the request. Select it and copy it yourself.</span>
              <textarea className="format-prompt" readOnly rows={5} value={sent.prompt} onFocus={(e) => e.currentTarget.select()} />
            </label>
          )}
          <div className="add-actions">
            <button className="btn btn-primary btn-lg" onClick={() => paste(sent.prompt)}>
              <ClipboardPaste size={17} /> Paste Claude’s reply
            </button>
          </div>
          {byHand && (
            <>
              <label className="add-field">
                <span>This phone doesn’t let apps read the clipboard. Paste the reply here.</span>
                <textarea
                  autoFocus
                  rows={6}
                  value={typed}
                  placeholder="Press and hold, then Paste"
                  onChange={(e) => setTyped(e.target.value)}
                  onPaste={(e) => {
                    const text = e.clipboardData.getData("text");
                    if (!text.trim()) return;
                    e.preventDefault();
                    take(text, sent.prompt);
                  }}
                />
              </label>
              {typed.trim() && (
                <div className="add-actions">
                  <button className="btn btn-lg" onClick={() => take(typed, sent.prompt)}>
                    Use this reply
                  </button>
                </div>
              )}
            </>
          )}
          <div className="format-foot">
            <button className="format-link" onClick={() => setSent(null)}>
              <ArrowLeft size={14} /> Back
            </button>
            <button className="format-link" onClick={() => window.open(sent.url, "_blank", "noopener,noreferrer")}>
              <ExternalLink size={14} /> Open Claude again
            </button>
            <button className="format-link" onClick={() => copyAgain(sent.prompt)}>
              <ClipboardCopy size={14} /> Copy the request
            </button>
          </div>
        </>
      )}

      {reply !== null && (
        <>
          <div className="ai-preview" aria-live="polite">
            <MarkdownView content={reply} interactive={false} />
          </div>
          <div className="add-actions">
            <button className="btn btn-lg" onClick={() => apply("below", reply)}>
              Add below
            </button>
            <button className="btn btn-primary btn-lg" onClick={() => apply("replace", reply)}>
              <Check size={17} /> Replace note
            </button>
          </div>
          <div className="format-foot">
            <button className="format-link" onClick={() => setReply(null)}>
              <ArrowLeft size={14} /> Paste a different reply
            </button>
          </div>
        </>
      )}
    </Sheet>
  );
}

/** Format: hand the note to Claude, signed in as the learner, then paste the reply back and keep it or not. */
export default function FormatSheet() {
  const { format } = useUI();
  if (!format) return null;
  return <FormatFlow key={format.noteId} noteId={format.noteId} />;
}
