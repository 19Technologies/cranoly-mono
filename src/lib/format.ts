// Format: hand a note to Claude, ChatGPT or Gemini with a ready prompt, then paste the answer back.
// Cranoly Mono runs no AI itself. The note leaves the device only when the learner taps the button,
// and only to the assistant they picked.
import { CALLOUTS } from "./callouts";
import { frontmatterOf } from "./properties";
import type { Assistant } from "./vault";

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

export const ASSISTANTS: Array<{ id: Assistant; name: string; home: string; link?: (prompt: string) => string }> = [
  { id: "claude", name: "Claude", home: "https://claude.ai/new", link: (p) => `https://claude.ai/new?q=${encodeURIComponent(p)}` },
  { id: "chatgpt", name: "ChatGPT", home: "https://chatgpt.com/", link: (p) => `https://chatgpt.com/?q=${encodeURIComponent(p)}` },
  // Gemini has no link that fills in a prompt, so it goes by clipboard only.
  { id: "gemini", name: "Gemini", home: "https://gemini.google.com/app" },
];

/** Longer links get cut off by some browsers and assistants; then the prompt goes by clipboard only. */
export const MAX_LINK = 6000;

export const assistantOf = (id: string | undefined) => ASSISTANTS.find((a) => a.id === id) ?? ASSISTANTS[0];

/** Where to send the learner: the assistant with the prompt filled in when the link isn't too long, else its home page. */
export function openUrl(assistant: (typeof ASSISTANTS)[number], prompt: string) {
  const link = assistant.link?.(prompt);
  return link && link.length <= MAX_LINK ? { url: link, filled: true } : { url: assistant.home, filled: false };
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

/** The same request, split for the built-in AI: what to do (the system prompt) and the note itself. */
export function formatParts(note: { title: string; content: string }, tasks: FormatTask[], lang: PromptLang) {
  const all = buildPrompt(note, tasks, lang);
  const at = all.lastIndexOf(`The note is called "${note.title}":`);
  return { system: all.slice(0, at).trim(), user: all.slice(at).trim() };
}

/** The pasted answer, without the code fence or chatty lines assistants like to add. */
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
