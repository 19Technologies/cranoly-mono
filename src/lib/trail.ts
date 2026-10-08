// Back and forward for the phone bar: the places you visited, like a browser's history. A place is a
// screen, plus the open note on "/" and the folder on "/notes". Kept for the session (a reload keeps it,
// opening the app again starts fresh).
import { useSyncExternalStore } from "react";

export interface Place {
  path: string;
  note?: string | null;
  folder?: string;
}

interface Navigator {
  /** The current place's path (see placePath). */
  here: string;
  push: (path: string) => void;
  openNote: (id: string) => void;
  showFolder: (folder: string) => void;
  exists: (id: string) => boolean;
}

const KEY = "cranoly-trail";
// Pages that only send you somewhere else.
const REDIRECTS = new Set(["/home", "/graph"]);

let places: Place[] = [];
let at = -1;
/** Where ‹ or › is taking us: arriving there moves the position instead of adding a place. */
let travelling: Place | null = null;
let travelTimer: ReturnType<typeof setTimeout> | undefined;
/** Places are ignored until this path shows (the phone's launch redirect from "/" to "/notes"). */
let expecting: string | null = null;
let version = 0;
const listeners = new Set<() => void>();

function emit() {
  version++;
  listeners.forEach((l) => l());
}

function save() {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ places, at }));
  } catch {
    /* private mode: the trail just isn't kept across reloads */
  }
}

if (typeof window !== "undefined") {
  try {
    const saved = JSON.parse(sessionStorage.getItem(KEY) ?? "null");
    if (saved && Array.isArray(saved.places) && typeof saved.at === "number") {
      places = saved.places;
      at = Math.min(saved.at, places.length - 1);
    }
  } catch {
    /* nothing saved */
  }
}

/** A screen's path as the trail keeps it: "/" stands for whichever note is open, other screens keep their query. */
export const placePath = (pathname: string, search: string) => (pathname === "/" ? "/" : pathname + search);

const samePlace = (a: Place, b: Place) =>
  a.path === b.path && (a.path !== "/" || (a.note ?? null) === (b.note ?? null)) && (a.path !== "/notes" || (a.folder ?? "") === (b.folder ?? ""));

/** Ignore every place until `path` shows up (used while the phone's start page redirects). */
export function expectPlace(path: string) {
  expecting = path;
}

/** Note where we are now. Called whenever the screen, the open note or the notes folder changes. */
export function recordPlace(place: Place) {
  if (expecting) {
    if (place.path !== expecting) return;
    expecting = null;
  }
  if (REDIRECTS.has(place.path)) return;
  if (travelling) {
    const arrived = samePlace(place, travelling);
    travelling = null;
    clearTimeout(travelTimer);
    if (arrived) return emit();
  }
  if (at >= 0 && samePlace(place, places[at])) return;
  // A browser back or forward (the Practice close button, a swipe in a browser) moves along the trail.
  if (at > 0 && samePlace(place, places[at - 1])) at--;
  else if (at < places.length - 1 && samePlace(place, places[at + 1])) at++;
  else {
    places = [...places.slice(0, at + 1), place].slice(-60);
    at = places.length - 1;
  }
  save();
  emit();
}

/** The position ‹ (-1) or › (+1) would go to, skipping notes that have been deleted since. */
function target(delta: -1 | 1, exists: (id: string) => boolean) {
  for (let i = at + delta; i >= 0 && i < places.length; i += delta) {
    const p = places[i];
    if (p.path === "/" && p.note && !exists(p.note)) continue;
    if (at >= 0 && samePlace(p, places[at])) continue;
    return i;
  }
  return null;
}

export const canGo = (delta: -1 | 1, exists: (id: string) => boolean) => target(delta, exists) !== null;

/** Go back (-1) or forward (+1). Returns false when there's nowhere to go. */
export function go(delta: -1 | 1, nav: Navigator) {
  const i = target(delta, nav.exists);
  if (i === null) return false;
  at = i;
  const place = places[i];
  travelling = place;
  clearTimeout(travelTimer);
  // If nothing ends up changing (the place was already showing), stop waiting for it.
  travelTimer = setTimeout(() => (travelling = null), 1500);
  save();
  emit();
  if (place.path === "/" && place.note) nav.openNote(place.note);
  if (place.path === "/notes") nav.showFolder(place.folder ?? "");
  if (place.path !== nav.here) nav.push(place.path);
  return true;
}

/**
 * Re-render when the trail moves (for the ‹ and › buttons). The server has no trail, so its value
 * differs on purpose: the buttons render again once the page is live, with the trail saved for this tab.
 */
export function useTrail() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => version,
    () => -1,
  );
}
