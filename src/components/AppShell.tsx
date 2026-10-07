"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { X } from "lucide-react";
import { dismissToast, getVault, useToasts, useVault, vault } from "@/lib/store";
import { getUI, setUI, useUI } from "@/lib/ui";
import { applyTheme } from "@/lib/theme";
import { usePhone } from "@/lib/usePhone";
import { expectPlace, placePath, recordPlace } from "@/lib/trail";
import Sidebar from "./Sidebar";
import NoteList from "./NoteList";
import CommandPalette from "./CommandPalette";
import MobileNav from "./MobileNav";
import EditToolbar from "./EditToolbar";
import Logo from "./Logo";
import RightPanel from "./RightPanel";
import Onboarding from "./Onboarding";
import WordSheet from "./WordSheet";
import NativeBridge from "./NativeBridge";
import NewWordsSheet from "./NewWordsSheet";
import Welcome from "./Welcome";
import AddWord from "./AddWord";
import FormatSheet from "./FormatSheet";
import ScanSheet from "./ScanSheet";
import BringIn from "./BringIn";
import PlusSheet from "./PlusSheet";
import { startBackup } from "@/lib/backup";

function Toasts() {
  const toasts = useToasts();
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className="toast">
          <span>{t.message}</span>
          {t.action && (
            <button
              className="toast-action"
              onClick={() => {
                t.action!.run();
                dismissToast(t.id);
              }}
            >
              {t.action.label}
            </button>
          )}
          <button className="icon-btn" aria-label="Dismiss" onClick={() => dismissToast(t.id)}>
            <X size={13} />
          </button>
        </div>
      ))}
    </div>
  );
}

const NO_SWIPE = "[data-no-swipe], input, textarea, .cm-editor, .tabs, .table-wrap, pre, .graph-canvas, .flip-wrap, .heatmap-wrap, .palette-backdrop";

/**
 * Drawer gestures on touch screens: swipe right (tablets) for folders, swipe left in a note for
 * links, cards and outline. The drawer tracks your finger.
 */
function useDrawerSwipe(pathname: string) {
  useEffect(() => {
    let start: { x: number; y: number; t: number } | null = null;
    let axis: "x" | "y" | null = null;
    let panel: { el: HTMLElement; side: "left" | "right"; opening: boolean } | null = null;
    let dx = 0;

    const isTablet = () => window.matchMedia("(min-width: 821px) and (max-width: 1180px)").matches;
    const tabletRight = () => window.matchMedia("(max-width: 1400px)").matches;

    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const ui = getUI();
      const drawerOpen = ui.mobileLeft || ui.mobileRight;
      if (ui.sheet || ui.palette || (!drawerOpen && (e.target as Element).closest(NO_SWIPE))) return;
      start = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() };
      axis = null;
      panel = null;
      dx = 0;
    };

    const onMove = (e: TouchEvent) => {
      if (!start) return;
      const x = e.touches[0].clientX - start.x;
      const y = e.touches[0].clientY - start.y;
      if (!axis) {
        if (Math.abs(x) < 10 && Math.abs(y) < 10) return;
        axis = Math.abs(x) > Math.abs(y) * 1.3 ? "x" : "y";
        if (axis === "y") return;
        const ui = getUI();
        let side: "left" | "right" | null = null;
        let opening = true;
        if (ui.mobileLeft) [side, opening] = ["left", false];
        else if (ui.mobileRight) [side, opening] = ["right", false];
        else if (x > 0 && isTablet()) side = "left";
        else if (x < 0 && pathname === "/" && tabletRight()) side = "right";
        const el = side && document.querySelector<HTMLElement>(side === "left" ? ".sidebar-left" : ".right-panel");
        if (!el || !side) {
          start = null;
          return;
        }
        panel = { el, side, opening };
        el.style.transition = "none";
      }
      if (axis !== "x" || !panel) return;
      e.preventDefault();
      dx = x;
      const w = panel.el.offsetWidth;
      const tx =
        panel.side === "left"
          ? Math.min(0, Math.max(-w, (panel.opening ? -w : 0) + dx))
          : Math.max(0, Math.min(w, (panel.opening ? w : 0) + dx));
      panel.el.style.transform = `translateX(${tx}px)`;
      document.documentElement.style.setProperty("--drawer-progress", String(1 - Math.abs(tx) / w));
      document.documentElement.classList.add("is-dragging-drawer");
    };

    const onEnd = () => {
      if (panel) {
        const { el, side, opening } = panel;
        const w = el.offsetWidth;
        const fast = Math.abs(dx) / Math.max(1, Date.now() - start!.t) > 0.5;
        const toward = side === "left" ? (opening ? dx > 0 : dx < 0) : opening ? dx < 0 : dx > 0;
        const flip = toward && (Math.abs(dx) > w * 0.3 || fast);
        const open = opening ? flip : !flip;
        el.style.transition = "";
        el.style.transform = "";
        document.documentElement.classList.remove("is-dragging-drawer");
        document.documentElement.style.removeProperty("--drawer-progress");
        setUI(side === "left" ? { mobileLeft: open } : { mobileRight: open });
        if (open && opening) navigator.vibrate?.(8);
      }
      start = null;
      panel = null;
      axis = null;
    };

    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onEnd);
    window.addEventListener("touchcancel", onEnd);
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onEnd);
    };
  }, [pathname]);
}

/** Keep <html data-theme> in sync with the setting (and with the device when set to System). */
function useTheme(choice: "paper" | "graphite" | "system", ready: boolean) {
  useEffect(() => {
    if (!ready) return;
    applyTheme(choice);
    if (choice !== "system") return;
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [choice, ready]);
}

// Phones open on the notes list. Only on launch: later visits to "/" are someone opening a note.
let launched = false;

export default function AppShell({ children }: { children: ReactNode }) {
  const { workspace, notes, ready, settings } = useVault();
  useTheme(settings.theme, ready);
  const { mobileLeft, mobileRight, editorFocused } = useUI();
  const pathname = usePathname();
  const router = useRouter();
  useDrawerSwipe(pathname);
  const phone = usePhone();
  const note = pathname === "/" && workspace.active ? notes[workspace.active] : undefined;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      const key = e.key.toLowerCase();
      if ((key === "k" || key === "p") && !e.shiftKey) {
        e.preventDefault();
        setUI((s) => ({ palette: s.palette === "commands" ? null : "commands" }));
      } else if (key === "o") {
        e.preventDefault();
        setUI((s) => ({ palette: s.palette === "notes" ? null : "notes" }));
      } else if (key === "f" && e.shiftKey) {
        e.preventDefault();
        router.push("/search");
      } else if (key === "\\") {
        e.preventDefault();
        if (window.matchMedia("(max-width: 1180px)").matches) setUI((s) => ({ mobileLeft: !s.mobileLeft }));
        else vault.setPanel("leftOpen");
      } else if (key === "e" && pathname === "/") {
        e.preventDefault();
        vault.setMode(getVault().workspace.mode === "read" ? "edit" : "read");
      } else if (e.altKey && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
        e.preventDefault();
        vault.go(e.key === "ArrowLeft" ? -1 : 1);
        if (pathname !== "/") router.push("/");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pathname, router]);

  useEffect(() => {
    setUI({ mobileLeft: false, mobileRight: false, sheet: null });
  }, [pathname]);

  useEffect(() => {
    if (!ready || launched) return;
    launched = true;
    const phone = window.matchMedia("(max-width: 820px)").matches;
    if (phone && pathname === "/" && !new URLSearchParams(window.location.search).has("note")) {
      expectPlace("/notes");
      router.replace("/notes");
    }
  }, [ready, pathname, router]);

  // The Cranoly Mono folder: saved as you go (the phone's Documents › Cranoly Mono, or a folder chosen on a laptop).
  useEffect(() => {
    if (ready) return startBackup((path) => router.push(path));
  }, [ready, router]);

  // The trail behind the phone bar's ‹ and ›: every screen, note (on "/") and folder (on "/notes") you visit.
  const placeDetail = pathname === "/" ? workspace.active : pathname === "/notes" ? workspace.folder : null;
  useEffect(() => {
    if (!ready) return;
    recordPlace({
      path: placePath(pathname, window.location.search),
      note: pathname === "/" ? placeDetail : undefined,
      folder: pathname === "/notes" ? (placeDetail ?? "") : undefined,
    });
  }, [ready, pathname, placeDetail]);

  return (
    <div
      className="shell"
      data-left={workspace.leftOpen ? "open" : "closed"}
      data-list={pathname === "/" ? "shown" : "hidden"}
      data-right={note && workspace.rightOpen ? "open" : "closed"}
      data-mobile-left={mobileLeft ? "open" : "closed"}
      data-mobile-right={mobileRight ? "open" : "closed"}
      data-editing={editorFocused ? "true" : undefined}
    >
      {/* On phones the sidebar is the ☰ drawer. */}
      {ready && <Sidebar />}
      <div className="drawer-scrim" onClick={() => setUI({ mobileLeft: false, mobileRight: false })} />

      {pathname === "/" && !phone && <div className="list-col">{ready && <NoteList variant="column" />}</div>}

      <main className="main">
        <div className="view">{ready ? children : <div className="boot"><Logo size={28} /></div>}</div>
      </main>

      {pathname === "/" && (
        <aside className="right-panel" aria-label="Links, cards and outline">
          {ready && note && <RightPanel note={note} />}
        </aside>
      )}

      <MobileNav />
      <EditToolbar />
      <CommandPalette />
      <Onboarding />
      <Welcome />
      <AddWord />
      <FormatSheet />
      <ScanSheet />
      <BringIn />
      <PlusSheet />
      <WordSheet />
      <NewWordsSheet />
      <Toasts />
      <NativeBridge />
    </div>
  );
}
