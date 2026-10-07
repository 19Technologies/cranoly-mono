"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { SystemBars, SystemBarsStyle } from "@capacitor/core";
import { getVault, vault } from "@/lib/store";
import { getUI, runBack, setUI } from "@/lib/ui";
import { isApp } from "@/lib/native";
import { go, placePath } from "@/lib/trail";
import { prepareDeviceVoice } from "@/lib/speech";

/**
 * Android app behaviour: the back button closes what's open, steps back through the welcome and the
 * tour, then retraces the places you visited (the same trail as the bar's ‹), and leaves the app from
 * the notes list. The status bar icons follow the theme (and the Mind Map, which is always dark).
 */
export default function NativeBridge() {
  const router = useRouter();
  const pathname = usePathname();

  // Ask the phone which languages its own voice speaks, so the first tap on a speaker knows at once.
  useEffect(prepareDeviceVoice, []);

  useEffect(() => {
    if (!isApp()) return;
    let remove: (() => void) | undefined;
    let live = true;
    import("@capacitor/app").then(async ({ App }) => {
      const handle = await App.addListener("backButton", () => {
        if (runBack()) return;
        const ui = getUI();
        if (ui.explain) return setUI({ explain: null });
        if (ui.newWords) return setUI({ newWords: null });
        if (ui.addWord) return setUI({ addWord: null });
        if (ui.format) return setUI({ format: null });
        if (ui.scan) return setUI({ scan: null });
        if (ui.plus) return setUI({ plus: false });
        if (ui.onboarding) return setUI({ onboarding: false });
        if (ui.palette) return setUI({ palette: null });
        if (ui.sheet) return setUI({ sheet: null });
        if (ui.mobileLeft || ui.mobileRight) return setUI({ mobileLeft: false, mobileRight: false });
        // The welcome's first screen and the notes list are where the app starts: back leaves it.
        if (!getVault().settings.onboarded || pathname === "/notes") return App.minimizeApp();
        const moved = go(-1, {
          here: placePath(pathname, window.location.search),
          push: (path) => router.push(path),
          openNote: (id) => vault.openNote(id),
          showFolder: (folder) => vault.showFolder(folder),
          exists: (id) => !!getVault().notes[id],
        });
        if (!moved) router.push("/notes");
      });
      if (live) remove = () => handle.remove();
      else handle.remove();
    });
    return () => {
      live = false;
      remove?.();
    };
  }, [pathname, router]);

  useEffect(() => {
    if (!isApp()) return;
    const root = document.documentElement;
    // Paper is light, so the status bar needs dark icons; Graphite and the Mind Map are the other way round.
    const apply = () =>
      SystemBars.setStyle({
        style: root.dataset.theme === "graphite" || pathname === "/mind-map" ? SystemBarsStyle.Dark : SystemBarsStyle.Light,
      }).catch(() => {});
    apply();
    const watch = new MutationObserver(apply);
    watch.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    return () => watch.disconnect();
  }, [pathname]);

  return null;
}
