"use client";
// Ephemeral UI state shared across components (not persisted).
import type { Incoming } from "./backup";
import { useSyncExternalStore } from "react";
import type { InstallPromptEvent } from "@/components/ServiceWorker";

export type PaletteMode = "commands" | "notes" | null;
export type SheetKind = "menu" | "tabs" | null;
export type RightTab = "backlinks" | "outgoing" | "cards" | "outline" | "graph";

export interface UIState {
  searchQuery: string;
  palette: PaletteMode;
  mobileLeft: boolean;
  mobileRight: boolean;
  /** Note whose inline title should grab focus next time it renders. */
  pendingRename: string | null;
  /** Heading slug to scroll to after the next note render. */
  pendingHeading: string | null;
  /** Line to select in the editor after the next note render. */
  pendingLine: number | null;
  /** Mobile bottom sheet currently open. */
  sheet: SheetKind;
  /** True while the note editor has focus (mobile shows the editing toolbar). */
  editorFocused: boolean;
  installPrompt: InstallPromptEvent | null;
  rightTab: RightTab;
  /** The "Learn" onboarding tour is open. */
  onboarding: boolean;
  /** "Explain a word": the word being looked up, and the note a card would be saved to. */
  explain: { word: string; noteId: string | null } | null;
  /** "Find new words": the text being mined, and the note new cards go to. */
  newWords: { text: string; noteId: string } | null;
  /** The ＋ sheet: add a word (or paste a list) without any syntax. `word` comes from a selection. */
  addWord: { noteId: string | null; mode: "word" | "list"; word?: string } | null;
  /** Folder whose name should be edited in place next time the sidebar renders. */
  renameFolder: string | null;
  /** "Scan text" from a photo, and the note the text would go to. */
  scan: { noteId: string | null } | null;
  /** "Format": the note being handed to Claude, and its reply pasted back. */
  format: { noteId: string } | null;
  /** "Bring in changes": a backup picked from another device, waiting for a yes. */
  bringIn: Incoming | null;
  /** The ＋ sheet: a new note, a scan or a pasted list. */
  plus: boolean;
}

const INITIAL: UIState = {
  searchQuery: "",
  palette: null,
  mobileLeft: false,
  mobileRight: false,
  pendingRename: null,
  pendingHeading: null,
  pendingLine: null,
  sheet: null,
  editorFocused: false,
  installPrompt: null,
  rightTab: "backlinks",
  onboarding: false,
  explain: null,
  newWords: null,
  addWord: null,
  renameFolder: null,
  scan: null,
  format: null,
  bringIn: null,
  plus: false,
};

let ui = INITIAL;
const listeners = new Set<() => void>();

export function setUI(patch: Partial<UIState> | ((s: UIState) => Partial<UIState>)) {
  const next = typeof patch === "function" ? patch(ui) : patch;
  ui = { ...ui, ...next };
  listeners.forEach((l) => l());
}

export function getUI() {
  return ui;
}

export function useUI() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => ui,
    () => INITIAL,
  );
}

/** Fill in the search screen's query (then go to /search). */
export function openSearch(query = "") {
  setUI({ searchQuery: query, mobileLeft: false });
}

/* Android's back button: an open overlay (the welcome, the tour) can take it before anything else. */
const backHandlers: Array<() => boolean> = [];

/** Handle the back button while mounted. The handler returns true when it used the press. */
export function onBack(handler: () => boolean) {
  backHandlers.push(handler);
  return () => {
    const i = backHandlers.lastIndexOf(handler);
    if (i >= 0) backHandlers.splice(i, 1);
  };
}

/** Offer a back press to the overlays, newest first. True when one of them used it. */
export function runBack() {
  for (let i = backHandlers.length - 1; i >= 0; i--) if (backHandlers[i]()) return true;
  return false;
}
