// The Cranoly Mono folder: a copy of everything, kept as you go. Each note is a Markdown file in the same
// folders as in the app, next to one backup file Cranoly Mono can read back in (with study history and
// deletions), and a dated copy for each of the last 7 days.
// - Phone app: Documents › Cranoly Mono, saved a few seconds after each change and when you leave the app.
// - Laptop (Chrome, Edge): a folder you choose once, saved the same way. Kept in Google Drive, Dropbox or
//   iCloud Drive, it's online too, and Cranoly Mono brings in the backups your other devices put there.
// - Other browsers: "Save a backup" downloads Cranoly Mono.zip with the same folder inside.
// Notes travel between devices through this folder; merge.ts decides how they're brought in.
import { useSyncExternalStore } from "react";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { getVault, onVaultChange, toast, vault } from "./store";
import { INVALID_TITLE_CHARS, isoDay, newId, normalize, type Note, type VaultState } from "./vault";
import { mergeBackup, modifiedOf, type Backup, type MergeResult } from "./merge";
import { isApp } from "./native";

/* ------------------------------------------------------------------ */
/* This device                                                         */
/* ------------------------------------------------------------------ */

interface Device {
  id: string;
  name: string;
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full: it's only bookkeeping */
  }
}

/** Which device this is: an id for bringing in notes, and a name for files and copies ("Phone"). */
function device(): Device {
  const saved = read<Device | null>("cranoly-device", null);
  if (saved?.id) return saved;
  const phone = isApp() || matchMedia("(pointer: coarse) and (max-width: 820px)").matches;
  const made = { id: newId(), name: phone ? "Phone" : "Laptop" };
  write("cranoly-device", made);
  return made;
}

/** For each other device, the newest of its backups already brought in here. */
const broughtIn = () => read<Record<string, number>>("cranoly-brought-in", {});
const setBroughtIn = (m: Record<string, number>) => write("cranoly-brought-in", m);

/* ------------------------------------------------------------------ */
/* What goes in the folder                                             */
/* ------------------------------------------------------------------ */

const COPIES = "Daily copies";
const KEEP_DAYS = 7;

const backupName = (name = device().name) => `Cranoly Mono backup (${name}).json`;

/** Everything in one object: the vault, plus which device saved it and what it had brought in. */
function backupOf(state: VaultState, savedAt = Date.now()) {
  const me = device();
  const { ready: _ready, ...rest } = state;
  void _ready;
  return { cranoly: 1, device: me.id, deviceName: me.name, savedAt, includes: broughtIn(), ...rest };
}

interface FolderFile {
  path: string;
  text: string;
  note?: string;
}

const clean = (segment: string) =>
  segment.replace(INVALID_TITLE_CHARS, " ").trim().replace(/[.\s]+$/, "") || "Untitled";

/** The files: one .md per note (in its folders), the backup file and today's copy. */
function filesOf(state: VaultState, now = Date.now()): FolderFile[] {
  const out: FolderFile[] = [];
  const taken = new Set<string>();
  const notes = Object.values(state.notes).sort((a, b) => a.created - b.created || a.id.localeCompare(b.id));
  for (const n of notes) {
    const base = n.path.split("/").map(clean).join("/");
    let path = `${base}.md`;
    for (let i = 2; taken.has(path.toLowerCase()); i++) path = `${base} (${i}).md`;
    taken.add(path.toLowerCase());
    out.push({ path, text: n.content, note: n.id });
  }
  const json = JSON.stringify(backupOf(state, now));
  out.push({ path: backupName(), text: json });
  out.push({ path: `${COPIES}/${isoDay(new Date(now))}.json`, text: json });
  return out;
}

function hash(s: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36) + "." + s.length.toString(36);
}

/** What changed since the last save: the notes and study history, not which note is open. */
const contentOf = (s: VaultState) => JSON.stringify([s.notes, s.folders, s.deleted, s.deletedFolders, s.activity, s.seen]);

/* ------------------------------------------------------------------ */
/* Where it's saved                                                    */
/* ------------------------------------------------------------------ */

interface Target {
  /** Which record of written files belongs to it. */
  key: string;
  write(path: string, text: string): Promise<void>;
  remove(path: string): Promise<void>;
}

/** The files this device last wrote to a folder: their content hash, when, and for which note. */
type Written = Record<string, { h: string; at: number; note?: string }>;
const writtenOf = (key: string) => read<Written>(`cranoly-folder-files:${key}`, {});
const setWritten = (key: string, w: Written) => write(`cranoly-folder-files:${key}`, w);

const filesystem = () => import("@capacitor/filesystem");

/** The phone's Documents › Cranoly Mono ("Cranoly Mono 2" if the first one can't be written, e.g. after reinstalling). */
const appRoot = () => read<string>("cranoly-app-folder", "Cranoly Mono");

function appTarget(root = appRoot()): Target {
  return {
    key: `app:${root}`,
    async write(path, text) {
      const { Filesystem, Directory, Encoding } = await filesystem();
      await Filesystem.writeFile({ path: `${root}/${path}`, data: text, directory: Directory.Documents, encoding: Encoding.UTF8, recursive: true });
    },
    async remove(path) {
      const { Filesystem, Directory } = await filesystem();
      await Filesystem.deleteFile({ path: `${root}/${path}`, directory: Directory.Documents });
    },
  };
}

/** Android 10 and older ask for storage access once; newer phones don't need to. */
async function appAllowed() {
  const { Filesystem } = await filesystem();
  const now = await Filesystem.checkPermissions().catch(() => null);
  if (!now || now.publicStorage === "granted") return true;
  const asked = await Filesystem.requestPermissions().catch(() => null);
  return asked?.publicStorage === "granted";
}

type Dir = FileSystemDirectoryHandle & {
  queryPermission?: (o: { mode: "readwrite" }) => Promise<PermissionState>;
  requestPermission?: (o: { mode: "readwrite" }) => Promise<PermissionState>;
};

const entriesOf = (dir: FileSystemDirectoryHandle) =>
  (dir as unknown as { values(): AsyncIterable<FileSystemDirectoryHandle | FileSystemFileHandle> }).values();

async function subdir(root: FileSystemDirectoryHandle, parts: string[], create: boolean) {
  let dir = root;
  for (const p of parts) dir = await dir.getDirectoryHandle(p, { create });
  return dir;
}

function folderTarget(root: Dir): Target {
  return {
    key: "folder",
    async write(path, text) {
      const parts = path.split("/");
      const name = parts.pop()!;
      const file = await (await subdir(root, parts, true)).getFileHandle(name, { create: true });
      const out = await file.createWritable();
      await out.write(text);
      await out.close();
    },
    async remove(path) {
      const parts = path.split("/");
      const name = parts.pop()!;
      await (await subdir(root, parts, false)).removeEntry(name);
    },
  };
}

/* The chosen laptop folder is remembered in IndexedDB (a folder handle can't go in localStorage). */
function handles<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    const open = indexedDB.open("cranoly", 1);
    open.onupgradeneeded = () => open.result.createObjectStore("handles");
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const req = run(open.result.transaction("handles", mode).objectStore("handles"));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    };
  });
}

let picked: Dir | null = null;

/* ------------------------------------------------------------------ */
/* Status, for Settings                                                */
/* ------------------------------------------------------------------ */

export interface BackupStatus {
  /** Where it's saved: the phone's folder, a chosen folder, or nowhere yet (save a .zip instead). */
  where: "app" | "folder" | null;
  folder?: string;
  lastSaved?: number;
  saving?: boolean;
  error?: string;
  /** The browser wants a tap before writing to the chosen folder again. */
  needsPermission?: boolean;
  /** The phone saves automatically unless this is turned off. */
  auto: boolean;
}

let status: BackupStatus = { where: null, auto: true };
const statusListeners = new Set<() => void>();
function setStatus(patch: Partial<BackupStatus>) {
  status = { ...status, ...patch };
  statusListeners.forEach((l) => l());
}

export function useBackupStatus() {
  return useSyncExternalStore(
    (l) => {
      statusListeners.add(l);
      return () => statusListeners.delete(l);
    },
    () => status,
    () => status,
  );
}

/** Tests can make a browser save like the phone app does (to the Filesystem plugin's stand-in). */
const actLikeApp = () => isApp() || (typeof window !== "undefined" && (window as { __cranolyAppFolder?: boolean }).__cranolyAppFolder === true);

const canChooseFolder = () => typeof window !== "undefined" && "showDirectoryPicker" in window && !actLikeApp();

/** How this device keeps its folder: the phone's own, one you choose (Chrome, Edge), or a .zip. */
export const folderKind = (): "app" | "pick" | "zip" => (actLikeApp() ? "app" : canChooseFolder() ? "pick" : "zip");

/* ------------------------------------------------------------------ */
/* Saving                                                              */
/* ------------------------------------------------------------------ */

async function targetNow(): Promise<Target | null> {
  if (actLikeApp()) return status.auto ? appTarget() : null;
  if (!picked) return null;
  return (await picked.queryPermission?.({ mode: "readwrite" })) === "granted" ? folderTarget(picked) : null;
}

/**
 * Write what changed, remove what's gone (deleted or renamed notes, copies older than a week). `all`
 * writes every file again (Save now), in case some were removed from the folder by hand.
 */
async function writeFiles(target: Target, state: VaultState, all = false) {
  const before = writtenOf(target.key);
  const now = Date.now();
  const after: Written = {};
  for (const f of filesOf(state, now)) {
    const h = hash(f.text);
    const old = before[f.path];
    if (old && old.h === h && !all) after[f.path] = { ...old, note: f.note };
    else {
      await target.write(f.path, f.text);
      after[f.path] = { h, at: Date.now(), note: f.note };
    }
  }
  const oldest = isoDay(new Date(now - (KEEP_DAYS - 1) * 86_400_000));
  for (const [path, w] of Object.entries(before)) {
    if (after[path]) continue;
    const copy = path.startsWith(`${COPIES}/`) ? path.slice(COPIES.length + 1, -5) : null;
    if (copy && copy >= oldest) {
      after[path] = w;
      continue;
    }
    await target.remove(path).catch(() => {});
  }
  setWritten(target.key, after);
}

let saving: Promise<void> | null = null;
let again = false;
let goTo: (path: string) => void = () => {};

let forceNext = false;

/** Save to the folder now (if there is one). Calls during a save run once more after it. */
export function saveNow(opts: { all?: boolean } = {}): Promise<void> {
  if (opts.all) forceNext = true;
  if (saving) {
    again = true;
    return saving;
  }
  saving = (async () => {
    try {
      const all = forceNext;
      forceNext = false;
      await saveOnce(all);
    } finally {
      saving = null;
      if (again) {
        again = false;
        void saveNow();
      }
    }
  })();
  return saving;
}

async function saveOnce(all = false) {
  const state = getVault();
  if (!state.ready) return;
  const target = await targetNow();
  if (!target) return;
  const content = hash(contentOf(state));
  if (!all && read<string | null>(`cranoly-folder-content:${target.key}`, null) === content && status.lastSaved) return;
  setStatus({ saving: true });
  try {
    if (actLikeApp() && !(await appAllowed())) throw new Error("Storage permission was refused.");
    try {
      await writeFiles(target, state, all);
    } catch (e) {
      // After reinstalling, Android won't let the app change the files it made before. If new files
      // still work, carry on in "Cranoly Mono 2" (or the next free name) and say so.
      if (!actLikeApp() || read("cranoly-app-folder-moved", false)) throw e;
      const old = appRoot();
      await appTarget(old).write(`.check-${Date.now()}`, "ok");
      const next = await freeAppRoot();
      write("cranoly-app-folder", next);
      write("cranoly-app-folder-moved", true);
      setStatus({ folder: `Documents › ${next}` });
      toast(`Couldn’t change the files in Documents › ${old}, so Cranoly Mono now saves to Documents › ${next}.`);
      await writeFiles(appTarget(next), state);
    }
    write(`cranoly-folder-content:${target.key}`, content);
    const at = Date.now();
    write("cranoly-backup-last", at);
    setStatus({ saving: false, lastSaved: at, error: undefined });
    if (actLikeApp() && !read("cranoly-backup-told", false)) {
      write("cranoly-backup-told", true);
      toast(`Your notes are also saved in Documents › ${appRoot()}`, { label: "How it works", run: () => goTo("/settings#backup") });
    }
  } catch (e) {
    setStatus({ saving: false, error: e instanceof Error && /permission/i.test(e.message) ? e.message : "Couldn’t save to the folder." });
  }
}

async function freeAppRoot() {
  const { Filesystem, Directory } = await filesystem();
  for (let i = 2; i < 50; i++) {
    const name = `Cranoly Mono ${i}`;
    const there = await Filesystem.stat({ path: name, directory: Directory.Documents }).then(
      () => true,
      () => false,
    );
    if (!there) return name;
  }
  return `Cranoly Mono ${Date.now()}`;
}

/** Turn the phone's automatic saving on or off. */
export function setAutoSave(on: boolean) {
  write("cranoly-autosave", on);
  setStatus({ auto: on });
  if (on) void saveNow();
}

/* ------------------------------------------------------------------ */
/* The laptop's folder                                                 */
/* ------------------------------------------------------------------ */

/** Choose the folder on a laptop. If it isn't called Cranoly Mono, a Cranoly Mono folder is made inside it. */
export async function chooseFolder() {
  const pick = (window as unknown as { showDirectoryPicker: (o: object) => Promise<Dir> }).showDirectoryPicker;
  const chosen = await pick({ id: "cranoly", mode: "readwrite", startIn: "documents" });
  const root = (chosen.name === "Cranoly Mono" ? chosen : await chosen.getDirectoryHandle("Cranoly Mono", { create: true })) as Dir;
  await handles("readwrite", (s) => s.put(root, "folder"));
  picked = root;
  setWritten("folder", {});
  write("cranoly-folder-content:folder", null);
  setStatus({ where: "folder", folder: root.name === chosen.name ? root.name : `${chosen.name} › Cranoly Mono`, needsPermission: false, error: undefined });
  write("cranoly-folder-name", status.folder);
  await scanFolder(true);
  await saveNow();
}

/** Stop saving to the chosen folder (the files stay where they are). */
export async function forgetFolder() {
  picked = null;
  await handles("readwrite", (s) => s.delete("folder")).catch(() => {});
  setStatus({ where: null, folder: undefined, needsPermission: false });
}

/** After a restart the browser asks once before writing to the folder again. Needs a tap. */
export async function allowFolder() {
  if (!picked) return;
  const answer = await picked.requestPermission?.({ mode: "readwrite" });
  if (answer !== "granted") return;
  setStatus({ needsPermission: false });
  await scanFolder(true);
  await saveNow();
}

let lastScan = 0;

/**
 * Look in the laptop's folder for what changed outside Cranoly Mono: backups your other devices put there
 * (brought in), and notes edited or added as .md files. Nothing in the folder is ever deleted here.
 */
async function scanFolder(force = false) {
  if (!picked || actLikeApp()) return;
  if (!force && Date.now() - lastScan < 10_000) return;
  if ((await picked.queryPermission?.({ mode: "readwrite" })) !== "granted") {
    setStatus({ needsPermission: true });
    return;
  }
  lastScan = Date.now();
  const me = device();
  // 1. Backups from other devices.
  for await (const entry of entriesOf(picked)) {
    if (entry.kind !== "file" || !entry.name.toLowerCase().endsWith(".json") || entry.name === backupName()) continue;
    try {
      const data = JSON.parse(await (await (entry as FileSystemFileHandle).getFile()).text());
      if (!data?.cranoly || !data.device || data.device === me.id || typeof data.notes !== "object") continue;
      if ((data.savedAt ?? 0) <= (broughtIn()[data.device] ?? 0)) continue;
      bringIn({ backup: data, from: data.deviceName || "another device", savedAt: data.savedAt, count: Object.keys(data.notes).length });
    } catch {
      /* not a backup */
    }
  }
  // 2. Notes edited or added outside Cranoly Mono.
  const written = writtenOf("folder");
  const files: Array<{ path: string; handle: FileSystemFileHandle }> = [];
  const walk = async (dir: FileSystemDirectoryHandle, prefix: string) => {
    for await (const entry of entriesOf(dir)) {
      if (entry.kind === "directory") {
        if (!(prefix === "" && entry.name === COPIES)) await walk(entry, `${prefix}${entry.name}/`);
      } else if (entry.name.toLowerCase().endsWith(".md")) files.push({ path: prefix + entry.name, handle: entry });
    }
  };
  await walk(picked, "");
  const state = getVault();
  const notes = { ...state.notes };
  const byPath = new Map(filesOf(state).filter((f) => f.note).map((f) => [f.path, f.note!]));
  const now = Date.now();
  let changes = 0;
  for (const { path, handle } of files) {
    const file = await handle.getFile();
    const known = written[path];
    if (known && file.lastModified <= known.at + 2000) continue;
    const text = await file.text();
    const h = hash(text);
    if (known?.h === h) {
      written[path] = { ...known, at: Math.max(known.at, file.lastModified) };
      continue;
    }
    const id = known?.note ?? byPath.get(path);
    const note = id ? notes[id] : undefined;
    if (note && note.content === text) continue;
    if (note && modifiedOf(note) <= (known?.at ?? 0)) {
      notes[note.id] = { ...note, content: text, updated: now, modified: now };
    } else {
      // A new file, or a note changed both here and in the folder: both are kept.
      const title = path.replace(/\.md$/i, "").split("/").map(clean).join("/");
      const taken = (p: string) => Object.values(notes).some((n) => n.path.toLowerCase() === p.toLowerCase());
      let p = note ? `${title} (edited outside)` : title;
      for (let i = 2; taken(p); i++) p = `${note ? `${title} (edited outside)` : title} ${i}`;
      const fresh: Note = { id: newId(), path: p, content: text, created: file.lastModified, updated: now, modified: now };
      notes[fresh.id] = fresh;
    }
    written[path] = { h, at: now, note: id };
    changes++;
  }
  setWritten("folder", written);
  if (changes) vault.adopt({ ...getVault(), notes }, `Brought in ${changes} ${changes === 1 ? "change" : "changes"} from the Cranoly Mono folder`);
}

/* ------------------------------------------------------------------ */
/* Zip, share, and reading backups                                     */
/* ------------------------------------------------------------------ */

/** The folder as a .zip (the notes and the backup file, without the daily copies). */
function zipOf(state = getVault()) {
  const files: Record<string, Uint8Array> = {};
  for (const f of filesOf(state)) if (!f.path.startsWith(`${COPIES}/`)) files[`Cranoly Mono/${f.path}`] = strToU8(f.text);
  return zipSync(files, { level: 6 });
}

/** Browsers without folder access: download Cranoly Mono.zip. */
export function downloadZip() {
  const url = URL.createObjectURL(new Blob([zipOf().slice().buffer as ArrayBuffer], { type: "application/zip" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "Cranoly Mono.zip";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  write("cranoly-backup-last", Date.now());
  setStatus({ lastSaved: Date.now() });
}

/** The phone: send the backup file through the share sheet (Google Drive, Quick Share, email…). */
export async function shareCopy() {
  const { Filesystem, Directory, Encoding } = await filesystem();
  const name = backupName();
  await Filesystem.writeFile({ path: name, data: JSON.stringify(backupOf(getVault())), directory: Directory.Cache, encoding: Encoding.UTF8 });
  const { uri } = await Filesystem.getUri({ path: name, directory: Directory.Cache });
  const { Share } = await import("@capacitor/share");
  await Share.share({ title: "Cranoly Mono backup", files: [uri] }).catch((e: unknown) => {
    // Closing the share sheet without picking anything isn't a problem.
    if (!/cancel/i.test(e instanceof Error ? e.message : String(e))) throw e;
  });
}

/** A backup ready to bring in: where it's from and how many notes it holds. */
export interface Incoming {
  backup: Backup;
  from: string;
  savedAt?: number;
  count: number;
}

const NOT_A_BACKUP = "That isn’t a Cranoly Mono backup. Pick a “Cranoly Mono backup” file, a Cranoly Mono.zip or some .md notes.";

function fromJson(text: string): Incoming {
  let data: Backup & { deviceName?: string };
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(NOT_A_BACKUP);
  }
  if (!data || typeof data !== "object" || !data.notes || typeof data.notes !== "object") throw new Error(NOT_A_BACKUP);
  return { backup: data, from: data.deviceName || "a backup", savedAt: data.savedAt, count: Object.keys(data.notes).length };
}

/** Read what was picked: a backup file, a Cranoly Mono.zip, or .md notes (each becomes a note). */
export async function readIncoming(files: File[]): Promise<Incoming> {
  const mds: Array<{ path: string; text: string; at: number }> = [];
  for (const file of files) {
    const name = file.name.toLowerCase();
    if (name.endsWith(".zip")) {
      let entries: Record<string, Uint8Array>;
      try {
        entries = unzipSync(new Uint8Array(await file.arrayBuffer()));
      } catch {
        throw new Error(NOT_A_BACKUP);
      }
      const paths = Object.keys(entries);
      const json = paths.find((p) => /cranoly( mono)? backup[^/]*\.json$/i.test(p)) ?? paths.find((p) => p.endsWith(".json") && !p.includes(`${COPIES}/`));
      if (json) return fromJson(strFromU8(entries[json]));
      for (const p of paths)
        if (/\.(md|txt)$/i.test(p)) mds.push({ path: p.replace(/^Cranoly( Mono)?\//, "").replace(/\.(md|txt)$/i, ""), text: strFromU8(entries[p]), at: file.lastModified });
    } else if (/\.(md|markdown|txt)$/.test(name)) {
      mds.push({ path: file.name.replace(/\.(md|markdown|txt)$/i, ""), text: await file.text(), at: file.lastModified });
    } else return fromJson(await file.text());
  }
  if (!mds.length) throw new Error(NOT_A_BACKUP);
  const notes: Record<string, Note> = {};
  for (const m of mds) {
    const id = newId();
    const path = m.path.split("/").map(clean).join("/");
    notes[id] = { id, path, content: m.text, created: m.at, updated: m.at, modified: m.at };
  }
  return { backup: { notes, deviceName: "files" }, from: mds.length === 1 ? `“${mds[0].path}”` : `${mds.length} files`, count: mds.length };
}

/** What bringing in would do, without doing it. */
export function preview(incoming: Incoming): MergeResult {
  const me = device();
  const b = incoming.backup;
  return mergeBackup(getVault(), b, {
    me: me.id,
    myName: me.name,
    lastFromThem: b.device ? (broughtIn()[b.device] ?? 0) : 0,
    now: Date.now(),
  });
}

function summaryOf(r: MergeResult, from: string) {
  const parts = [
    r.added && `${r.added} new`,
    r.updated && `${r.updated} updated`,
    r.deleted && `${r.deleted} deleted`,
    r.kept && `${r.kept} kept twice`,
  ].filter(Boolean);
  if (parts.length) return `From ${from}: ${parts.join(", ")}`;
  return r.changed ? `Study history brought in from ${from}` : `Nothing new from ${from}`;
}

/** Bring in a backup's changes (with Undo). */
export function bringIn(incoming: Incoming, result = preview(incoming)) {
  const b = incoming.backup;
  const before = broughtIn();
  if (b.device && b.savedAt && b.device !== device().id) setBroughtIn({ ...before, [b.device]: Math.max(before[b.device] ?? 0, b.savedAt) });
  if (!result.changed) {
    toast(summaryOf(result, incoming.from));
    return;
  }
  vault.adopt(result.state, summaryOf(result, incoming.from), () => setBroughtIn(before));
}

/**
 * Replace everything here with a backup (with Undo): notes, study history and settings. Notes that were
 * here aren't remembered as deleted, so they can't disappear from your other devices because of it.
 */
export function replaceWith(incoming: Incoming) {
  const before = broughtIn();
  const b = incoming.backup;
  if (b.device && b.savedAt && b.device !== device().id) setBroughtIn({ ...before, [b.device]: b.savedAt });
  const next = normalize(b as unknown as Partial<VaultState>);
  vault.adopt(next, `Replaced with the ${incoming.count} ${incoming.count === 1 ? "note" : "notes"} from ${incoming.from}`, () => setBroughtIn(before), { track: false });
}

/* ------------------------------------------------------------------ */
/* Starting up                                                         */
/* ------------------------------------------------------------------ */

let saveTimer: ReturnType<typeof setTimeout> | undefined;
let lastContent: VaultState | null = null;

/** Start saving to the folder as you go. `go` opens a page (for "How it works"). */
export function startBackup(go: (path: string) => void) {
  goTo = go;
  setStatus({
    where: actLikeApp() ? "app" : null,
    folder: actLikeApp() ? `Documents › ${appRoot()}` : undefined,
    auto: read("cranoly-autosave", true),
    lastSaved: read<number | undefined>("cranoly-backup-last", undefined),
  });
  const soon = (ms: number) => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => void saveNow(), ms);
  };
  const stop = onVaultChange(() => {
    const s = getVault();
    const prev = lastContent;
    lastContent = s;
    if (prev && prev.notes === s.notes && prev.folders === s.folders && prev.activity === s.activity && prev.seen === s.seen && prev.deleted === s.deleted)
      return;
    soon(5000);
  });
  const onShow = () => {
    if (document.hidden) void saveNow();
    else void scanFolder();
  };
  document.addEventListener("visibilitychange", onShow);
  soon(1500);
  if (!actLikeApp() && "indexedDB" in window)
    void handles<Dir | undefined>("readonly", (s) => s.get("folder"))
      .then(async (h) => {
        if (!h) return;
        picked = h;
        const allowed = (await h.queryPermission?.({ mode: "readwrite" })) === "granted";
        setStatus({ where: "folder", folder: read("cranoly-folder-name", h.name), needsPermission: !allowed });
        if (allowed) await scanFolder(true);
      })
      .catch(() => {});
  return () => {
    stop();
    document.removeEventListener("visibilitychange", onShow);
    clearTimeout(saveTimer);
  };
}
