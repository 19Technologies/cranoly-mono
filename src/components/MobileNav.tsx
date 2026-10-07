"use client";

import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, FileText, Plus, Search } from "lucide-react";
import { GlassIcon } from "@/components/ui/glass-icon";
import { getVault, vault } from "@/lib/store";
import { setUI, useUI } from "@/lib/ui";
import { useSlider } from "@/lib/useSlider";
import { haptic } from "@/lib/native";
import { canGo, go, placePath, useTrail } from "@/lib/trail";

const exists = (id: string) => !!getVault().notes[id];

/**
 * Phone bar: ‹ back, Notes, ＋ (new: a note, a scan or a list), Search, › forward. Glass icons only.
 * A white disc slides between Notes and Search; the arrows walk through the places you've been.
 */
export default function MobileNav() {
  const { editorFocused } = useUI();
  const pathname = usePathname();
  const router = useRouter();
  // -1 until the page is live (the server has no trail): the arrows start grey, as the server drew them.
  const live = useTrail() >= 0;
  const notes = pathname === "/notes" || pathname === "/";
  const search = pathname === "/search";
  // Practice gets the whole screen.
  const studying = pathname.startsWith("/flashcards/study");
  const nav = useSlider<HTMLElement>(".glass-icon.is-on", `${notes}|${search}|${studying}`);
  if (studying) return null;

  const step = (delta: -1 | 1) => {
    haptic();
    go(delta, {
      here: placePath(pathname, window.location.search),
      push: (path) => router.push(path),
      openNote: (id) => vault.openNote(id),
      showFolder: (folder) => vault.showFolder(folder),
      exists,
    });
  };
  const open = (href: string, here: boolean) => {
    if (here) return;
    haptic();
    router.push(href);
  };

  return (
    <nav ref={nav} className={`mobile-nav has-slider${editorFocused ? " is-hidden" : ""}`} aria-label="Navigation">
      <span className="slider-pill" aria-hidden />
      <GlassIcon className="mnav-arrow is-back" size={44} aria-label="Back" title="Back" disabled={!live || !canGo(-1, exists)} onClick={() => step(-1)}>
        <ChevronLeft size={22} strokeWidth={2.3} />
      </GlassIcon>
      <GlassIcon className="mnav-tab" size={44} on={notes} aria-label="Notes" title="Notes" aria-current={notes ? "page" : undefined} onClick={() => open("/notes", pathname === "/notes")}>
        <FileText size={20} />
      </GlassIcon>
      <GlassIcon
        className="mnav-add"
        size={52}
        aria-label="New"
        title="New note, scan or list"
        onClick={() => {
          haptic();
          setUI({ plus: true });
        }}
      >
        <Plus size={24} strokeWidth={2.4} />
      </GlassIcon>
      <GlassIcon className="mnav-tab" size={44} on={search} aria-label="Search" title="Search" aria-current={search ? "page" : undefined} onClick={() => open("/search", search)}>
        <Search size={20} />
      </GlassIcon>
      <GlassIcon className="mnav-arrow is-forward" size={44} aria-label="Forward" title="Forward" disabled={!live || !canGo(1, exists)} onClick={() => step(1)}>
        <ChevronRight size={22} strokeWidth={2.3} />
      </GlassIcon>
    </nav>
  );
}
