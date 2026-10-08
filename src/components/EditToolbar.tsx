"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  BookA, Bold, ChevronDown, CircleQuestionMark, Hash, Heading2, IndentDecrease, IndentIncrease, Italic, Layers, Link2,
  ListChecks, Redo2, SpellCheck, Undo2, Volume2, LetterText,
} from "lucide-react";
import { setUI, useUI } from "@/lib/ui";
import { getVault } from "@/lib/store";
import type { EditorView } from "@codemirror/view";
import { redo, undo } from "@codemirror/commands";
import { activeEditor, indent, insertText, toggleLinePrefix, wrap } from "@/lib/cm";
import { checkWriting, explain, flashcard, hear } from "@/lib/smart";

/** Height of the on-screen keyboard, from the visual viewport (0 when closed). */
function subscribe(onChange: () => void) {
  const vv = window.visualViewport;
  vv?.addEventListener("resize", onChange);
  vv?.addEventListener("scroll", onChange);
  return () => {
    vv?.removeEventListener("resize", onChange);
    vv?.removeEventListener("scroll", onChange);
  };
}
const keyboardInset = () => {
  const vv = window.visualViewport;
  return vv ? Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)) : 0;
};

function Tool({ label, onPress, wide, children }: { label: string; onPress: (view: EditorView) => void; wide?: boolean; children: ReactNode }) {
  return (
    <button
      className={wide ? "tool tool-wide" : "tool"}
      aria-label={label}
      title={label}
      // Keep focus (and the keyboard) in the editor.
      onPointerDown={(e) => e.preventDefault()}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => {
        const view = activeEditor();
        if (view) onPress(view);
      }}
    >
      {children}
    </button>
  );
}

/** Format: hide the keyboard and open the sheet that hands this note to Claude. */
function format(view: EditorView) {
  const noteId = getVault().workspace.active;
  if (!noteId) return;
  view.contentDOM.blur();
  setUI({ format: { noteId } });
}

export default function EditToolbar() {
  const { editorFocused } = useUI();
  const router = useRouter();
  const inset = useSyncExternalStore(subscribe, keyboardInset, () => 0);
  if (!editorFocused) return null;

  return (
    <div className="edit-toolbar" style={{ bottom: inset }} role="toolbar" aria-label="Formatting" data-no-swipe>
      <div className="edit-toolbar-scroll">
        {/* On the selected word, or the word next to the caret. */}
        <Tool label="Flashcard" onPress={flashcard} wide>
          <Layers size={17} /> Flashcard
        </Tool>
        <Tool label="Link" onPress={(v) => wrap(v, "[[", "]]")} wide>
          <Link2 size={17} /> Link
        </Tool>
        <Tool label="Format" onPress={format} wide>
          <LetterText size={17} /> Format
        </Tool>
        <span className="tool-sep" />
        <Tool label="Undo" onPress={(v) => { undo(v); v.focus(); }}>
          <Undo2 size={18} />
        </Tool>
        <Tool label="Redo" onPress={(v) => { redo(v); v.focus(); }}>
          <Redo2 size={18} />
        </Tool>
        <span className="tool-sep" />
        <Tool label="Explain the word" onPress={explain}>
          <BookA size={18} />
        </Tool>
        <Tool label="Hear it" onPress={hear}>
          <Volume2 size={18} />
        </Tool>
        <Tool label="Check my writing" onPress={checkWriting}>
          <SpellCheck size={18} />
        </Tool>
        <span className="tool-sep" />
        <Tool label="Type a card ( :: )" onPress={(v) => insertText(v, " :: ")}>
          <span className="tool-text">::</span>
        </Tool>
        <Tool label="Tag" onPress={(v) => insertText(v, "#")}>
          <Hash size={18} />
        </Tool>
        <Tool label="Checklist" onPress={(v) => toggleLinePrefix(v, "- [ ] ", /^\s*[-*+] \[[ xX]\] /)}>
          <ListChecks size={18} />
        </Tool>
        <Tool label="Heading" onPress={(v) => toggleLinePrefix(v, "## ", /^#{1,6} /)}>
          <Heading2 size={18} />
        </Tool>
        <Tool label="Bold" onPress={(v) => wrap(v, "**")}>
          <Bold size={18} />
        </Tool>
        <Tool label="Italic" onPress={(v) => wrap(v, "*")}>
          <Italic size={18} />
        </Tool>
        <Tool label="Highlight (cloze card)" onPress={(v) => wrap(v, "==")}>
          <span className="tool-text tool-mark">==</span>
        </Tool>
        <Tool label="Indent" onPress={(v) => indent(v, false)}>
          <IndentIncrease size={18} />
        </Tool>
        <Tool label="Outdent" onPress={(v) => indent(v, true)}>
          <IndentDecrease size={18} />
        </Tool>
        <Tool
          label="Formatting guide"
          onPress={(v) => {
            v.contentDOM.blur();
            router.push("/formatting");
          }}
        >
          <CircleQuestionMark size={18} />
        </Tool>
      </div>
      <Tool label="Hide keyboard" onPress={(v) => v.contentDOM.blur()}>
        <ChevronDown size={20} />
      </Tool>
    </div>
  );
}
