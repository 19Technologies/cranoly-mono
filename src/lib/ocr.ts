// "Scan text": reads the text in a photo with Tesseract (Apache-2.0), running on the device.
// Nothing is bundled with the app: the scanner (about 4 MB) and a small file per language
// (1 to 2 MB) come from public CDNs the first time, then the browser keeps them. The photo itself
// never leaves the device.
import type { Language } from "./languages";

const TESSERACT = "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js";
const LANG_PATH = "https://tessdata.projectnaptha.com/4.0.0_fast";

export type ScanProgress = (status: string, progress: number) => void;

/* eslint-disable @typescript-eslint/no-explicit-any -- Tesseract is loaded at runtime from a CDN */
let script: Promise<void> | null = null;
function loadTesseract() {
  script ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = TESSERACT;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("scanner"));
    document.head.appendChild(s);
  });
  script.catch(() => (script = null));
  return script;
}

const STATUS: Record<string, string> = {
  "loading tesseract core": "Getting the scanner ready…",
  "initializing tesseract": "Getting the scanner ready…",
  "loading language traineddata": "Getting the language files…",
  "initializing api": "Almost ready…",
  "recognizing text": "Reading…",
};

// One scanner stays ready for the next photo, as long as the languages don't change.
let report: ScanProgress = () => {};
let current: { langs: string; worker: Promise<any> } | null = null;
function workerFor(langs: string) {
  if (current?.langs !== langs) {
    const old = current;
    const worker = (async () => {
      await loadTesseract();
      const worker = await (window as any).Tesseract.createWorker(langs, 1, {
        langPath: LANG_PATH,
        logger: (m: { status: string; progress?: number }) => report(STATUS[m.status] ?? "Getting the scanner ready…", m.progress ?? 0),
      });
      // Find the page's own blocks and columns. The library's default reads the whole photo as one block, so each
      // line ran straight across: into the next column, or the facing page's cut-off words.
      await worker.setParameters({ tessedit_pageseg_mode: "3" });
      return worker;
    })();
    current = { langs, worker };
    worker.catch(() => {
      if (current?.worker === worker) current = null;
    });
    old?.worker.then((w) => w.terminate()).catch(() => {});
  }
  return current!.worker;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Phone photos are huge: 2000 px on the long side reads just as well, and much faster. */
async function prepare(file: Blob): Promise<Blob | HTMLCanvasElement> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return canvas;
  } catch {
    return file;
  }
}

interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}
interface ScanWord {
  text: string;
  confidence: number;
  bbox: Box;
}
interface ScanLine {
  bbox: Box;
  baseline?: Box;
  words: ScanWord[];
}
export interface ScanBlock {
  bbox: Box;
  paragraphs: Array<{ lines: ScanLine[] }>;
}

interface Line {
  text: string;
  words: number;
  bbox: Box;
  slope: number;
  /** It runs into the photo's edge, so it's probably cut off. */
  cut: boolean;
}
interface Block {
  paragraphs: Line[][];
  lines: Line[];
  bbox: Box;
}

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? 0;
const PAIRED = /\s[–—=:-]\s|\S\s*[=:]\s*\S/;

/** One line as text, without specks and unsure scraps, and with a wide gap marked as a column gap. */
function lineOf(l: ScanLine, width: number): Line | null {
  // Specks read as "~" or "|", and scraps of a letter or two the scanner is unsure of, aren't words.
  // Dashes and "=" stay: they pair a word with its meaning.
  const words = l.words.filter(
    (w) => /[\p{L}\p{N}]|^[-–—=:]+$/u.test(w.text.trim()) && !(w.confidence < 40 && w.text.trim().length <= 2 && /\p{L}/u.test(w.text)),
  );
  if (!words.length) return null;
  const confidence = words.reduce((sum, w) => sum + w.confidence, 0) / words.length;
  if (confidence < 45 || !/\p{L}/u.test(words.map((w) => w.text).join(""))) return null;
  const height = l.bbox.y1 - l.bbox.y0;
  const edge = width * 0.04;
  const b = l.baseline;
  return {
    // "Hund        dog": a gap much wider than a space is a column gap, written the way word lists are.
    text: words.map((w, i) => (i ? (w.bbox.x0 - words[i - 1].bbox.x1 > height * 1.6 ? " = " : " ") : "") + w.text.trim()).join(""),
    words: words.length,
    bbox: l.bbox,
    slope: b && b.x1 !== b.x0 ? (b.y1 - b.y0) / (b.x1 - b.x0) : 0,
    cut: l.bbox.x0 <= edge || l.bbox.x1 >= width - edge,
  };
}

/**
 * A paragraph's lines. Prose fills its column, so all its lines but the last run nearly full width: join them
 * back up, making words split by a hyphen whole. A list's lines are ragged, or pair words with "=" or a dash.
 */
/** A word and its meaning with a spaced dash between them, on a line of its own: a few words each side, no sentence. */
const SHORT_PAIR = /^([^.!?]{1,40}?)\s[–—-]\s([^.!?]{1,48})$/;
const shortPair = (t: string) => {
  const m = SHORT_PAIR.exec(t);
  return m && m[1].split(/\s+/).length <= 4 && m[2].split(/\s+/).length <= 6 ? `${m[1]} = ${m[2]}` : t;
};

function paragraph(lines: Line[]) {
  const texts = lines.map((l) => l.text);
  if (lines.length === 1) return shortPair(texts[0]);
  const width = Math.max(...lines.map((l) => l.bbox.x1 - l.bbox.x0));
  const full = lines.slice(0, -1).filter((l) => l.bbox.x1 - l.bbox.x0 >= width * 0.72).length / (lines.length - 1);
  const paired = texts.filter((t) => PAIRED.test(t)).length / texts.length;
  // A word list printed with dashes between word and meaning comes back the way Cranoly Mono writes pairs: "der Hund = the dog".
  if (paired > 0.5) return texts.map((t) => t.replace(/\s[–—-]\s/, " = ")).join("\n");
  if (full < 0.7) return texts.join("\n");
  return texts
    .join("\n")
    .replace(/(\p{L})[-¬]\n(?=\p{Ll})/gu, "$1")
    .replace(/\n/g, " ");
}

/**
 * Put what the scanner read back together, from where each line sits in the photo:
 * - text cut off by the photo's edge (the facing page of a book) is left out, as it only adds broken words;
 * - columns of short lines side by side (a word list, a table) are read across, row by row: "Hund = dog";
 * - prose is joined back into paragraphs, a list keeps its lines.
 */
function assemble(blocks: ScanBlock[], width: number) {
  const all = blocks
    .map((b): Block => {
      const paragraphs = b.paragraphs
        .map((p) => p.lines.map((l) => lineOf(l, width)).filter((l): l is Line => !!l))
        .filter((p) => p.length);
      return { paragraphs, lines: paragraphs.flat(), bbox: b.bbox };
    })
    .filter((b) => b.lines.length);
  const whole = all.filter((b) => b.lines.filter((l) => l.cut).length / b.lines.length < 0.5);
  // Only when something whole is left: a screenshot cropped close to its text still reads.
  const kept = whole.length ? whole : all;
  if (!kept.length) return "";

  const lines = kept.flatMap((b) => b.lines);
  const slope = median(lines.map((l) => l.slope));
  const lh = median(lines.map((l) => l.bbox.y1 - l.bbox.y0)) || 1;
  // How far down the page a line is, with the photo's tilt taken out.
  const level = (l: Line) => (l.bbox.y0 + l.bbox.y1) / 2 - slope * l.bbox.x0;
  const top = (b: Block) => Math.min(...b.lines.map(level)) - lh / 2;
  const bottom = (b: Block) => Math.max(...b.lines.map(level)) + lh / 2;
  const short = (b: Block) => median(b.lines.map((l) => l.words)) <= 4;
  const beside = (a: Block, b: Block) => {
    const overlap = Math.min(bottom(a), bottom(b)) - Math.max(top(a), top(b));
    const h = Math.min(bottom(a) - top(a), bottom(b) - top(b));
    return overlap >= h * 0.5 && (b.bbox.x0 >= a.bbox.x1 - lh || a.bbox.x0 >= b.bbox.x1 - lh);
  };
  const under = (a: Block, b: Block) =>
    Math.abs(a.bbox.x0 - b.bbox.x0) < lh * 1.5 && top(b) - bottom(a) < lh * 1.5 && top(b) > top(a);
  const columns = (b: Block) => {
    const xs = b.lines.map((l) => l.bbox.x0).sort((x, y) => x - y);
    return 1 + xs.filter((x, i) => i && x - xs[i - 1] > lh * 3).length;
  };

  // Group the blocks of a table: cells side by side, and the rows those cells stack into.
  const root = kept.map((_, i) => i);
  const find = (i: number): number => (root[i] === i ? i : (root[i] = find(root[i])));
  const partnered = kept.map(() => false);
  kept.forEach((a, i) =>
    kept.forEach((b, j) => {
      if (j > i && short(a) && short(b) && beside(a, b)) {
        root[find(j)] = find(i);
        partnered[i] = partnered[j] = true;
      }
    }),
  );
  kept.forEach((a, i) =>
    kept.forEach((b, j) => {
      if (i !== j && partnered[i] && partnered[j] && under(a, b)) root[find(j)] = find(i);
    }),
  );
  const groups: Block[][] = [];
  const at = new Map<number, Block[]>();
  kept.forEach((b, i) => {
    const g = at.get(find(i));
    if (g) g.push(b);
    else {
      at.set(find(i), [b]);
      groups.push(at.get(find(i))!);
    }
  });

  const out: string[] = [];
  for (const g of groups) {
    const cells = g.flatMap((b) => b.lines);
    if (short(g[0]) && (g.length > 1 || columns(g[0]) > 1) && cells.length >= 4) {
      const rows: Array<{ level: number; cells: Line[] }> = [];
      for (const l of cells.sort((a, b) => level(a) - level(b))) {
        const row = rows.find((r) => Math.abs(r.level - level(l)) < lh * 0.6);
        if (row) row.cells.push(l);
        else rows.push({ level: level(l), cells: [l] });
      }
      out.push(rows.map((r) => r.cells.sort((a, b) => a.bbox.x0 - b.bbox.x0).map((c) => c.text).join(" = ")).join("\n"));
    } else for (const b of g) for (const p of b.paragraphs) out.push(paragraph(p));
  }
  return out.filter(Boolean).join("\n\n");
}

/** Read the text in a photo, in these languages (the one being learned, and your own). */
export async function scanText(file: Blob, languages: Language[], onProgress: ScanProgress) {
  const langs = [...new Set(languages.map((l) => l.ocr))].join("+");
  report = onProgress;
  onProgress("Getting the scanner ready…", 0);
  try {
    const [worker, image] = await Promise.all([workerFor(langs), prepare(file)]);
    const { data } = await worker.recognize(image);
    const width = image instanceof HTMLCanvasElement ? image.width : Math.max(0, ...(data.blocks ?? []).map((b: ScanBlock) => b.bbox.x1));
    return assemble(data.blocks ?? [], width);
  } finally {
    report = () => {};
  }
}
