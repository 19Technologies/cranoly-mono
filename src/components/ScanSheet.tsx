"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, FilePlus2, ImageUp, ListPlus, Loader2, RotateCcw, TextSearch } from "lucide-react";
import Sheet from "./Sheet";
import { haptic } from "@/lib/native";
import { toast, useVault, vault } from "@/lib/store";
import { languageOf } from "@/lib/languages";
import { scanText } from "@/lib/ocr";
import { pairOf } from "@/lib/words";
import { INVALID_TITLE_CHARS, titleOf } from "@/lib/vault";
import { setUI, useUI } from "@/lib/ui";

const close = () => setUI({ scan: null });

/** A note title from the first few words of the text. */
function titleFrom(text: string) {
  const words = text.replace(new RegExp(INVALID_TITLE_CHARS, "g"), " ").split(/\s+/).filter(Boolean).slice(0, 6).join(" ");
  return words.length > 2 ? words.slice(0, 48).trim() : "Scanned text";
}

type Stage = "pick" | "reading" | "done" | "failed";

function Scanner({ noteId }: { noteId: string | null }) {
  const router = useRouter();
  const { settings, notes } = useVault();
  const [stage, setStage] = useState<Stage>("pick");
  const [status, setStatus] = useState({ text: "", progress: 0 });
  const [text, setText] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const camera = useRef<HTMLInputElement>(null);
  const library = useRef<HTMLInputElement>(null);
  const learning = languageOf(settings.learning);
  const native = languageOf(settings.native);
  const langs = learning.code === native.code ? [learning] : [learning, native];
  const note = noteId ? notes[noteId] : undefined;
  const pairs = text.split("\n").map(pairOf).filter((p): p is [string, string] => !!p);

  useEffect(() => () => void (photo && URL.revokeObjectURL(photo)), [photo]);

  const read = async (file: Blob) => {
    setPhoto(URL.createObjectURL(file));
    setStage("reading");
    setStatus({ text: "Getting the scanner ready…", progress: 0 });
    try {
      setText(await scanText(file, langs, (t, progress) => setStatus({ text: t, progress })));
      setStage("done");
      haptic("success");
    } catch {
      setStage("failed");
    }
  };

  // On a computer: paste a screenshot or a copied image.
  const onPaste = useEffectEvent((e: ClipboardEvent) => {
    const image = [...(e.clipboardData?.files ?? [])].find((f) => f.type.startsWith("image/"));
    if (stage !== "pick" || !image) return;
    e.preventDefault();
    void read(image);
  });
  useEffect(() => {
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, []);

  const picked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) void read(file);
  };
  const again = () => {
    setText("");
    setStage("pick");
  };

  /** Keep the text: in the note you came from, or in a new note. Returns that note. */
  const keep = () => {
    if (note) {
      vault.appendLine(note.id, text.trim());
      return note.id;
    }
    return vault.createNote({ title: titleFrom(text), content: `${text.trim()}\n`, open: false });
  };

  if (stage === "pick") {
    return (
      <div
        className="scan-pick"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const image = [...e.dataTransfer.files].find((f) => f.type.startsWith("image/"));
          if (image) void read(image);
        }}
      >
        <p className="add-hint">
          Take a photo of a page, a sign or a word list. Cranoly Mono reads the {langs.map((l) => l.name).join(" and ")} in it.
        </p>
        <div className="scan-buttons">
          <button className="scan-btn hint-touch" onClick={() => camera.current?.click()}>
            <Camera size={24} />
            <b>Take a photo</b>
          </button>
          <button className="scan-btn" onClick={() => library.current?.click()}>
            <ImageUp size={24} />
            <b>Choose a photo</b>
          </button>
        </div>
        <p className="add-hint hint-keys">You can also drop an image here, or paste one with ⌘V.</p>
        <p className="add-hint scan-fine">
          The photo stays on this device. The first scan downloads the scanner (about 5 MB).
        </p>
        <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={picked} />
        <input ref={library} type="file" accept="image/*" hidden onChange={picked} />
      </div>
    );
  }

  if (stage === "reading") {
    const pct = Math.round(status.progress * 100);
    return (
      <div className="scan-reading">
        {/* eslint-disable-next-line @next/next/no-img-element -- a local photo preview */}
        {photo && <img src={photo} alt="" className="scan-photo" />}
        <p className="scan-status">
          <Loader2 size={16} className="spin" /> {status.text}
          {status.text === "Reading…" && ` ${pct}%`}
        </p>
        <span className="voice-progress" aria-hidden>
          <i style={{ width: `${pct}%` }} />
        </span>
      </div>
    );
  }

  if (stage === "failed") {
    return (
      <div className="scan-reading">
        <p className="add-hint">
          Couldn’t read that photo. The first scan needs an internet connection to get the scanner.
        </p>
        <button className="btn btn-primary btn-lg" onClick={again}>
          <RotateCcw size={17} /> Try again
        </button>
      </div>
    );
  }

  return (
    <>
      <label className="add-field">
        <span>
          What it says <em>fix anything it got wrong</em>
        </span>
        <textarea rows={8} value={text} onChange={(e) => setText(e.target.value)} />
      </label>
      {!text.trim() && (
        <p className="add-hint">No text found. Try again in good light, with the phone flat above the page.</p>
      )}
      <div className="scan-actions">
        {pairs.length >= 2 && (
          <button
            className="btn btn-primary btn-lg"
            onClick={() => {
              vault.addCards(pairs, note?.id ?? null);
              haptic("success");
              toast(`Added ${pairs.length} words`);
              close();
            }}
          >
            <ListPlus size={17} /> Add {pairs.length} words
          </button>
        )}
        <button
          className={`btn btn-lg${pairs.length >= 2 ? "" : " btn-primary"}`}
          disabled={!text.trim()}
          onClick={() => {
            const id = keep();
            close();
            vault.openNote(id);
            router.push("/");
          }}
        >
          <FilePlus2 size={17} /> {note ? `Add to “${titleOf(note.path)}”` : "Save as a note"}
        </button>
        <button
          className="btn btn-lg"
          disabled={!text.trim()}
          onClick={() => setUI({ scan: null, newWords: { text, noteId: keep() } })}
        >
          <TextSearch size={17} /> Find new words
        </button>
      </div>
      <div className="add-other">
        <button onClick={again}>
          <RotateCcw size={16} /> Scan another
        </button>
      </div>
    </>
  );
}

/** "Scan text": read a page, a sign or a word list from a photo. */
export default function ScanSheet() {
  const { scan } = useUI();
  if (!scan) return null;
  return (
    <Sheet open title="Scan text" onClose={close} className="add-sheet">
      <Scanner noteId={scan.noteId} />
    </Sheet>
  );
}
