// Writing issues in the editor: wavy underlines, and a small card with the fix when the
// cursor is on one. Editing the underlined text clears its issue.
import { StateEffect, StateField, type EditorState } from "@codemirror/state";
import { Decoration, EditorView, showTooltip, type Tooltip } from "@codemirror/view";
import type { Issue } from "./grammar";

export const setIssues = StateEffect.define<Issue[]>();
const dropIssue = StateEffect.define<{ from: number; to: number }>();

const UNDERLINE = Decoration.mark({ class: "cm-issue" });
const tips = new WeakMap<Issue, Tooltip>();

/** The sentence around [from, to) on its line, e.g. for turning a mistake into a flashcard. */
function sentenceAround(state: EditorState, from: number, to: number) {
  const line = state.doc.lineAt(from);
  const text = line.text;
  const a = from - line.from;
  const b = to - line.from;
  const start = Math.max(0, ...[".", "!", "?"].map((p) => text.lastIndexOf(p, a - 1) + 1));
  const ends = [".", "!", "?"].map((p) => text.indexOf(p, b)).filter((i) => i !== -1);
  const end = ends.length ? Math.min(...ends) + 1 : text.length;
  const prefix = /^\s*(?:#{1,6}\s+|(?:>\s?)+|(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s+)?)*/.exec(text.slice(start))![0].length;
  return { from: line.from + start + prefix, to: line.from + end };
}

function button(label: string, onClick: () => void, className = "") {
  const b = document.createElement("button");
  b.type = "button";
  b.className = className;
  b.textContent = label;
  b.addEventListener("mousedown", (e) => e.preventDefault()); // keep the caret in the editor
  b.addEventListener("click", onClick);
  return b;
}

function tooltipFor(issue: Issue): Tooltip {
  let tip = tips.get(issue);
  if (tip) return tip;
  tip = {
    pos: issue.from,
    above: false,
    create(view) {
      const dom = document.createElement("div");
      dom.className = "cm-issue-tip";
      const label = document.createElement("b");
      label.className = "issue-label";
      label.textContent = issue.label;
      const message = document.createElement("p");
      message.className = "issue-message";
      message.textContent = issue.message;
      dom.append(label, message);

      const fix = (value: string) =>
        view.dispatch({
          changes: { from: issue.from, to: issue.to, insert: value },
          selection: { anchor: issue.from + value.length },
          userEvent: "input.complete",
        });
      if (issue.replacements.length) {
        const fixes = document.createElement("div");
        fixes.className = "issue-fixes";
        for (const r of issue.replacements) fixes.append(button(r || "(remove)", () => fix(r), "issue-fix"));
        dom.append(fixes);
      }
      const actions = document.createElement("div");
      actions.className = "issue-actions";
      if (issue.replacements.length) {
        actions.append(
          button("Fix & save as card", () => {
            const s = sentenceAround(view.state, issue.from, issue.to);
            const wrong = view.state.sliceDoc(s.from, s.to).trim();
            const right = (view.state.sliceDoc(s.from, issue.from) + issue.replacements[0] + view.state.sliceDoc(issue.to, s.to)).trim();
            const doc = view.state.doc;
            const glue = doc.length && doc.sliceString(doc.length - 1) !== "\n" ? "\n" : "";
            view.dispatch({
              changes: [
                { from: issue.from, to: issue.to, insert: issue.replacements[0] },
                { from: doc.length, insert: `${glue}${wrong} :: ${right}\n` },
              ],
              userEvent: "input.complete",
            });
          }),
        );
      }
      actions.append(button("Ignore", () => view.dispatch({ effects: dropIssue.of(issue) }), "is-quiet"));
      dom.append(actions);
      return { dom };
    },
  };
  tips.set(issue, tip);
  return tip;
}

export const writingIssues = StateField.define<Issue[]>({
  create: () => [],
  update(issues, tr) {
    let next = issues;
    if (tr.docChanged && next.length) {
      next = next.flatMap((i) => {
        let touched = false;
        tr.changes.iterChangedRanges((fromA, toA) => {
          if (fromA <= i.to && toA >= i.from) touched = true;
        });
        if (touched) return [];
        const from = tr.changes.mapPos(i.from, 1);
        const to = tr.changes.mapPos(i.to, -1);
        return from === i.from && to === i.to ? [i] : [{ ...i, from, to }];
      });
    }
    for (const e of tr.effects) {
      if (e.is(setIssues)) next = e.value.filter((i) => i.to > i.from && i.to <= tr.state.doc.length);
      if (e.is(dropIssue)) next = next.filter((i) => i.from !== e.value.from || i.to !== e.value.to);
    }
    return next;
  },
  provide: (f) => [
    EditorView.decorations.from(f, (issues) => Decoration.set(issues.map((i) => UNDERLINE.range(i.from, i.to)), true)),
    showTooltip.compute([f, "selection"], (state) => {
      const sel = state.selection.main;
      if (!sel.empty) return null;
      const hit = state.field(f).find((i) => sel.head >= i.from && sel.head <= i.to);
      return hit ? tooltipFor(hit) : null;
    }),
  ],
});

