// The smart tools, as actions on the note being edited: Explain, Hear, Check my writing,
// Find new words and Make cards. Shared by the selection bar, the phone toolbar, menus and ⌘K.
import type { EditorView } from "@codemirror/view";
import { activeEditor } from "./cm";
import { dismissToast, getVault, toast, vault } from "./store";
import { languageOf } from "./languages";
import { GrammarError, MAX_CHECK, check } from "./grammar";
import { setIssues } from "./issues";
import { speak, speakable } from "./speech";
import { downloadSize, downloadVoice, speakNatural, unlockAudio, voiceReady, voiceStatus } from "./voices";
import { setUI } from "./ui";
import { toCards, wordListSize } from "./words";
import { bodyOf, frontmatterOf, withProperties } from "./properties";
import { isoDay } from "./vault";

const learning = () => languageOf(getVault().settings.learning);

/** Run `fn` on the note's editor, switching to editing view first if needed. */
export function withEditor(fn: (view: EditorView) => void) {
  const now = activeEditor();
  if (now) return fn(now);
  vault.setMode("edit");
  let tries = 0;
  const wait = () => {
    const view = activeEditor();
    if (view) fn(view);
    else if (tries++ < 30) requestAnimationFrame(wait);
  };
  requestAnimationFrame(wait);
}

/** The selected text, or the word at the caret. */
function selectionOrWord(view: EditorView) {
  const sel = view.state.selection.main;
  const range = sel.empty ? view.state.wordAt(sel.head) : sel;
  if (!range) return null;
  const text = view.state.sliceDoc(range.from, range.to).trim();
  return text ? { text, from: range.from, to: range.to } : null;
}

export function explain(view: EditorView) {
  const s = selectionOrWord(view);
  if (!s) return toast("Select a word to explain");
  const word = s.text.replace(/\[\[|\]\]|[*=_`]/g, "").trim().slice(0, 80);
  setUI({ explain: { word, noteId: getVault().workspace.active } });
}

/** "Flashcard": the add-a-word sheet with the selected word, so its meaning fills itself in. Saves to this note. */
export function flashcard(view: EditorView) {
  const word = selectionOrWord(view)?.text.replace(/\[\[|\]\]|[*=_`]/g, "").replace(/\s+/g, " ").trim().slice(0, 80);
  setUI({ addWord: { noteId: getVault().workspace.active, mode: "word", word } });
}

/**
 * Say something in the language being learned: with its downloaded natural voice if there is
 * one, else the device's own voice, else offer to download a voice right here in the app. The
 * natural voice is instant for words heard or prepared before; while it's still starting, the
 * device's voice says the word straight away instead of making you wait.
 */
export function say(text: string, lang = learning()) {
  const words = speakable(text);
  if (!words) return;
  const fallback = () => {
    if (speak(words, lang.voice)) return;
    const status = voiceStatus(lang.code);
    if (status === "ready") toast("Couldn’t play that. Try again.");
    else if (status === "downloading" || status === "waiting") toast(`The ${lang.name} voice is still downloading.`);
    else if (lang.model) {
      toast(`No ${lang.name} voice yet.`, {
        label: `Download (${downloadSize([lang.code])} MB)`,
        run: () => {
          toast(`Downloading the ${lang.name} voice…`);
          downloadVoice(lang.code).then(
            () => toast(`${lang.name} voice ready`),
            () => toast(`Couldn’t download the ${lang.name} voice`),
          );
        },
      });
    } else toast(`There’s no ${lang.name} voice on this device yet.`);
  };
  if (!voiceReady(lang.code)) return fallback();
  unlockAudio(); // must happen during the tap
  speakNatural(words, lang.code, () => speak(words, lang.voice)).catch(fallback);
}

export function hear(view: EditorView) {
  const s = selectionOrWord(view);
  if (!s) return toast("Select something to hear it");
  say(s.text);
}

/**
 * Check spelling and grammar. The selection bar checks just the selection; everywhere else
 * checks the whole note, unless a few words or more are selected.
 */
export async function checkWriting(view: EditorView, scope: "auto" | "selection" = "auto") {
  const { settings } = getVault();
  const lang = learning();
  if (!lang.grammar) return toast(`Check my writing isn’t available for ${lang.name} yet`);
  if (!settings.onlineLookups) return toast("Online lookups are off. Turn them on in Settings → Language.");
  const sel = view.state.selection.main;
  const words = view.state.sliceDoc(sel.from, sel.to).trim().split(/\s+/).filter(Boolean).length;
  const partial = !sel.empty && (scope === "selection" || words >= 3);
  // The whole note means everything below its properties block.
  const from = partial ? sel.from : (frontmatterOf(view.state.doc.toString())?.length ?? 0);
  const to = partial ? sel.to : view.state.doc.length;
  const text = view.state.sliceDoc(from, to);
  if (!text.trim()) return toast("Write something first, then check it");
  if (text.length > MAX_CHECK) return toast("That’s a lot of text. Select the part you want checked.");
  const busy = toast(partial ? "Checking the selection…" : "Checking this note…");
  try {
    const found = await check(text, from, lang, languageOf(settings.native)).finally(() => dismissToast(busy));
    // If you kept typing while we waited, keep only issues whose text is still there.
    const issues = found.filter((i) => view.state.sliceDoc(i.from, i.to) === text.slice(i.from - from, i.to - from));
    view.dispatch({ effects: setIssues.of(issues) });
    toast(
      issues.length
        ? `${issues.length} ${issues.length === 1 ? "thing" : "things"} to look at. Tap an underlined word to see the fix.`
        : "No mistakes found. Nice work!",
    );
  } catch (e) {
    const reason = e instanceof GrammarError ? e.message : "";
    toast(
      reason === "offline"
        ? "You’re offline. Checking needs an internet connection."
        : reason === "busy"
          ? "The checker is busy. Try again in a minute."
          : "Couldn’t check right now. Try again later.",
    );
  }
}

/** Open the new-words list for the selected text (a few words or more), or else the whole note. */
export function findNewWords(view: EditorView) {
  const noteId = getVault().workspace.active;
  if (!noteId) return;
  const sel = view.state.selection.main;
  const picked = view.state.sliceDoc(sel.from, sel.to);
  const text = picked.trim().split(/\s+/).length >= 3 ? picked : bodyOf(view.state.doc.toString());
  setUI({ newWords: { text, noteId } });
}

/** Start the note's properties (tags and today's date) with the cursor after "tags: ", or step into the ones it has. */
export function addProperties(view: EditorView) {
  const doc = view.state.doc.toString();
  view.focus();
  if (frontmatterOf(doc)) {
    const at = view.state.doc.line(Math.min(2, view.state.doc.lines)).to;
    view.dispatch({ selection: { anchor: at }, scrollIntoView: true });
    return;
  }
  const added = withProperties(doc, isoDay(new Date()))!;
  view.dispatch({
    changes: { from: 0, insert: added.content.slice(0, added.content.length - doc.length) },
    selection: { anchor: added.caret },
    scrollIntoView: true,
    userEvent: "input",
  });
}

/** Turn word-pair lines ("Hund = dog") in the selection (or the whole note) into flashcards. */
export function makeCards(view: EditorView, range?: { from: number; to: number }) {
  const sel = view.state.selection.main;
  const listSelected = !sel.empty && wordListSize(view.state.sliceDoc(sel.from, sel.to)) > 0;
  const { from, to } = range ?? (listSelected ? sel : { from: 0, to: view.state.doc.length });
  const text = view.state.sliceDoc(from, to);
  const count = wordListSize(text);
  if (!count) return toast("No word pairs found. Write one per line, like: Hund = dog");
  view.dispatch({ changes: { from, to, insert: toCards(text) }, userEvent: "input.complete" });
  toast(`Made ${count} flashcards`);
}
