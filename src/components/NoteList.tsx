"use client";

import { useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  CalendarDays, Check, Dices, Folder, FolderInput, FolderPen, FolderPlus, Layers, Menu, MoreHorizontal, Orbit, PanelLeft, Pencil,
  Pin, PinOff, ScanText, Search, SquarePen, SquareTerminal, Trash2, X,
} from "lucide-react";
import Sheet, { type Anchor } from "./Sheet";
import { allFolders, cardsOf, inFolder, toast, useVault, vault } from "@/lib/store";
import { friendlyCard, plainLine } from "@/lib/links";
import { bodyOf } from "@/lib/properties";
import { folderOf, titleOf, type Note } from "@/lib/vault";
import { parseDay, useToday } from "@/lib/useToday";
import { setUI } from "@/lib/ui";
import { useSlider } from "@/lib/useSlider";
import { haptic } from "@/lib/native";
import { GlassIcon } from "./ui/glass-icon";

const DAY = 86_400_000;

/** Apple Notes' sections: Pinned, Today, Yesterday, Previous 7 Days, Previous 30 Days, then months and years. */
function sectionOf(t: number, today: Date) {
  const d = new Date(t);
  const days = Math.round((today.getTime() - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / DAY);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return "Previous 7 Days";
  if (days < 30) return "Previous 30 Days";
  if (d.getFullYear() === today.getFullYear()) return d.toLocaleDateString(undefined, { month: "long" });
  return String(d.getFullYear());
}

function when(t: number, today: Date) {
  const d = new Date(t);
  const days = Math.round((today.getTime() - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / DAY);
  if (days <= 0) return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  if (days === 1) return "Yesterday";
  if (days < 7) return d.toLocaleDateString(undefined, { weekday: "long" });
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: d.getFullYear() === today.getFullYear() ? undefined : "numeric" });
}

// The first line of the note's text: below its properties block, skipping headings and tag lines.
const preview = (content: string) =>
  bodyOf(content)
    .split("\n")
    .map((l) => friendlyCard(plainLine(l)))
    .find((l) => l && !/^#{1,6}\s|^#\p{L}/u.test(l))
    ?.slice(0, 120) ?? "No additional text";

/** Long-press on touch, right-click with a mouse. */
function usePress(onPress: (at: Anchor) => void) {
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const fired = useRef(false);
  return {
    onTouchStart: () => {
      fired.current = false;
      clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        fired.current = true;
        navigator.vibrate?.(10);
        onPress(null);
      }, 450);
    },
    onTouchMove: () => clearTimeout(timer.current),
    onTouchEnd: (e: React.TouchEvent) => {
      clearTimeout(timer.current);
      if (fired.current) e.preventDefault();
    },
    onContextMenu: (e: React.MouseEvent) => {
      e.preventDefault();
      onPress({ x: e.clientX, y: e.clientY });
    },
  };
}

type NoteMenuState = { id: string; at: Anchor; step?: "move" } | null;

/** Pin, move, rename or delete a note from the list. */
function NoteActions({ menu, onClose }: { menu: NonNullable<NoteMenuState>; onClose: () => void }) {
  const state = useVault();
  const router = useRouter();
  const note = state.notes[menu.id];
  const [step, setStep] = useState(menu.step);
  if (!note) return null;
  const here = folderOf(note.path);
  const run = (fn: () => void) => () => {
    onClose();
    fn();
  };
  if (step === "move") {
    return (
      <div className="sheet-list">
        {["", ...allFolders(state)].map((f) => (
          <button
            key={f || "(none)"}
            className={`sheet-item${f === here ? " is-current" : ""}`}
            onClick={run(() => {
              const err = vault.moveNote(note.id, f);
              if (err) toast(err);
              else if (f !== here) toast(`Moved to ${f ? titleOf(f) : "Notes"}`);
            })}
          >
            {f ? <Folder size={16} /> : <X size={16} />}
            <span>{f ? f.split("/").join(" / ") : "No folder"}</span>
            {f === here && <Check size={15} className="sheet-check" />}
          </button>
        ))}
      </div>
    );
  }
  return (
    <div className="sheet-list">
      <button className="sheet-item" onClick={run(() => vault.togglePin(note.id))}>
        {note.pinned ? <PinOff size={16} /> : <Pin size={16} />}
        <span>{note.pinned ? "Unpin note" : "Pin note"}</span>
      </button>
      <button className="sheet-item" onClick={() => setStep("move")}>
        <FolderInput size={16} />
        <span>Move to folder…</span>
      </button>
      <button
        className="sheet-item"
        onClick={run(() => {
          vault.openNote(note.id);
          setUI({ pendingRename: note.id });
          router.push("/");
        })}
      >
        <Pencil size={16} />
        <span>Rename</span>
      </button>
      <span className="menu-sep" />
      <button className="sheet-item is-danger" onClick={run(() => vault.deleteNote(note.id))}>
        <Trash2 size={16} />
        <span>Delete</span>
      </button>
    </div>
  );
}

function Row({
  note,
  active,
  showFolder,
  cards,
  today,
  onOpen,
  onMenu,
}: {
  note: Note;
  active: boolean;
  showFolder: boolean;
  cards: number;
  today: Date;
  onOpen: () => void;
  onMenu: (at: Anchor) => void;
}) {
  const press = usePress(onMenu);
  const folder = folderOf(note.path);
  return (
    <li>
      <button
        className={`nl-row${active ? " is-active" : ""}`}
        aria-current={active ? "true" : undefined}
        onClick={onOpen}
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData("text/graphite-note", note.id);
          e.dataTransfer.effectAllowed = "move";
        }}
        {...press}
      >
        <b className="nl-title">{titleOf(note.path)}</b>
        <span className="nl-line">
          <time>{when(note.updated, today)}</time>
          <span className="nl-preview">{preview(note.content)}</span>
        </span>
        {(showFolder && folder) || cards ? (
          <span className="nl-meta">
            {showFolder && folder && (
              <span>
                <Folder size={12} /> {titleOf(folder)}
              </span>
            )}
            {cards > 0 && (
              <span className="nl-cards">
                <Layers size={12} /> {cards}
              </span>
            )}
          </span>
        ) : null}
      </button>
    </li>
  );
}

/** Folder chips on phones: All, then each folder. Long-press a folder to rename or delete it. */
function FolderChips({ onFolderMenu }: { onFolderMenu: (path: string) => void }) {
  const state = useVault();
  const current = state.workspace.folder;
  const folders = allFolders(state);
  const chips = useSlider<HTMLDivElement>(".nl-chip.is-on", `${current}|${folders.join("\n")}`);
  if (!folders.length) return null;
  return (
    <div ref={chips} className="nl-chips has-slider" data-no-swipe>
      <span className="slider-pill" aria-hidden />
      <button
        className={`nl-chip${current === "" ? " is-on" : ""}`}
        onClick={() => {
          if (current !== "") haptic();
          vault.showFolder("");
        }}
      >
        All
      </button>
      {folders.map((f) => (
        <FolderChip key={f} path={f} on={current === f} onMenu={() => onFolderMenu(f)} />
      ))}
    </div>
  );
}

function FolderChip({ path, on, onMenu }: { path: string; on: boolean; onMenu: () => void }) {
  const press = usePress(onMenu);
  return (
    <button
      className={`nl-chip${on ? " is-on" : ""}`}
      onClick={() => {
        if (!on) haptic();
        vault.showFolder(path);
      }}
      title={path}
      {...press}
    >
      <Folder size={13} /> {titleOf(path)}
    </button>
  );
}

/** Rename or delete a folder (phones; the sidebar does this in place on bigger screens). */
function FolderActions({ path, fresh, onClose }: { path: string; fresh: boolean; onClose: () => void }) {
  const [name, setName] = useState(fresh ? "" : titleOf(path));
  const [renaming, setRenaming] = useState(fresh);
  const save = () => {
    const err = name.trim() && name.trim() !== titleOf(path) ? vault.renameFolder(path, name) : null;
    if (err) return toast(err);
    const parent = folderOf(path);
    vault.showFolder(name.trim() ? (parent ? `${parent}/${name.trim()}` : name.trim()) : path);
    onClose();
  };
  if (renaming) {
    return (
      <form
        className="folder-form"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <input autoFocus value={name} placeholder={titleOf(path)} onChange={(e) => setName(e.target.value)} aria-label="Folder name" />
        <button className="btn btn-primary btn-lg" type="submit">
          <Check size={17} /> Save
        </button>
      </form>
    );
  }
  return (
    <div className="sheet-list">
      <button className="sheet-item" onClick={() => setRenaming(true)}>
        <FolderPen size={16} />
        <span>Rename folder</span>
      </button>
      <button
        className="sheet-item is-danger"
        onClick={() => {
          onClose();
          vault.deleteFolder(path);
        }}
      >
        <Trash2 size={16} />
        <span>Delete folder and its notes</span>
      </button>
    </div>
  );
}

/**
 * The notes list, as in Apple Notes: pinned notes first, then by date. A column next to the note
 * on bigger screens, and the Notes screen on phones.
 */
export default function NoteList({ variant }: { variant: "column" | "page" }) {
  const state = useVault();
  const { notes, workspace } = state;
  const router = useRouter();
  const pathname = usePathname();
  const day = useToday();
  const [query, setQuery] = useState("");
  const [menu, setMenu] = useState<NoteMenuState>(null);
  const [more, setMore] = useState(false);
  const [folderMenu, setFolderMenu] = useState<{ path: string; fresh: boolean } | null>(null);
  const folder = workspace.folder;
  const today = useMemo(() => (day ? parseDay(day) : null), [day]);

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of cardsOf(notes)) m.set(c.noteId, (m.get(c.noteId) ?? 0) + 1);
    return m;
  }, [notes]);

  const shown = useMemo(() => Object.values(notes).filter((n) => inFolder(n.path, folder)), [notes, folder]);

  const sections = useMemo(() => {
    if (!today) return [];
    const q = query.trim().toLowerCase();
    const list = shown
      .filter((n) => !q || n.path.toLowerCase().includes(q) || n.content.toLowerCase().includes(q))
      .sort((a, b) => b.updated - a.updated);
    const out: Array<{ name: string; notes: Note[] }> = [];
    const add = (name: string, n: Note) => {
      const last = out.at(-1);
      if (last?.name === name) last.notes.push(n);
      else out.push({ name, notes: [n] });
    };
    for (const n of list.filter((n) => n.pinned)) add("Pinned", n);
    for (const n of list.filter((n) => !n.pinned)) add(sectionOf(n.updated, today), n);
    return out;
  }, [shown, query, today]);

  const open = (id: string) => {
    vault.openNote(id);
    if (pathname !== "/") router.push("/");
  };
  const compose = () => {
    setUI({ pendingRename: vault.createNote({ folder }) });
    if (pathname !== "/") router.push("/");
  };
  const newFolder = () => {
    const path = vault.createFolder();
    if (variant === "page") setFolderMenu({ path, fresh: true });
    else setUI({ renameFolder: path, mobileLeft: true });
  };
  const run = (fn: () => void) => () => {
    setMore(false);
    fn();
  };
  const active = pathname === "/" ? workspace.active : null;
  // The yellow highlight glides to the open note, and follows it when edits move it up the list.
  const order = sections.map((s) => s.notes.map((n) => n.id).join(",")).join("|");
  const scroll = useSlider<HTMLDivElement>(".nl-row.is-active", `${active}|${order}`);
  const name = folder ? titleOf(folder) : variant === "page" ? "Notes" : "All Notes";
  const total = shown.length;

  return (
    <div className={`nl nl-${variant}`}>
      <header className="nl-head">
        {variant === "column" && (
          <button
            className="icon-btn nl-sidebar-btn"
            aria-label="Show folders"
            title="Show folders (⌘\)"
            onClick={() => {
              if (window.matchMedia("(max-width: 1180px)").matches) setUI({ mobileLeft: true });
              else vault.setPanel("leftOpen", true);
            }}
          >
            <PanelLeft size={18} />
          </button>
        )}
        {variant === "page" && (
          <GlassIcon className="nl-menu" size={40} aria-label="Menu" title="Folders, Mind Map, Practice and more" onClick={() => setUI({ mobileLeft: true })}>
            <Menu size={20} />
          </GlassIcon>
        )}
        <div className="nl-name">
          <h1>{name}</h1>
          {variant === "column" && (
            <small>
              {total} {total === 1 ? "note" : "notes"}
            </small>
          )}
        </div>
        {variant === "page" ? (
          <div className="nl-actions">
            <GlassIcon size={40} aria-label="More" onClick={() => setMore(true)}>
              <MoreHorizontal size={20} />
            </GlassIcon>
            <GlassIcon className="nl-compose" size={40} aria-label="New note" title="New note" onClick={compose}>
              <SquarePen size={19} />
            </GlassIcon>
          </div>
        ) : (
          <button className="icon-btn nl-compose" aria-label="New note" title="New note" onClick={compose}>
            <SquarePen size={18} />
          </button>
        )}
      </header>

      {(total > 3 || query) && (
        <label className="nl-search">
          <Search size={15} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search" aria-label="Search notes" />
          {query && (
            <button className="icon-btn" aria-label="Clear search" onClick={() => setQuery("")}>
              <X size={14} />
            </button>
          )}
        </label>
      )}

      {variant === "page" && <FolderChips onFolderMenu={(path) => setFolderMenu({ path, fresh: false })} />}

      <div ref={scroll} className="nl-scroll has-slider">
        <span className="slider-pill" aria-hidden />
        {sections.map((s) => (
          <section key={s.name} className="nl-section">
            <h2>
              {s.name === "Pinned" && <Pin size={12} />} {s.name}
            </h2>
            <ul>
              {s.notes.map((n) => (
                <Row
                  key={n.id}
                  note={n}
                  active={n.id === active}
                  showFolder={!folder}
                  cards={counts.get(n.id) ?? 0}
                  today={today!}
                  onOpen={() => open(n.id)}
                  onMenu={(at) => setMenu({ id: n.id, at })}
                />
              ))}
            </ul>
          </section>
        ))}
        {today && !sections.length && (
          <div className="nl-empty">
            <p>{query ? `No notes match “${query}”.` : folder ? "This folder is empty." : "No notes yet."}</p>
            {!query && (
              <button className="btn btn-primary" onClick={compose}>
                <SquarePen size={15} /> New note
              </button>
            )}
          </div>
        )}
      </div>

      {variant === "page" && (
        <p className="nl-count">
          {total} {total === 1 ? "note" : "notes"}
        </p>
      )}

      <Sheet open={!!menu} anchor={menu?.at ?? null} onClose={() => setMenu(null)} title={menu && notes[menu.id] ? titleOf(notes[menu.id].path) : undefined}>
        {menu && <NoteActions key={menu.id} menu={menu} onClose={() => setMenu(null)} />}
      </Sheet>

      <Sheet open={!!folderMenu} onClose={() => setFolderMenu(null)} title={folderMenu?.fresh ? "New folder" : folderMenu ? titleOf(folderMenu.path) : undefined}>
        {folderMenu && <FolderActions key={folderMenu.path} path={folderMenu.path} fresh={folderMenu.fresh} onClose={() => setFolderMenu(null)} />}
      </Sheet>

      <Sheet open={more} onClose={() => setMore(false)} title="Notes">
        <div className="sheet-list">
          <button className="sheet-item" onClick={run(newFolder)}>
            <FolderPlus size={18} /> <span>New folder</span>
          </button>
          <button className="sheet-item" onClick={run(() => setUI({ scan: { noteId: null } }))}>
            <ScanText size={18} /> <span>Scan text from a photo</span>
          </button>
          <button className="sheet-item" onClick={run(() => { vault.openDaily(); router.push("/"); })}>
            <CalendarDays size={18} /> <span>Today’s page</span>
          </button>
          <button className="sheet-item" onClick={run(() => router.push("/mind-map"))}>
            <Orbit size={18} /> <span>Mind Map</span>
          </button>
          <button className="sheet-item" onClick={run(() => { vault.openRandom(); router.push("/"); })}>
            <Dices size={18} /> <span>Random note</span>
          </button>
          <button className="sheet-item" onClick={run(() => setUI({ palette: "commands" }))}>
            <SquareTerminal size={18} /> <span>All commands</span>
          </button>
        </div>
      </Sheet>
    </div>
  );
}
