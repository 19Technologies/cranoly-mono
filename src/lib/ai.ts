// Built-in AI for Cranoly Mono: Claude, called straight from this device with your own Anthropic API key.
// The key stays on this device. It isn't part of the notes, so it's never in a backup, a shared copy or
// the Cranoly Mono folder. A note goes to Anthropic only when you tap Format.
import Anthropic from "@anthropic-ai/sdk";
import { useSyncExternalStore } from "react";

export const MODEL = "claude-opus-5-5";
export const MODEL_NAME = "Claude Opus 5.5";
const KEY = "cranoly-ai-key";
const listeners = new Set<() => void>();

export function aiKey(): string | null {
  try {
    return localStorage.getItem(KEY) || null;
  } catch {
    return null;
  }
}

export function setAiKey(key: string | null) {
  try {
    if (key) localStorage.setItem(KEY, key.trim());
    else localStorage.removeItem(KEY);
  } catch {
    /* storage blocked: the key just isn't kept */
  }
  listeners.forEach((l) => l());
}

/** The saved key, kept up to date for Settings and the Format sheet. */
export function useAiKey() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    aiKey,
    () => null,
  );
}

/** Anthropic API keys start with sk-ant-. */
export const looksLikeKey = (k: string) => /^sk-ant-[\w-]{20,}$/.test(k.trim());

/** "sk-ant-…a1B2": enough to recognise the key without showing it. */
export const maskKey = (k: string) => `sk-ant-…${k.slice(-4)}`;

/** Something that stopped the AI, said plainly. `stopped` is true when you stopped it yourself. */
export class AiProblem extends Error {
  constructor(
    message: string,
    readonly stopped = false,
  ) {
    super(message);
  }
}

function problemOf(e: unknown): AiProblem {
  if (e instanceof AiProblem) return e;
  if (e instanceof Anthropic.APIUserAbortError) return new AiProblem("Stopped.", true);
  if (e instanceof Anthropic.AuthenticationError) return new AiProblem("That API key doesn’t work. Check it in Settings › AI.");
  if (e instanceof Anthropic.PermissionDeniedError) return new AiProblem(`That API key can’t use ${MODEL_NAME}. Check its workspace in the Anthropic console.`);
  if (e instanceof Anthropic.RateLimitError) return new AiProblem("Too many requests right now. Try again in a minute.");
  if (e instanceof Anthropic.APIConnectionError) return new AiProblem("No connection to Anthropic. Check your internet and try again.");
  if (e instanceof Anthropic.BadRequestError) {
    const kind = (e.error as { error?: { type?: string } } | undefined)?.error?.type;
    if (kind === "billing_error") return new AiProblem("Your Anthropic account is out of credit. Add some at console.anthropic.com.");
    return new AiProblem("Anthropic couldn’t take this request. Try again, or with a shorter note.");
  }
  if (e instanceof Anthropic.APIError) return new AiProblem("Anthropic is busy right now. Try again shortly.");
  return new AiProblem("Something went wrong. Try again.");
}

/**
 * Ask Claude, streaming: `onText` gets the reply so far as it's written, and `signal` stops it early.
 * Low effort keeps it quick on a phone. If a safety check declines the request, Anthropic retries it on
 * another model by itself (fallbacks).
 */
export async function askClaude(system: string, user: string, onText: (sofar: string) => void, signal?: AbortSignal) {
  const key = aiKey();
  if (!key) throw new AiProblem("Add your Anthropic API key first.");
  // The key is yours and stays on your device, so calling Anthropic from the app itself is fine here.
  const client = new Anthropic({ apiKey: key, dangerouslyAllowBrowser: true, maxRetries: 1 });
  try {
    const stream = client.beta.messages.stream(
      {
        model: MODEL,
        max_tokens: 64000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: { effort: "low" },
        system,
        messages: [{ role: "user", content: user }],
      },
      { signal },
    );
    let sofar = "";
    stream.on("text", (delta) => onText((sofar += delta)));
    const message = await stream.finalMessage();
    if (message.stop_reason === "refusal") throw new AiProblem("Claude declined to do this with this note.");
    if (message.stop_reason === "max_tokens") throw new AiProblem("The note was too long to finish. Try a shorter one.");
    return message.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
  } catch (e) {
    throw problemOf(e);
  }
}
