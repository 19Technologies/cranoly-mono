"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  CalendarDays,
  CodeXml,
  TableProperties,
  Columns2,
  ArrowDownToLine,
  Download,
  Share2,
  Eye,
  FilePlus2,
  FileText,
  FolderPlus,
  Layers,
  Orbit,
  GraduationCap,
  PanelLeft,
  PanelRight,
  PenLine,
  Search,
  Settings,
  Shuffle,
  Trash2,
  TextCursorInput,
  BookA,
  ListPlus,
  MessageCircleQuestion,
  Plus,
  TextSearch,
  SpellCheck,
  Volume2,
  ScanText,
  Type,
  LetterText,
} from "lucide-react";
import { addProperties, checkWriting, explain, findNewWords, hear, makeCards, withEditor } from "@/lib/smart";
import { folderOf, titleOf } from "@/lib/vault";
import { rank } from "@/lib/fuzzy";
import { cardsOf, useVault, vault } from "@/lib/store";
import { downloadZip, folderKind, saveNow, shareCopy } from "@/lib/backup";
import { pickBackup } from "./BringIn";
import { openSearch, setUI, useUI } from "@/lib/ui";

interface Command {
  id: string;
  label: string;
  icon: ReactNode;
  hint?: string;
  run: () => void;
}

function Highlighted({ text, indices }: { text: string; indices: number[] }) {
  const set = new Set(indices);
  return (
    <>
      {[...text].map((ch, i) => (set.has(i) ? <b key={i}>{ch}</b> : ch))}
    </>
  );
}

export function download(filename: string, text: string, type = "application/json") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function Palette({ mode }: { mode: "commands" | "notes" }) {
  const router = useRouter();
  const { notes, workspace } = useVault();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const close = () => setUI({ palette: null });
  const activeNote = workspace.active ? notes[workspace.active] : undefined;

  const commands: Command[] = useMemo(() => {
    const go = (path: string) => () => router.push(path);
    const list: Command[] = [
      { id: "add-word", label: "Add a word (meaning filled in for you)", icon: <Plus size={15} />, run: () => setUI({ addWord: { noteId: activeNote?.id ?? null, mode: "word" } }) },
      { id: "paste-list", label: "Paste a word list", icon: <ListPlus size={15} />, run: () => setUI({ addWord: { noteId: activeNote?.id ?? null, mode: "list" } }) },
      { id: "scan", label: "Scan text from a photo", icon: <ScanText size={15} />, run: () => setUI({ scan: { noteId: activeNote?.id ?? null } }) },
      { id: "new", label: "Create new note", icon: <FilePlus2 size={15} />, run: () => { const id = vault.createNote({ folder: activeNote ? folderOf(activeNote.path) : "" }); setUI({ pendingRename: id }); router.push("/"); } },
      { id: "folder", label: "Create new folder", icon: <FolderPlus size={15} />, run: () => { setUI({ renameFolder: vault.createFolder(), mobileLeft: true }); vault.setPanel("leftOpen", true); } },
      { id: "daily", label: "Open today's daily note", icon: <CalendarDays size={15} />, run: () => { vault.openDaily(); router.push("/"); } },
      { id: "switch", label: "Quick switcher: open a note", icon: <FileText size={15} />, hint: "⌘O", run: () => setTimeout(() => setUI({ palette: "notes" })) },
      { id: "search", label: "Search all notes", icon: <Search size={15} />, hint: "⌘⇧F", run: () => { openSearch(); router.push("/search"); } },
      { id: "ask", label: "Ask your notes a question", icon: <MessageCircleQuestion size={15} />, run: () => { openSearch(); router.push("/search"); } },
      { id: "mind-map", label: "Open the Mind Map", icon: <Orbit size={15} />, run: go("/mind-map") },
      { id: "dictionary", label: "Open your dictionary", icon: <BookA size={15} />, run: go("/dictionary") },
      { id: "cards", label: "Open flashcard decks", icon: <Layers size={15} />, run: go("/flashcards") },
      { id: "study", label: "Study all flashcards", icon: <BookOpen size={15} />, run: go("/flashcards/study") },
      { id: "random", label: "Open a random note", icon: <Shuffle size={15} />, run: () => { vault.openRandom(); router.push("/"); } },
      { id: "left", label: "Toggle left sidebar", icon: <PanelLeft size={15} />, hint: "⌘\\", run: () => vault.setPanel("leftOpen") },
      { id: "right", label: "Toggle right sidebar", icon: <PanelRight size={15} />, run: () => vault.setPanel("rightOpen") },
      { id: "backup", label: folderKind() === "zip" ? "Save a backup (Cranoly Mono.zip)" : "Save to the Cranoly Mono folder now", icon: <Download size={15} />, run: () => (folderKind() === "zip" ? downloadZip() : void saveNow()) },
      { id: "bring-in", label: "Bring in changes from another device", icon: <ArrowDownToLine size={15} />, run: () => pickBackup() },
      ...(folderKind() === "app" ? [{ id: "share-copy", label: "Share a copy of your notes", icon: <Share2 size={15} />, run: () => void shareCopy().catch(() => {}) }] : []),
      { id: "settings", label: "Open settings", icon: <Settings size={15} />, run: go("/settings") },
      { id: "learn", label: "Learn the basics: take the tour", icon: <GraduationCap size={15} />, run: () => setUI({ onboarding: true }) },
      { id: "formatting", label: "Formatting guide: everything you can write", icon: <Type size={15} />, run: go("/formatting") },
    ];
    if (activeNote) {
      const count = cardsOf(notes).filter((c) => c.noteId === activeNote.id).length;
      list.splice(3, 0,
        { id: "read", label: "Reading view", icon: <Eye size={15} />, hint: "⌘E", run: () => { vault.setMode("read"); router.push("/"); } },
        { id: "edit", label: "Live preview: edit with the formatting showing", icon: <PenLine size={15} />, hint: "⌘E", run: () => { vault.setSource(false); vault.setMode("edit"); router.push("/"); } },
        { id: "source", label: "Source mode: edit with every symbol showing", icon: <CodeXml size={15} />, run: () => { vault.setSource(true); router.push("/"); } },
        { id: "properties", label: "Add properties (tags, date and more)", icon: <TableProperties size={15} />, run: () => { router.push("/"); withEditor(addProperties); } },
        { id: "split", label: "Split view: edit and preview", icon: <Columns2 size={15} />, run: () => { vault.setMode("split"); router.push("/"); } },
        { id: "rename", label: `Rename “${titleOf(activeNote.path)}”`, icon: <TextCursorInput size={15} />, run: () => { setUI({ pendingRename: activeNote.id }); router.push("/"); } },
        { id: "format", label: "Format this note with AI", icon: <LetterText size={15} />, run: () => setUI({ format: { noteId: activeNote.id } }) },
        { id: "check", label: "Check my writing", icon: <SpellCheck size={15} />, run: () => { router.push("/"); withEditor(checkWriting); } },
        { id: "explain", label: "Explain the selected word", icon: <BookA size={15} />, run: () => { router.push("/"); withEditor(explain); } },
        { id: "hear", label: "Hear the selected text", icon: <Volume2 size={15} />, run: () => withEditor(hear) },
        { id: "new-words", label: "Find new words in this note", icon: <TextSearch size={15} />, run: () => { router.push("/"); withEditor(findNewWords); } },
        { id: "make-cards", label: "Turn a word list into flashcards", icon: <ListPlus size={15} />, run: () => { router.push("/"); withEditor((v) => makeCards(v)); } },
      );
      if (count) list.splice(3, 0, { id: "study-note", label: `Study ${count} cards from “${titleOf(activeNote.path)}”`, icon: <BookOpen size={15} />, run: () => router.push(`/flashcards/study?note=${activeNote.id}`) });
      list.push({ id: "delete", label: `Delete “${titleOf(activeNote.path)}”`, icon: <Trash2 size={15} />, run: () => vault.deleteNote(activeNote.id) });
    }
    return list;
  }, [router, notes, activeNote]);

  const noteResults = useMemo(() => {
    if (mode !== "notes") return [];
    const all = Object.values(notes);
    if (!query.trim()) {
      return [...all].sort((a, b) => b.updated - a.updated).slice(0, 12).map((n) => ({ item: n, hit: { score: 0, indices: [] as number[] } }));
    }
    return rank(all, query, (n) => n.path, 30);
  }, [mode, notes, query]);

  const commandResults = useMemo(
    () => (mode === "commands" ? rank(commands, query, (c) => c.label, 40) : []),
    [mode, commands, query],
  );

  const exact = noteResults.some((r) => titleOf(r.item.path).toLowerCase() === query.trim().toLowerCase());
  const canCreate = mode === "notes" && query.trim() && !exact;
  const count = mode === "notes" ? noteResults.length + (canCreate ? 1 : 0) : commandResults.length;

  const run = (i: number, newTab = false) => {
    close();
    if (mode === "commands") return commandResults[i]?.item.run();
    const r = noteResults[i];
    if (r) vault.openNote(r.item.id, { newTab });
    else if (canCreate) {
      const q = query.trim();
      vault.createNote({ folder: folderOf(q), title: titleOf(q), newTab });
    }
    router.push("/");
  };

  return (
    <div className="palette-backdrop" onMouseDown={close}>
      <div className="palette" role="dialog" aria-label={mode === "notes" ? "Quick switcher" : "Command palette"} onMouseDown={(e) => e.stopPropagation()}>
        <div className="palette-input">
          <input
            autoFocus
            value={query}
            placeholder={mode === "notes" ? "Find or create a note..." : "Select a command..."}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") close();
              else if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((a) => (a + 1) % Math.max(count, 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => (a - 1 + count) % Math.max(count, 1));
              } else if (e.key === "Enter") {
                e.preventDefault();
                run(active, e.metaKey || e.ctrlKey);
              }
            }}
          />
        </div>
        <ul className="palette-list" role="listbox">
          {mode === "commands" &&
            commandResults.map(({ item, hit }, i) => (
              <li
                key={item.id}
                role="option"
                aria-selected={i === active}
                className={i === active ? "is-active" : ""}
                onMouseMove={() => setActive(i)}
                onClick={() => run(i)}
              >
                <span className="palette-icon">{item.icon}</span>
                <span className="palette-label">
                  <Highlighted text={item.label} indices={hit.indices} />
                </span>
                {item.hint && <kbd>{item.hint}</kbd>}
              </li>
            ))}
          {mode === "notes" &&
            noteResults.map(({ item, hit }, i) => (
              <li
                key={item.id}
                role="option"
                aria-selected={i === active}
                className={i === active ? "is-active" : ""}
                onMouseMove={() => setActive(i)}
                onClick={(e) => run(i, e.metaKey || e.ctrlKey)}
              >
                <span className="palette-icon"><FileText size={15} /></span>
                <span className="palette-label">
                  <Highlighted text={item.path} indices={hit.indices} />
                </span>
                {workspace.tabs.includes(item.id) && <span className="palette-tag">open</span>}
              </li>
            ))}
          {canCreate && (
            <li
              role="option"
              aria-selected={active === noteResults.length}
              className={active === noteResults.length ? "is-active" : ""}
              onMouseMove={() => setActive(noteResults.length)}
              onClick={() => run(noteResults.length)}
            >
              <span className="palette-icon"><FilePlus2 size={15} /></span>
              <span className="palette-label">Create “{query.trim()}”</span>
            </li>
          )}
          {count === 0 && <li className="palette-empty">No matches</li>}
        </ul>
        <div className="palette-footer">
          <span><b>↑↓</b> to navigate</span>
          <span><b>↵</b> to {mode === "notes" ? "open" : "use"}</span>
          {mode === "notes" && <span><b>⌘ ↵</b> to open in new tab</span>}
          <span><b>esc</b> to dismiss</span>
        </div>
      </div>
    </div>
  );
}

export default function CommandPalette() {
  const { palette } = useUI();
  if (!palette) return null;
  return <Palette key={palette} mode={palette} />;
}
