// Bringing in notes from another device: the Cranoly Mono folder (or a backup file shared from it) is how
// notes travel between a phone and a laptop. Nothing is replaced wholesale:
// - a note changed on one device only: that version is used;
// - changed on both: if both only added lines at the end (new words), both additions are kept,
//   otherwise both versions are kept, the other one as "Title (from Laptop)";
// - deleted on one device and not changed on the other since: deleted;
// - study history combines (for each day, the higher count).
// Bringing in the same backup twice changes nothing.
import { folderOf, newId, titleOf, type Note, type VaultState } from "./vault";

/** What a Cranoly Mono backup file holds (older exports have only the vault part). */
export interface Backup {
  cranoly?: number;
  /** The device that saved it, and what it's called ("Phone", "Laptop"). */
  device?: string;
  deviceName?: string;
  savedAt?: number;
  /** For each other device, the newest of its backups already brought in when this was saved. */
  includes?: Record<string, number>;
  notes: Record<string, Note>;
  folders?: string[];
  deleted?: Record<string, number>;
  deletedFolders?: Record<string, number>;
  activity?: Record<string, number>;
  seen?: Record<string, number>;
}

export interface MergeContext {
  /** This device's id. */
  me: string;
  /** This device's name, for copies of our own version ("Phone"). */
  myName: string;
  /** The newest backup from the other device already brought in here (its savedAt), or 0. */
  lastFromThem: number;
  now: number;
}

export interface MergeResult {
  state: VaultState;
  added: number;
  updated: number;
  deleted: number;
  /** Notes changed on both devices in different places: both versions kept. */
  kept: number;
  changed: boolean;
}

/** Tombstones older than this are forgotten. */
export const FORGET_AFTER = 90 * 24 * 3600 * 1000;

export const modifiedOf = (n: Note) => n.modified ?? n.updated;

const sameNote = (a: Note, b: Note) => a.content === b.content && a.path === b.path && !!a.pinned === !!b.pinned;

/**
 * Two versions of a text with no common ancestor to compare against. "a"/"b": one already holds every
 * line of the other. "merged": both only added lines after the lines they share (both additions kept).
 */
export type Combined = { kind: "a" } | { kind: "b" } | { kind: "conflict" } | { kind: "merged"; text: string };

export function combine(a: string, b: string): Combined {
  const A = a.split("\n");
  const B = b.split("\n");
  const inA = new Set(A);
  const inB = new Set(B);
  const blank = (l: string) => !l.trim();
  const onlyA = A.filter((l) => !inB.has(l) && !blank(l));
  const onlyB = B.filter((l) => !inA.has(l) && !blank(l));
  if (!onlyB.length) return { kind: "a" };
  if (!onlyA.length) return { kind: "b" };
  // Where each side's own lines start: after the last line both have.
  const tailFrom = (X: string[], other: Set<string>) => {
    let last = -1;
    X.forEach((l, i) => {
      if (other.has(l) && !blank(l)) last = i;
    });
    return last + 1;
  };
  const a0 = tailFrom(A, inB);
  const b0 = tailFrom(B, inA);
  const onlyAtEnd = (X: string[], other: Set<string>, from: number) => X.every((l, i) => i >= from || other.has(l) || blank(l));
  if (!onlyAtEnd(A, inB, a0) || !onlyAtEnd(B, inA, b0)) return { kind: "conflict" };
  const head = A.join("\n").replace(/\s+$/, "");
  const extra = B.slice(b0).filter((l) => !inA.has(l));
  while (extra.length && blank(extra[0])) extra.shift();
  return { kind: "merged", text: `${head}\n${extra.join("\n").replace(/\s+$/, "")}\n` };
}

/** A free path for a copy: "German/Lesson 13 (from Laptop)", then "… 2" if that's taken too. */
function copyPath(path: string, from: string, taken: (p: string) => boolean) {
  const folder = folderOf(path);
  const base = `${titleOf(path)} (from ${from})`;
  for (let i = 1; ; i++) {
    const title = i === 1 ? base : `${base} ${i}`;
    const p = folder ? `${folder}/${title}` : title;
    if (!taken(p)) return p;
  }
}

export function mergeBackup(local: VaultState, incoming: Backup, ctx: MergeContext): MergeResult {
  const theirName = incoming.deviceName || "backup";
  const theySawMine = incoming.includes?.[ctx.me] ?? 0;
  const notes: Record<string, Note> = { ...local.notes };
  const deleted: Record<string, number> = { ...(local.deleted ?? {}) };
  let added = 0;
  let updated = 0;
  let removed = 0;
  let kept = 0;

  const pathTaken = (p: string, except?: string) =>
    Object.values(notes).some((n) => n.id !== except && n.path.toLowerCase() === p.toLowerCase());

  /**
   * Both versions changed: one note if the texts fit together, with the newer version's title and pin (so a
   * rename on one device and new lines on the other end up the same on both); else the newer one plus a copy
   * of the older.
   */
  const reconcile = (mine: Note, theirs: Note) => {
    const c = combine(mine.content, theirs.content);
    const newer = modifiedOf(theirs) > modifiedOf(mine) ? theirs : mine;
    if (c.kind !== "conflict") {
      const content = c.kind === "a" ? mine.content : c.kind === "b" ? theirs.content : c.text;
      const path = pathTaken(newer.path, mine.id) ? mine.path : newer.path;
      const next = { ...newer, id: mine.id, path, content, updated: Math.max(mine.updated, theirs.updated) };
      if (sameNote(next, mine)) return;
      notes[mine.id] = { ...next, modified: sameNote(next, theirs) ? modifiedOf(theirs) : ctx.now };
      updated++;
      return;
    }
    const older = newer === theirs ? mine : theirs;
    notes[mine.id] = { ...newer, id: mine.id };
    if (newer === theirs) updated++;
    const copy: Note = {
      ...older,
      id: newId(),
      path: copyPath(older.path, older === theirs ? theirName : ctx.myName, (p) => pathTaken(p)),
      modified: ctx.now,
    };
    notes[copy.id] = copy;
    kept++;
  };

  // 1. Notes they have: new here, changed there, changed on both, or unchanged.
  for (const theirs of Object.values(incoming.notes ?? {})) {
    if (!theirs?.id || typeof theirs.content !== "string" || typeof theirs.path !== "string") continue;
    const mine = notes[theirs.id];
    if (!mine) {
      const gone = deleted[theirs.id];
      if (gone && gone >= modifiedOf(theirs)) continue; // deleted here after their last change
      delete deleted[theirs.id];
      // Two different notes in the same place (both devices made "German words"): one note if they
      // fit together, else both, theirs renamed.
      const twin = Object.values(notes).find((n) => n.path.toLowerCase() === theirs.path.toLowerCase());
      if (twin) {
        const c = combine(twin.content, theirs.content);
        if (c.kind !== "conflict") {
          // The same note survives on both devices: the one with the smaller id.
          const keep = twin.id < theirs.id ? twin : theirs;
          const drop = keep === twin ? theirs : twin;
          const content = c.kind === "a" ? twin.content : c.kind === "b" ? theirs.content : c.text;
          delete notes[drop.id];
          deleted[drop.id] = ctx.now;
          notes[keep.id] = {
            ...keep,
            content,
            created: Math.min(twin.created, theirs.created),
            updated: Math.max(twin.updated, theirs.updated),
            modified: ctx.now,
          };
          if (content !== twin.content || keep !== twin) updated++;
          continue;
        }
        notes[theirs.id] = { ...theirs, path: copyPath(theirs.path, theirName, (p) => pathTaken(p)), modified: ctx.now };
        kept++;
        continue;
      }
      notes[theirs.id] = theirs;
      added++;
      continue;
    }
    if (sameNote(mine, theirs)) continue;
    const mineChanged = modifiedOf(mine) > theySawMine;
    const theirsChanged = modifiedOf(theirs) > ctx.lastFromThem;
    if (theirsChanged && !mineChanged) {
      notes[theirs.id] = theirs;
      updated++;
    } else if (mineChanged && !theirsChanged) {
      continue;
    } else reconcile(mine, theirs);
  }

  // 2. Notes they deleted: gone here too, unless changed here since.
  for (const [id, at] of Object.entries(incoming.deleted ?? {})) {
    if (typeof at !== "number" || incoming.notes?.[id]) continue;
    const mine = notes[id];
    if (mine && modifiedOf(mine) > at) continue; // edited here after they deleted it: it stays
    if (mine) {
      delete notes[id];
      removed++;
    }
    deleted[id] = Math.max(deleted[id] ?? 0, at);
  }

  // 3. Folders, study history, the "not seen lately" times.
  const deletedFolders: Record<string, number> = { ...(local.deletedFolders ?? {}) };
  for (const [f, at] of Object.entries(incoming.deletedFolders ?? {})) deletedFolders[f] = Math.max(deletedFolders[f] ?? 0, at);
  // A folder deleted on either device goes, unless notes still live in it.
  const used = new Set(Object.values(notes).map((n) => folderOf(n.path)));
  const folders = [...new Set([...local.folders, ...(incoming.folders ?? [])])].filter((f) => !deletedFolders[f] || used.has(f));
  const activity = { ...local.activity };
  for (const [day, n] of Object.entries(incoming.activity ?? {})) if (typeof n === "number") activity[day] = Math.max(activity[day] ?? 0, n);
  const seen = { ...local.seen };
  for (const [card, at] of Object.entries(incoming.seen ?? {})) if (typeof at === "number") seen[card] = Math.max(seen[card] ?? 0, at);

  // Forget old tombstones.
  for (const [id, at] of Object.entries(deleted)) if (ctx.now - at > FORGET_AFTER) delete deleted[id];
  for (const [f, at] of Object.entries(deletedFolders)) if (ctx.now - at > FORGET_AFTER) delete deletedFolders[f];

  const studyChanged =
    Object.keys(activity).some((d) => activity[d] !== local.activity[d]) || Object.keys(seen).some((c) => seen[c] !== local.seen[c]);
  const foldersChanged = folders.length !== local.folders.length || folders.some((f) => !local.folders.includes(f));
  return {
    state: { ...local, notes, deleted, deletedFolders, folders, activity, seen },
    added,
    updated,
    deleted: removed,
    kept,
    changed: added + updated + removed + kept > 0 || studyChanged || foldersChanged,
  };
}
