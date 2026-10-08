// Live Preview for the editor: markdown syntax (the [[ ]] around links, ** around
// bold, # before headings…) is hidden until the cursor touches it, so notes read cleanly while
// still being plain text underneath.

import { StateEffect, StateField, type EditorState, type Extension, type Range } from "@codemirror/state";
import { Decoration, EditorView, ViewPlugin, WidgetType, type DecorationSet, type ViewUpdate } from "@codemirror/view";
import {
  HighlightStyle,
  Language,
  LanguageSupport,
  defineLanguageFacet,
  languageDataProp,
  syntaxHighlighting,
  syntaxTree,
} from "@codemirror/language";
import { tags as t } from "@lezer/highlight";
import { GFM, parser } from "@lezer/markdown";
import { defaultUrlTransform } from "react-markdown";
import { CALLOUT_RE, calloutTitle } from "./callouts";
import { frontmatterOf, parseProperties, showDate, type PropertyValue } from "./properties";
import { TAG_RE, WIKI_RE, parseWikiInner, tintFor } from "./links";

// Markdown + GitHub extras (tables, task lists, strikethrough), without the HTML/JS/CSS parsers
// that @codemirror/lang-markdown would pull in.
const data = defineLanguageFacet();
const markdown = new LanguageSupport(
  new Language(data, parser.configure([GFM, { props: [languageDataProp.add({ Document: data })] }]), [], "markdown"),
);

const highlight = HighlightStyle.define([
  { tag: t.strong, class: "cm-strong" },
  { tag: t.emphasis, class: "cm-em" },
  { tag: t.strikethrough, class: "cm-strike" },
  { tag: t.monospace, class: "cm-mono" },
  { tag: t.url, class: "cm-url" },
  { tag: t.processingInstruction, class: "cm-formatting" },
  { tag: t.contentSeparator, class: "cm-hr" },
]);

/** Dispatch this when link targets may have changed (a note was created, renamed or deleted). */
export const refreshPreview = StateEffect.define<null>();

/** Source mode on or off. On, every symbol shows as typed and nothing is drawn over the text. */
export const setSourceMode = StateEffect.define<boolean>();
const sourceMode = StateField.define<boolean>({
  create: () => false,
  update: (on, tr) => tr.effects.reduce((v, e) => (e.is(setSourceMode) ? e.value : v), on),
});


const HIDE = Decoration.replace({});
const BRACKET = Decoration.mark({ class: "cm-formatting" });
const HL = Decoration.mark({ class: "cm-highlight" });
const CARD_SEP = Decoration.mark({ class: "cm-card-sep" });
const QUOTE_LINE = Decoration.line({ class: "cm-quote-line" });
const CODE_LINE = Decoration.line({ class: "cm-code-line" });
const HEADING_LINE = [1, 2, 3, 4, 5, 6].map((n) => Decoration.line({ class: `cm-heading cm-heading-${n}` }));
const INLINE_MARKS = new Set(["EmphasisMark", "StrikethroughMark", "CodeMark"]);

/** "- [ ]" drawn as a checkbox; clicking it ticks the task in the text. */
class TaskWidget extends WidgetType {
  constructor(readonly checked: boolean) {
    super();
  }
  eq(other: TaskWidget) {
    return other.checked === this.checked;
  }
  toDOM(view: EditorView) {
    const box = document.createElement("span");
    box.className = `cm-task${this.checked ? " is-checked" : ""}`;
    box.setAttribute("role", "checkbox");
    box.setAttribute("aria-checked", String(this.checked));
    box.addEventListener("mousedown", (e) => {
      e.preventDefault();
      const line = view.state.doc.lineAt(view.posAtDOM(box));
      const m = /^\s*[-*+] \[([ xX])\]/.exec(line.text);
      if (!m) return;
      const at = line.from + m[0].length - 2;
      view.dispatch({ changes: { from: at, to: at + 1, insert: m[1] === " " ? "x" : " " }, userEvent: "input" });
    });
    return box;
  }
}
const TASK_OPEN = Decoration.replace({ widget: new TaskWidget(false) });
const TASK_DONE = Decoration.replace({ widget: new TaskWidget(true) });
const TASK_DONE_LINE = Decoration.line({ class: "cm-task-done" });

class BulletWidget extends WidgetType {
  eq() {
    return true;
  }
  toDOM() {
    const dot = document.createElement("span");
    dot.className = "cm-bullet";
    dot.textContent = "•";
    return dot;
  }
}
const BULLET = Decoration.replace({ widget: new BulletWidget() });

class ArrowWidget extends WidgetType {
  constructor(readonly symbol: string) {
    super();
  }
  eq(other: ArrowWidget) {
    return other.symbol === this.symbol;
  }
  toDOM() {
    const arrow = document.createElement("span");
    arrow.className = "cm-card-arrow";
    arrow.textContent = this.symbol;
    return arrow;
  }
}
/** "[!tip]" drawn as the callout's icon, with its title when you didn't write one. */
class CalloutWidget extends WidgetType {
  constructor(readonly title: string) {
    super();
  }
  eq(other: CalloutWidget) {
    return other.title === this.title;
  }
  toDOM() {
    const head = document.createElement("span");
    head.className = "cm-callout-title";
    head.textContent = this.title;
    return head;
  }
}

/** A callout's lines: the first one carries the title, the last one closes the box. */
const calloutLine = (kind: string, part: string) =>
  Decoration.line({ class: `cm-callout-line${part}`, attributes: { "data-callout": kind } });

/** One property's value, as the notes draw it: tags as tag chips, lists as chips, dates in words. */
function valueDOM(key: string, value: PropertyValue): HTMLElement {
  const dd = document.createElement("dd");
  const items = Array.isArray(value) ? value : null;
  if (value === null || value === "" || (items && !items.length)) {
    dd.className = "is-empty";
    return dd;
  }
  if (/^tags?$/i.test(key)) {
    const tags = items ?? String(value).split(/[,\s]+/);
    for (const t of tags) {
      const tag = String(t ?? "").replace(/^#/, "").trim();
      if (!tag) continue;
      const chip = document.createElement("span");
      chip.className = "tag";
      chip.dataset.tint = tintFor(tag);
      chip.textContent = `#${tag}`;
      dd.append(chip);
    }
    return dd;
  }
  if (items) {
    for (const item of items) {
      const chip = document.createElement("span");
      chip.className = "prop-chip";
      chip.textContent = String(item ?? "");
      dd.append(chip);
    }
    return dd;
  }
  dd.textContent = typeof value === "boolean" ? (value ? "Yes" : "No") : typeof value === "string" ? showDate(value) : String(value);
  return dd;
}

/** The properties block, drawn as a small table. Tapping it shows the lines as typed, to edit them. */
class PropertiesWidget extends WidgetType {
  constructor(readonly yaml: string) {
    super();
  }
  eq(other: PropertiesWidget) {
    return other.yaml === this.yaml;
  }
  toDOM(view: EditorView) {
    const box = document.createElement("div");
    box.className = "properties cm-properties";
    box.title = "Tap to edit the properties";
    const title = document.createElement("div");
    title.className = "properties-title";
    title.textContent = "Properties";
    box.append(title);
    const props = parseProperties(this.yaml);
    if (props) {
      const list = document.createElement("dl");
      list.className = "properties-list";
      for (const { key, value } of props) {
        const row = document.createElement("div");
        row.className = "properties-row";
        const dt = document.createElement("dt");
        dt.textContent = key;
        row.append(dt, valueDOM(key, value));
        list.append(row);
      }
      box.append(list);
    } else {
      const raw = document.createElement("pre");
      raw.className = "properties-raw";
      raw.textContent = this.yaml;
      const note = document.createElement("p");
      note.className = "properties-error";
      note.textContent = "Couldn’t read these properties. Tap to fix them.";
      box.append(raw, note);
    }
    box.addEventListener("mousedown", (e) => {
      e.preventDefault();
      view.focus();
      const first = view.state.doc.line(Math.min(2, view.state.doc.lines));
      view.dispatch({ selection: { anchor: first.to } });
    });
    return box;
  }
  ignoreEvent() {
    return true;
  }
}

const FM_LINE = Decoration.line({ class: "cm-fm-line" });
const FM_KEY = Decoration.mark({ class: "cm-fm-key" });

/**
 * The properties block at the top of a note: drawn as a table until the cursor goes in, then shown as typed.
 * Block widgets have to come from a state field, not a view plugin. A note opens with its cursor just below
 * the block (see Editor.tsx), so it starts out as the table.
 */
function propertiesDecorations(state: EditorState): DecorationSet {
  const fm = frontmatterOf(state.doc.toString());
  if (!fm) return Decoration.none;
  const to = state.doc.line(fm.lines).to;
  const inside = state.selection.ranges.some((r) => r.from <= to);
  if (state.field(sourceMode, false) || inside) {
    const out: Range<Decoration>[] = [];
    for (let i = 1; i <= fm.lines; i++) {
      const line = state.doc.line(i);
      out.push(FM_LINE.range(line.from));
      const key = i > 1 && i < fm.lines ? /^([^\s:#-][^:]*):/.exec(line.text) : null;
      if (key) out.push(FM_KEY.range(line.from, line.from + key[1].length));
    }
    return Decoration.set(out, true);
  }
  return Decoration.set([Decoration.replace({ widget: new PropertiesWidget(fm.yaml), block: true }).range(0, to)]);
}

const properties = StateField.define<DecorationSet>({
  create: (state) => propertiesDecorations(state),
  update: (deco, tr) =>
    tr.docChanged || tr.selection || tr.effects.some((e) => e.is(setSourceMode))
      ? propertiesDecorations(tr.state)
      : deco,
  provide: (field) => EditorView.decorations.from(field),
});

const ONE_WAY = Decoration.replace({ widget: new ArrowWidget("→") });
const TWO_WAY = Decoration.replace({ widget: new ArrowWidget("⇄") });
const CARD_BACK = Decoration.mark({ class: "cm-card-back" });

function build(view: EditorView, exists: (target: string) => boolean): DecorationSet {
  const { state } = view;
  const { doc } = state;
  const ranges = view.hasFocus ? state.selection.ranges : [];
  // Syntax shows while the cursor (or selection) touches the element. In source mode it always shows.
  const source = state.field(sourceMode, false) ?? false;
  const touches = source ? () => true : (from: number, to: number) => ranges.some((r) => r.from <= to && r.to >= from);
  const onLine = (pos: number) => {
    const line = doc.lineAt(pos);
    return touches(line.from, line.to);
  };

  const out: Range<Decoration>[] = [];
  const hide = (from: number, to: number) => {
    if (to > from) out.push(HIDE.range(from, to));
  };
  const code: Array<[number, number]> = [];
  const calloutHeads = new Set<number>();
  const inCode = (pos: number) => code.some(([a, b]) => pos >= a && pos < b);

  const vis = view.visibleRanges;
  if (!vis.length) return Decoration.none;
  const from = doc.lineAt(vis[0].from).from;
  const to = doc.lineAt(vis[vis.length - 1].to).to;

  // The properties block has its own drawing (the state field above); Markdown would read it as a heading.
  const fm = frontmatterOf(doc.toString());
  const fmTo = fm ? doc.line(fm.lines).to : -1;

  syntaxTree(state).iterate({
    from,
    to,
    enter(node) {
      const { name } = node;
      if (node.to <= fmTo) return false;
      if (name === "FencedCode" || name === "CodeBlock") {
        code.push([node.from, node.to]);
        for (let pos = node.from; pos <= node.to; ) {
          const line = doc.lineAt(pos);
          out.push(CODE_LINE.range(line.from));
          pos = line.to + 1;
        }
        return false;
      }
      if (name === "InlineCode") code.push([node.from, node.to]);

      const heading = /^(ATX|Setext)Heading(\d)$/.exec(name);
      if (heading) {
        out.push(HEADING_LINE[Number(heading[2]) - 1].range(doc.lineAt(node.from).from));
        const mark = node.node.firstChild;
        if (heading[1] === "ATX" && mark?.name === "HeaderMark" && !onLine(node.from)) {
          hide(mark.from, Math.min(mark.to + 1, node.to));
        }
        return;
      }
      if (name === "Blockquote") {
        // "> [!tip] Title" makes the whole quote a callout box.
        const head = doc.lineAt(node.from);
        const mark = /^\s*>\s?/.exec(head.text);
        const callout = mark && node.node.parent?.name === "Document" ? CALLOUT_RE.exec(head.text.slice(mark[0].length)) : null;
        const last = doc.lineAt(node.to).from;
        for (let pos = node.from; pos <= node.to; ) {
          const line = doc.lineAt(pos);
          if (callout) {
            const part = `${line.from === head.from ? " cm-callout-head" : ""}${line.from === last ? " cm-callout-tail" : ""}`;
            out.push(calloutLine(callout[1].toLowerCase(), part).range(line.from));
          } else out.push(QUOTE_LINE.range(line.from));
          pos = line.to + 1;
        }
        if (callout) calloutHeads.add(head.from);
        if (callout && !onLine(head.from)) {
          // Hide "> [!tip]+ " and show the icon (and the type's name when there's no title).
          const start = head.from + mark![0].length;
          const typed = callout[0].length - callout[3].length;
          out.push(
            Decoration.replace({
              widget: new CalloutWidget(callout[3] ? "" : calloutTitle(callout[1])),
            }).range(head.from, start + typed),
          );
        }
        return;
      }
      if (name === "QuoteMark" && !onLine(node.from) && !calloutHeads.has(doc.lineAt(node.from).from)) {
        hide(node.from, node.to + (doc.sliceString(node.to, node.to + 1) === " " ? 1 : 0));
        return;
      }
      if (name === "ListMark") {
        const item = node.node.parent;
        const task = item?.getChild("Task")?.getChild("TaskMarker");
        if (task) {
          if (!touches(node.from, task.to)) {
            const done = /x/i.test(doc.sliceString(task.from, task.to));
            out.push((done ? TASK_DONE : TASK_OPEN).range(node.from, task.to));
          }
          if (/x/i.test(doc.sliceString(task.from, task.to))) out.push(TASK_DONE_LINE.range(doc.lineAt(node.from).from));
        } else if (item?.parent?.name === "BulletList" && !touches(node.from, node.to)) {
          out.push(BULLET.range(node.from, node.to));
        }
        return;
      }
      if (name === "Emphasis" || name === "StrongEmphasis" || name === "Strikethrough" || name === "InlineCode") {
        if (touches(node.from, node.to)) return;
        for (let c = node.node.firstChild; c; c = c.nextSibling) if (INLINE_MARKS.has(c.name)) hide(c.from, c.to);
        return;
      }
      if (name === "Link") {
        // [text](url): show just the text, as a link.
        const marks: Array<{ from: number; to: number }> = [];
        let url: string | null = null;
        for (let c = node.node.firstChild; c; c = c.nextSibling) {
          if (c.name === "LinkMark") marks.push({ from: c.from, to: c.to });
          // The reading view's rule: javascript: and other unsafe links don't become links.
          if (c.name === "URL") url = defaultUrlTransform(doc.sliceString(c.from, c.to)) || null;
        }
        if (!url || marks.length < 3 || /^\[\[/.test(doc.sliceString(node.from, node.from + 2))) return;
        out.push(
          Decoration.mark({ class: "ed-ext", attributes: { "data-href": url } }).range(marks[0].to, marks[1].from),
        );
        if (!touches(node.from, node.to)) {
          hide(marks[0].from, marks[0].to);
          hide(marks[1].from, node.to);
        }
        return false;
      }
    },
  });

  for (let pos = from; pos <= to; ) {
    const line = doc.lineAt(pos);
    const text = line.text;
    pos = line.to + 1;
    if (!text || line.to <= fmTo) continue;

    for (const m of text.matchAll(WIKI_RE)) {
      const s = line.from + m.index!;
      const e = s + m[0].length;
      if (inCode(s)) continue;
      const inner = m[1];
      const { target, heading, alias } = parseWikiInner(inner);
      if (!target) continue;
      const link = Decoration.mark({
        class: exists(target) ? "ed-link" : "ed-link is-unresolved",
        attributes: { "data-target": heading ? `${target}#${heading}` : target },
      });
      if (touches(s, e)) {
        out.push(BRACKET.range(s, s + 2), link.range(s + 2, e - 2), BRACKET.range(e - 2, e));
        continue;
      }
      const pipe = inner.indexOf("|");
      const textFrom = alias ? s + 2 + pipe + 1 : s + 2;
      hide(s, textFrom);
      out.push(link.range(textFrom, e - 2));
      hide(e - 2, e);
    }

    for (const m of text.matchAll(/==([^=\n]+)==/g)) {
      const s = line.from + m.index!;
      const e = s + m[0].length;
      if (inCode(s)) continue;
      if (touches(s, e)) out.push(BRACKET.range(s, s + 2), HL.range(s + 2, e - 2), BRACKET.range(e - 2, e));
      else {
        hide(s, s + 2);
        out.push(HL.range(s + 2, e - 2));
        hide(e - 2, e);
      }
    }

    for (const m of text.matchAll(TAG_RE)) {
      if (/^\d+$/.test(m[2])) continue;
      const s = line.from + m.index! + m[1].length;
      if (inCode(s)) continue;
      const tag = m[2].replace(/\/+$/, "");
      out.push(
        Decoration.mark({ class: "cm-tag", attributes: { "data-tint": tintFor(tag) } }).range(s, s + 1 + tag.length),
      );
    }

    // Flashcard separators: "front :: back" reads as "front → back" (":::" as ⇄) until the cursor is
    // on the line; the "?" / "??" lines of multi-line cards stay visible.
    for (const m of text.matchAll(/\s(:{2,3})(\s|$)/g)) {
      const s = line.from + m.index!;
      const e = s + m[0].length;
      if (inCode(s)) continue;
      if (onLine(line.from)) {
        out.push(CARD_SEP.range(s + 1, s + 1 + m[1].length));
      } else {
        out.push((m[1].length === 3 ? TWO_WAY : ONE_WAY).range(s, e));
        if (e < line.to) out.push(CARD_BACK.range(e, line.to));
      }
    }
    if (/^\?{1,2}$/.test(text.trim()) && !inCode(line.from)) {
      const s = line.from + text.indexOf("?");
      out.push(CARD_SEP.range(s, s + text.trim().length));
    }
  }

  return Decoration.set(out, true);
}

/** Markdown highlighting plus the hide-syntax-until-touched decorations (none of them in source mode). */
export function livePreview(exists: (target: string) => boolean, source = false): Extension {
  const plugin = ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      constructor(view: EditorView) {
        this.decorations = build(view, exists);
      }
      update(u: ViewUpdate) {
        if (
          u.docChanged ||
          u.selectionSet ||
          u.viewportChanged ||
          u.focusChanged ||
          syntaxTree(u.startState) !== syntaxTree(u.state) ||
          u.transactions.some((tr) => tr.effects.some((e) => e.is(refreshPreview) || e.is(setSourceMode)))
        )
          this.decorations = build(u.view, exists);
      }
    },
    { decorations: (v) => v.decorations },
  );
  return [markdown, syntaxHighlighting(highlight), sourceMode.init(() => source), properties, plugin];
}
