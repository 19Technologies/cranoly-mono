// The device's own text-to-speech voices: used when a language's natural voice (see voices.ts) isn't
// downloaded, and for the first tap while that voice is still starting. In the Android app this is the
// phone's text-to-speech (its browser view has no speech of its own); on the website it's the browser's.
import { plainLine } from "./links";
import { isApp } from "./native";

/** Markdown → the words to say. */
export const speakable = (text: string) => plainLine(text.replace(/==/g, "")).replace(/\s+/g, " ").trim();

const phoneVoice = () => import("@capacitor-community/text-to-speech").then((m) => m.TextToSpeech);

/** The languages the phone can speak ("de-de", …), once asked. Until then, assume it can. */
let phoneLanguages: string[] | null = null;
let asked = false;

/** Ask the phone which languages it can speak (once, at start), so a tap knows straight away. */
export function prepareDeviceVoice() {
  if (asked || !isApp()) return;
  asked = true;
  phoneVoice()
    .then((tts) => tts.getSupportedLanguages())
    .then(({ languages }) => (phoneLanguages = languages.map((l) => l.toLowerCase().replace("_", "-"))))
    .catch(() => {});
}

const phoneCan = (tag: string) => {
  if (!phoneLanguages) return true;
  const t = tag.toLowerCase();
  return phoneLanguages.some((l) => l === t || l.slice(0, 2) === t.slice(0, 2));
};

const canSpeak = () => isApp() || (typeof window !== "undefined" && "speechSynthesis" in window);

function voiceFor(tag: string) {
  const voices = speechSynthesis.getVoices();
  const lang = tag.slice(0, 2).toLowerCase();
  const exact = voices.filter((v) => v.lang.replace("_", "-").toLowerCase() === tag.toLowerCase());
  const close = voices.filter((v) => v.lang.slice(0, 2).toLowerCase() === lang);
  const pick = (list: SpeechSynthesisVoice[]) => list.find((v) => v.localService) ?? list[0];
  return { voice: pick(exact) ?? pick(close), known: voices.length > 0 };
}

/** Speak text in a language. Returns false when the device has no voice for it. */
export function speak(text: string, tag: string) {
  const clean = speakable(text);
  if (!clean) return true;
  if (isApp()) {
    if (!phoneCan(tag)) return false;
    phoneVoice()
      .then((tts) => tts.speak({ text: clean, lang: tag, rate: 0.92 }))
      .catch(() => {});
    return true;
  }
  if (!canSpeak()) return false;
  const { voice, known } = voiceFor(tag);
  if (known && !voice) return false;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(clean);
  u.lang = voice?.lang ?? tag;
  if (voice) u.voice = voice;
  u.rate = 0.92;
  speechSynthesis.speak(u);
  return true;
}
