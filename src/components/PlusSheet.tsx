"use client";

import { usePathname, useRouter } from "next/navigation";
import { ListPlus, ScanText, SquarePen } from "lucide-react";
import Sheet from "./Sheet";
import { getVault, vault } from "@/lib/store";
import { titleOf } from "@/lib/vault";
import { setUI, useUI } from "@/lib/ui";
import { haptic } from "@/lib/native";

/**
 * What ＋ opens. Its main job is a new note; under it, Scan (a page or a word list from a photo) and
 * Paste a list (words and their meanings).
 */
export default function PlusSheet() {
  const { plus } = useUI();
  const router = useRouter();
  const pathname = usePathname();
  const close = () => setUI({ plus: false });
  // New things go where you are: the open note's folder, or the folder the notes list shows.
  const here = () => {
    const ws = getVault().workspace;
    return pathname === "/" && ws.active ? ws.active : null;
  };
  const folder = getVault().workspace.folder;

  return (
    <Sheet open={plus} onClose={close} title="New" className="plus-sheet">
      <div className="plus-list">
        <button
          className="plus-item is-main"
          onClick={() => {
            haptic();
            setUI({ plus: false, pendingRename: vault.createNote({ folder }) });
            if (pathname !== "/") router.push("/");
          }}
        >
          <SquarePen size={22} />
          <span>
            <b>New note</b>
            <small>A blank page in {folder ? titleOf(folder) : "All Notes"}</small>
          </span>
        </button>
        <button className="plus-item" onClick={() => setUI({ plus: false, scan: { noteId: here() } })}>
          <ScanText size={22} />
          <span>
            <b>Scan</b>
            <small>Read a page or a word list from a photo</small>
          </span>
        </button>
        <button className="plus-item" onClick={() => setUI({ plus: false, addWord: { noteId: here(), mode: "list" } })}>
          <ListPlus size={22} />
          <span>
            <b>Paste a list</b>
            <small>Words and their meanings, one per line</small>
          </span>
        </button>
      </div>
    </Sheet>
  );
}
