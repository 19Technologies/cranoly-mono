"use client";

import { useMemo, useState } from "react";
import { ArrowDownToLine, FilePlus2, FileX2, Files, RefreshCw } from "lucide-react";
import Sheet from "./Sheet";
import { bringIn, preview, readIncoming, replaceWith, type Incoming } from "@/lib/backup";
import { isApp } from "@/lib/native";
import { toast, useVault } from "@/lib/store";
import { setUI, useUI } from "@/lib/ui";

/**
 * Pick a backup to bring in: a "Cranoly Mono backup" file, a Cranoly Mono.zip or .md notes. On a phone the
 * picker includes Google Drive, so the laptop's backup can be opened straight from there.
 */
export function pickBackup(then?: (incoming: Incoming) => void) {
  const input = document.createElement("input");
  input.type = "file";
  input.multiple = true;
  // Android's picker greys out files whose type it doesn't recognise, so the app accepts anything.
  if (!isApp()) input.accept = ".json,.zip,.md,.markdown,.txt,application/json,application/zip,text/markdown,text/plain";
  input.onchange = async () => {
    const files = [...(input.files ?? [])];
    if (!files.length) return;
    try {
      const incoming = await readIncoming(files);
      if (then) then(incoming);
      else setUI({ bringIn: incoming, mobileLeft: false, palette: null });
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn’t read that file.");
    }
  };
  input.click();
}

const when = (t: number) =>
  new Date(t).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

function Summary({ incoming }: { incoming: Incoming }) {
  const { notes } = useVault();
  const result = useMemo(() => preview(incoming), [incoming, notes]); // eslint-disable-line react-hooks/exhaustive-deps
  const [confirm, setConfirm] = useState(false);
  const close = () => setUI({ bringIn: null });
  const here = Object.keys(notes).length;
  const rows = [
    { n: result.added, label: result.added === 1 ? "new note" : "new notes", icon: <FilePlus2 size={17} /> },
    { n: result.updated, label: "updated", icon: <RefreshCw size={17} /> },
    { n: result.deleted, label: "deleted, as on the other device", icon: <FileX2 size={17} /> },
    { n: result.kept, label: result.kept === 1 ? "changed on both, so both versions are kept" : "changed on both, so both versions of each are kept", icon: <Files size={17} /> },
  ].filter((r) => r.n);

  return (
    <div className="bring">
      <p className="bring-from">
        From <b>{incoming.from}</b>
        {incoming.savedAt ? `, saved ${when(incoming.savedAt)}` : ""}. {incoming.count} {incoming.count === 1 ? "note" : "notes"}.
      </p>
      {rows.length ? (
        <ul className="bring-rows">
          {rows.map((r) => (
            <li key={r.label}>
              {r.icon}
              <b>{r.n}</b> {r.label}
            </li>
          ))}
        </ul>
      ) : (
        <p className="bring-none">{result.changed ? "Only study history to bring in." : "Nothing new: this device already has everything in it."}</p>
      )}
      {confirm ? (
        <div className="bring-confirm">
          <p>
            This replaces all {here} {here === 1 ? "note" : "notes"} on this device, and your study history and settings, with the
            backup&apos;s {incoming.count}. You can undo it straight after.
          </p>
          <div className="bring-actions">
            <button
              className="btn btn-danger"
              onClick={() => {
                replaceWith(incoming);
                close();
              }}
            >
              Replace everything
            </button>
            <button className="btn" onClick={() => setConfirm(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="bring-actions">
          <button
            className="btn btn-primary"
            disabled={!result.changed}
            onClick={() => {
              bringIn(incoming, result);
              close();
            }}
          >
            <ArrowDownToLine size={16} /> Bring in changes
          </button>
          <button className="btn" onClick={() => setConfirm(true)}>
            Replace everything with this
          </button>
        </div>
      )}
      <p className="bring-note">Nothing on this device is lost: a note changed in both places is kept twice, and Undo puts everything back.</p>
    </div>
  );
}

/** The "Bring in changes" sheet: what a backup from another device would change, then a yes. */
export default function BringIn() {
  const { bringIn: incoming } = useUI();
  return (
    <Sheet open={!!incoming} onClose={() => setUI({ bringIn: null })} title="Bring in notes" className="bring-sheet">
      {incoming && <Summary incoming={incoming} />}
    </Sheet>
  );
}
