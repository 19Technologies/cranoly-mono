// Format: hand a note to Claude, signed in as the learner (the Claude app or claude.ai), with the request
// typed in; then paste Claude's reply back. Cranoly Mono runs no AI and keeps no key: Anthropic doesn't let
// other apps sign people in to Claude, so the note goes to Claude itself, and only when the learner taps.
import { CALLOUTS } from "./callouts";
import { frontmatterOf } from "./properties";

export type FormatTask = "tidy" | "arrange" | "summary" | "translate" | "cards";

/** The learner's languages, plus one of their words and its meaning to show the assistant what we mean. */
export interface PromptLang {
  learning: string;
  native: string;
  word: string;
  meaning: string;
}

export const TASKS: Array<{ id: FormatTask; label: string; ask: (lang: PromptLang) => string }> = [
  {
    id: "tidy",
    label: "Tidy up",
    ask: () =>
      "Tidy it up: add clear headings, turn runs of items into lists, and put tips, warnings and examples in callouts. Keep my wording.",
  },
  {
    id: "arrange",
    label: "Arrange by topic",
    ask: () => "Arrange it by topic, so related parts sit together under headings.",
  },
  {
    id: "summary",
    label: "Add a short summary",
    ask: ({ native }) => `Add a summary of two or three sentences at the top, written in ${native}.`,
  },
  {
    id: "translate",
    label: "Link and translate words",
    ask: ({ native, word, meaning }) =>
      `Link and translate the words worth learning. The first time each one appears, make it a [[link]] to its dictionary form, with its meaning in ${native} in brackets right after it, like "[[${word}]] (${meaning})". When the text uses another form of the word, link the dictionary form and keep the text's form showing, like "[[dictionary form|form in the text]]". Then, at the end under a heading "Words", list each linked word once as "- [[word]] :: meaning". Those lines become flashcards.`,
  },
  {
    id: "cards",
    label: "Make flashcards",
    ask: ({ native }) =>
      `At the end, under a heading "Cards", add one line for each word or phrase worth learning, written as "word :: meaning" with the meaning in ${native}.`,
  },
];

const CLAUDE = "https://claude.ai/new";

/** Longer links get cut off by some browsers and apps; then the request goes by clipboard only. */
const MAX_LINK = 6000;

/** Claude with the request typed in, when it fits in a link; otherwise a new chat to paste it into. */
export function claudeLink(prompt: string) {
  const url = `${CLAUDE}?q=${encodeURIComponent(prompt)}`;
  return url.length <= MAX_LINK ? { url, filled: true } : { url: CLAUDE, filled: false };
}

export function buildPrompt(
  note: { title: string; content: string },
  tasks: FormatTask[],
  lang: PromptLang,
) {
  // The Words list already makes a card of every linked word, so a second Cards list would repeat them.
  const chosen = tasks.includes("translate") ? tasks.filter((t) => t !== "cards") : tasks;
  const asks = TASKS.filter((t) => chosen.includes(t.id)).map((t) => `- ${t.ask(lang)}`);
  return [
    `Please format this note from my language notebook. I'm learning ${lang.learning}, and my own language is ${lang.native}.`,
    "",
    "What to do:",
    ...asks,
    "",
    "Rules:",
    "- Keep every language exactly as I wrote it. Don't translate or correct anything unless a task above asks for it.",
    '- Keep these exactly as they are: flashcard lines with "::" or ":::", lines that are only "?" or "??", ==highlights==, [[links]], #tags and callouts.',
    "- Use only this Markdown: # headings, **bold**, *italic*, ~~strikethrough~~, - lists, 1. numbered lists, - [ ] checklists, > quotes, > [!type] callouts, --- lines and `code`.",
    `- A callout is a quote whose first line is "> [!type]" or "> [!type] Title", with every line after it starting with ">". The types are ${CALLOUTS.map((c) => c.type).join(", ")}. Put - after the type ("> [!question]-") to fold it shut, or + to fold it open.`,
    ...(frontmatterOf(note.content) ? ["- Keep the properties block between the --- lines at the top exactly as it is."] : []),
    "- Don't use em dashes or en dashes. Use a colon, a comma or a new sentence instead.",
    "- Reply with only the formatted note, in Markdown. No introduction, no explanation, no code block around it.",
    "",
    `The note is called "${note.title}":`,
    "",
    note.content.trim(),
  ].join("\n");
}

/** The pasted reply, without the code fence or chatty lines Claude sometimes adds. */
export function cleanResult(text: string) {
  let t = text.replace(/\r\n?/g, "\n").trim();
  // "Here is your formatted note:" and friends, on a line of their own at the top.
  t = t.replace(/^(?:sure|certainly|of course|here(?:'s| is| are))\b[^\n]*:[ \t]*\n+/i, "");
  // "Let me know if…" at the bottom.
  t = t.replace(/\n+(?:let me know|i hope|feel free|hope this)[^\n]*$/i, "");
  // The whole note wrapped in a code block (```markdown … ```).
  t = /^```[\w-]*\n([\s\S]*?)\n?```$/.exec(t.trim())?.[1] ?? t;
  return `${t.trim()}\n`;
}
