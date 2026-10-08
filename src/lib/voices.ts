// In-app voices: natural text-to-speech with Piper (MIT, by Rhasspy) running on the device with
// ONNX Runtime. A language's voice is downloaded once, together with a shared engine, into the
// app's own storage, so "Hear it" sounds the same on every phone, needs no system settings and
// works offline. Nothing is bundled with the app: it all comes from public CDNs on first download.
import { useEffect, useSyncExternalStore } from "react";
import { LANGUAGES, languageOf, type Language } from "./languages";
import { speakable } from "./speech";

const ORT = "https://cdnjs.cloudflare.com/ajax/libs/onnxruntime-web/1.18.0/";
const PIPER = "https://cdn.jsdelivr.net/npm/@diffusionstudio/piper-wasm@1.0.0/build/piper_phonemize";
const VOICES = "https://huggingface.co/diffusionstudio/piper-voices/resolve/main/";
const CACHE = "cranoly-voices-v1";

/** The engine every voice shares (downloaded with the first voice). */
const ENGINE = [
  { url: ORT + "ort.wasm.min.js", bytes: 142_930, type: "text/javascript" },
  { url: ORT + "ort-wasm-simd.wasm", bytes: 10_595_041, type: "application/wasm" },
  { url: PIPER + ".js", bytes: 120_714, type: "text/javascript" },
  { url: PIPER + ".wasm", bytes: 635_212, type: "application/wasm" },
  { url: PIPER + ".data", bytes: 18_077_249, type: "application/octet-stream" },
];
export const ENGINE_MB = 29;

const modelUrl = (lang: Language) => VOICES + encodeURI(lang.model!.path) + ".onnx";
const configUrl = (lang: Language) => modelUrl(lang) + ".json";

/* ------------------------------------------------------------------ */
/* State the settings and onboarding screens show                      */
/* ------------------------------------------------------------------ */

export interface VoiceState {
  status: "none" | "waiting" | "downloading" | "ready" | "error";
  /** 0 to 1 while downloading. */
  progress: number;
  error?: string;
}

let states: Record<string, VoiceState> = {};
const listeners = new Set<() => void>();
const EMPTY: Record<string, VoiceState> = {};

function setState(code: string, next: VoiceState) {
  states = { ...states, [code]: next };
  listeners.forEach((l) => l());
}

let checked = false;
/** Find the voices already on this device (once per app start). */
async function refresh() {
  if (checked || typeof caches === "undefined") return;
  checked = true;
  try {
    const cache = await caches.open(CACHE);
    for (const lang of LANGUAGES) {
      if (!lang.model || states[lang.code]) continue;
      const [model, config] = await Promise.all([cache.match(modelUrl(lang)), cache.match(configUrl(lang))]);
      if (model && config) setState(lang.code, { status: "ready", progress: 1 });
    }
  } catch {
    /* storage unavailable: voices just show as not downloaded */
  }
}

// Look as soon as the app starts, so the first "Hear it" already knows which voices are here.
if (typeof window !== "undefined") void refresh();

export function useVoices() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      void refresh();
      return () => listeners.delete(l);
    },
    () => states,
    () => EMPTY,
  );
}

export const voiceStatus = (code: string): VoiceState["status"] => states[code]?.status ?? "none";
export const voiceReady = (code: string) => voiceStatus(code) === "ready";

/* ------------------------------------------------------------------ */
/* Downloads                                                           */
/* ------------------------------------------------------------------ */

async function fetchInto(cache: Cache, url: string, type: string, onBytes: (n: number) => void) {
  if (await cache.match(url)) return;
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`download failed (${res.status})`);
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    size += value.length;
    onBytes(value.length);
  }
  // Kept in memory rather than as a Blob: large blobs can fail when the disk is nearly full.
  const data = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) {
    data.set(c, at);
    at += c.length;
  }
  await cache.put(url, new Response(data, { headers: { "Content-Type": type } }));
}

// One download at a time: gentler on slow connections, and the engine is only fetched once.
let queue: Promise<unknown> = Promise.resolve();
const pending = new Map<string, Promise<void>>();

async function run(lang: Language) {
  const cache = await caches.open(CACHE);
  const missing = [];
  for (const f of ENGINE) if (!(await cache.match(f.url))) missing.push(f);
  const total = missing.reduce((n, f) => n + f.bytes, 0) + lang.model!.mb * 1_000_000;
  let done = 0;
  let last = 0;
  const tick = (n: number) => {
    done += n;
    const now = performance.now();
    if (now - last < 120) return;
    last = now;
    setState(lang.code, { status: "downloading", progress: Math.min(0.99, done / total) });
  };
  setState(lang.code, { status: "downloading", progress: 0 });
  for (const f of missing) await fetchInto(cache, f.url, f.type, tick);
  await fetchInto(cache, configUrl(lang), "application/json", tick);
  await fetchInto(cache, modelUrl(lang), "application/octet-stream", tick);
  setState(lang.code, { status: "ready", progress: 1 });
}

/** Download a language's voice (and the engine, the first time). Safe to call repeatedly. */
export function downloadVoice(code: string) {
  const lang = languageOf(code);
  if (!lang.model) return Promise.reject(new Error("no voice"));
  if (voiceReady(code)) return Promise.resolve();
  const running = pending.get(code);
  if (running) return running;
  // Ask the browser not to clear the app's storage when space runs low (protects notes too).
  void navigator.storage?.persist?.().catch(() => false);
  setState(code, { status: "waiting", progress: 0 });
  const job = queue.then(() => run(lang));
  queue = job.catch(() => {});
  const tracked = job.catch((e: unknown) => {
    const full = e instanceof DOMException && e.name === "QuotaExceededError";
    setState(code, {
      status: "error",
      progress: 0,
      error: full ? "Not enough space on this device." : "Couldn’t download. Check your connection and try again.",
    });
    throw e;
  });
  tracked.catch(() => {}).finally(() => pending.delete(code));
  pending.set(code, tracked);
  return tracked;
}

export async function removeVoice(code: string) {
  const lang = languageOf(code);
  if (!lang.model) return;
  if (warmCode === code) stopWorker();
  if (loaded?.code === code) {
    loaded.session.release?.();
    loaded = null;
  }
  const cache = await caches.open(CACHE);
  await Promise.all([cache.delete(modelUrl(lang)), cache.delete(configUrl(lang))]);
  await forgetClips(code);
  setState(code, { status: "none", progress: 0 });
  // The last voice takes the shared engine with it.
  if (!LANGUAGES.some((l) => l.model && states[l.code]?.status === "ready")) {
    await Promise.all(ENGINE.map((f) => cache.delete(f.url)));
  }
}

/* ------------------------------------------------------------------ */
/* Speaking                                                            */
/* ------------------------------------------------------------------ */
// Quick on every tap:
// - the engine runs in a background worker, so making a clip never freezes the screen;
// - it starts when a screen with speaker buttons opens, not on the first tap;
// - every clip is kept on the device, so a word heard (or prepared) before plays at once;
// - the words on screen are prepared ahead, and a speaker starts its clip on touch-down.

interface Clip {
  pcm: Float32Array;
  rate: number;
}

/* eslint-disable @typescript-eslint/no-explicit-any -- the engine is loaded at runtime from a CDN */

// The worker: loads the engine from the voices cache, keeps one voice in memory, and turns text into sound.
const WORKER = `
const CACHE = ${JSON.stringify(CACHE)};
let engine = null;
let voice = null;
async function blobUrl(cache, f) {
  const hit = await cache.match(f.url);
  if (!hit) throw new Error("engine missing");
  return URL.createObjectURL(new Blob([await hit.arrayBuffer()], { type: f.type }));
}
function loadEngine(files, plainWasm) {
  engine = engine || (async () => {
    const cache = await caches.open(CACHE);
    const [ortJs, ortWasm, piperJs, piperWasm, piperData] = await Promise.all(files.map((f) => blobUrl(cache, f)));
    importScripts(ortJs);
    importScripts(piperJs);
    self.ort.env.wasm.numThreads = 1;
    self.ort.env.wasm.wasmPaths = { "ort-wasm-simd.wasm": ortWasm, "ort-wasm.wasm": plainWasm };
    let answer = null;
    const mod = await self.createPiperPhonemize({
      print: (line) => answer && answer(JSON.parse(line).phoneme_ids),
      printErr: () => {},
      locateFile: (file) => (file.endsWith(".wasm") ? piperWasm : file.endsWith(".data") ? piperData : file),
    });
    const toIds = (text, lang) => new Promise((resolve) => {
      answer = resolve;
      mod.callMain(["-l", lang, "--input", JSON.stringify([{ text }]), "--espeak_data", "/espeak-ng-data"]);
    });
    return { ort: self.ort, toIds };
  })();
  engine.catch(() => (engine = null));
  return engine;
}
async function loadVoice(e, job) {
  if (voice && voice.code === job.code) return voice;
  if (voice && voice.session.release) voice.session.release();
  voice = null;
  const cache = await caches.open(CACHE);
  const [configRes, modelRes] = await Promise.all([cache.match(job.config), cache.match(job.model)]);
  if (!configRes || !modelRes) throw new Error("voice missing");
  const config = await configRes.json();
  const session = await e.ort.InferenceSession.create(await modelRes.arrayBuffer(), { executionProviders: ["wasm"] });
  voice = { code: job.code, session, config };
  return voice;
}
async function run(job) {
  const e = await loadEngine(job.files, job.plainWasm);
  const v = await loadVoice(e, job);
  if (job.type === "warm") return { ok: true };
  const ids = await e.toIds(job.text, v.config.espeak.voice);
  const { noise_scale, length_scale, noise_w } = v.config.inference;
  const feeds = {
    input: new e.ort.Tensor("int64", ids, [1, ids.length]),
    input_lengths: new e.ort.Tensor("int64", [ids.length]),
    scales: new e.ort.Tensor("float32", [noise_scale, length_scale, noise_w]),
  };
  if (Object.keys(v.config.speaker_id_map || {}).length) feeds.sid = new e.ort.Tensor("int64", [0]);
  const out = await v.session.run(feeds);
  return { ok: true, pcm: new Float32Array(out.output.data), rate: v.config.audio.sample_rate };
}
// One job at a time: the phonemizer and the voice are shared.
let chain = Promise.resolve();
self.onmessage = ({ data }) => {
  chain = chain.then(async () => {
    try {
      const result = await run(data);
      postMessage({ id: data.id, ...result }, result.pcm ? [result.pcm.buffer] : []);
    } catch (err) {
      postMessage({ id: data.id, ok: false, error: String((err && err.message) || err) });
    }
  });
};
`;

let worker: Worker | null = null;
let workerBroken = false;
/** The language whose voice is loaded in the worker (ready to speak). */
let warmCode: string | null = null;
let idle: ReturnType<typeof setTimeout> | undefined;
const replies = new Map<number, { resolve: (v: any) => void; reject: (e: Error) => void }>();
let nextId = 1;

function stopWorker() {
  worker?.terminate();
  worker = null;
  warmCode = null;
  replies.forEach((r) => r.reject(new Error("stopped")));
  replies.clear();
}

/** Free the memory (an engine and a voice are large) after a few minutes without speaking. */
function stillNeeded() {
  clearTimeout(idle);
  idle = setTimeout(stopWorker, 5 * 60_000);
}

function getWorker() {
  if (worker || workerBroken || typeof Worker === "undefined") return worker;
  try {
    worker = new Worker(URL.createObjectURL(new Blob([WORKER], { type: "text/javascript" })));
  } catch {
    workerBroken = true;
    return null;
  }
  worker.onmessage = ({ data }) => {
    const reply = replies.get(data.id);
    replies.delete(data.id);
    if (!reply) return;
    if (data.ok) reply.resolve(data);
    else reply.reject(new Error(data.error));
  };
  worker.onerror = () => {
    // The engine couldn't run in a worker on this device: make clips on the page instead.
    workerBroken = true;
    stopWorker();
  };
  return worker;
}

function inWorker(type: "warm" | "say", lang: Language, text = "") {
  const w = getWorker();
  if (!w) return Promise.reject(new Error("no worker"));
  stillNeeded();
  const id = nextId++;
  return new Promise<any>((resolve, reject) => {
    replies.set(id, { resolve, reject });
    w.postMessage({
      id,
      type,
      text,
      code: lang.code,
      model: modelUrl(lang),
      config: configUrl(lang),
      files: ENGINE,
      plainWasm: ORT + "ort-wasm.wasm",
    });
  }).then((data) => {
    warmCode = lang.code;
    return data;
  });
}

/* The same engine on the page itself, for devices where the worker can't run. */
interface Engine {
  ort: any;
  createPhonemize: (options: object) => Promise<any>;
  piperWasm: string;
  piperData: string;
}

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("engine"));
    document.head.appendChild(s);
  });
}

let engine: Promise<Engine> | null = null;
function loadEngine() {
  engine ??= (async () => {
    const cache = await caches.open(CACHE);
    const urls = await Promise.all(
      ENGINE.map(async (f) => {
        const hit = await cache.match(f.url);
        if (!hit) throw new Error("engine missing");
        return URL.createObjectURL(new Blob([await hit.arrayBuffer()], { type: f.type }));
      }),
    );
    const [ortJs, ortWasm, piperJs, piperWasm, piperData] = urls;
    await loadScript(ortJs);
    await loadScript(piperJs);
    const w = window as any;
    w.ort.env.wasm.numThreads = 1;
    w.ort.env.wasm.wasmPaths = { "ort-wasm-simd.wasm": ortWasm, "ort-wasm.wasm": ORT + "ort-wasm.wasm" };
    return { ort: w.ort, createPhonemize: w.createPiperPhonemize, piperWasm, piperData };
  })();
  engine.catch(() => (engine = null));
  return engine;
}

/** Text → phoneme ids, using one espeak-ng instance for every call. */
let phonemizer: Promise<(text: string, voice: string) => Promise<number[]>> | null = null;
function getPhonemizer(e: Engine) {
  phonemizer ??= (async () => {
    let answer: ((ids: number[]) => void) | null = null;
    const mod = await e.createPhonemize({
      print: (line: string) => answer?.(JSON.parse(line).phoneme_ids),
      printErr: () => {},
      locateFile: (file: string) => (file.endsWith(".wasm") ? e.piperWasm : file.endsWith(".data") ? e.piperData : file),
    });
    return (text: string, voice: string) =>
      new Promise<number[]>((resolve) => {
        answer = resolve;
        mod.callMain(["-l", voice, "--input", JSON.stringify([{ text }]), "--espeak_data", "/espeak-ng-data"]);
      });
  })();
  phonemizer.catch(() => (phonemizer = null));
  return phonemizer;
}

/** Only one voice is kept in memory at a time (each is a large model). */
let loaded: { code: string; session: any; config: any } | null = null;
async function sessionFor(lang: Language, e: Engine) {
  if (loaded?.code === lang.code) return loaded;
  loaded?.session.release?.();
  loaded = null;
  const cache = await caches.open(CACHE);
  const [configRes, modelRes] = await Promise.all([cache.match(configUrl(lang)), cache.match(modelUrl(lang))]);
  if (!configRes || !modelRes) throw new Error("voice missing");
  const config = await configRes.json();
  const session = await e.ort.InferenceSession.create(await modelRes.arrayBuffer(), { executionProviders: ["wasm"] });
  loaded = { code: lang.code, session, config };
  return loaded;
}

async function synthesizeHere(text: string, lang: Language): Promise<Clip> {
  const e = await loadEngine();
  const toIds = await getPhonemizer(e);
  const { session, config } = await sessionFor(lang, e);
  const ids = await toIds(text, config.espeak.voice);
  const { noise_scale, length_scale, noise_w } = config.inference;
  const feeds: Record<string, unknown> = {
    input: new e.ort.Tensor("int64", ids, [1, ids.length]),
    input_lengths: new e.ort.Tensor("int64", [ids.length]),
    scales: new e.ort.Tensor("float32", [noise_scale, length_scale, noise_w]),
  };
  if (Object.keys(config.speaker_id_map ?? {}).length) feeds.sid = new e.ort.Tensor("int64", [0]);
  const out = await session.run(feeds);
  return { pcm: out.output.data as Float32Array, rate: config.audio.sample_rate as number };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/* Clips kept on the device: 16-bit sound in the clips cache, the newest 40 also in memory. */
const CLIPS = "cranoly-clips-v1";
const MAX_CLIPS = 1000;
const clipUrl = (code: string, text: string) => `https://clips.cranoly.app/${code}/${encodeURIComponent(text)}`;
const recent = new Map<string, Clip>();

function remember(key: string, clip: Clip) {
  recent.delete(key);
  recent.set(key, clip);
  if (recent.size > 40) recent.delete(recent.keys().next().value!);
}

async function readClip(code: string, text: string): Promise<Clip | null> {
  try {
    const hit = await (await caches.open(CLIPS)).match(clipUrl(code, text));
    if (!hit) return null;
    const samples = new Int16Array(await hit.arrayBuffer());
    const pcm = new Float32Array(samples.length);
    for (let i = 0; i < samples.length; i++) pcm[i] = samples[i] / 32767;
    return { pcm, rate: Number(hit.headers.get("X-Rate")) || 22050 };
  } catch {
    return null;
  }
}

let stored = 0;
async function storeClip(code: string, text: string, clip: Clip) {
  try {
    const samples = new Int16Array(clip.pcm.length);
    for (let i = 0; i < clip.pcm.length; i++) samples[i] = Math.max(-1, Math.min(1, clip.pcm[i])) * 32767;
    const cache = await caches.open(CLIPS);
    await cache.put(clipUrl(code, text), new Response(samples.buffer, { headers: { "Content-Type": "application/octet-stream", "X-Rate": String(clip.rate) } }));
    // Now and then, drop the oldest clips beyond the limit.
    if (++stored % 50 === 0) {
      const keys = await cache.keys();
      await Promise.all(keys.slice(0, Math.max(0, keys.length - MAX_CLIPS)).map((k) => cache.delete(k)));
    }
  } catch {
    /* storage full or unavailable: the clip just isn't kept */
  }
}

async function forgetClips(code: string) {
  try {
    const cache = await caches.open(CLIPS);
    const prefix = clipUrl(code, "");
    await Promise.all((await cache.keys()).filter((k) => k.url.startsWith(prefix)).map((k) => cache.delete(k)));
  } catch {
    /* nothing kept */
  }
  for (const key of [...recent.keys()]) if (key.startsWith(`${code}|`)) recent.delete(key);
}

/* One clip is made at a time. A tap goes before the words being prepared in the background. */
interface Job {
  text: string;
  lang: Language;
  promise: Promise<Clip>;
  resolve: (clip: Clip) => void;
  reject: (e: Error) => void;
}
const waiting: { now: Job[]; later: Job[] } = { now: [], later: [] };
const making = new Map<string, Job>();
let busy = false;

async function make(job: Job) {
  try {
    const data = await inWorker("say", job.lang, job.text).catch(async () => {
      // The worker couldn't make it (or can't run here): make it on the page, and keep doing so if that works.
      const clip = await synthesizeHere(job.text, job.lang);
      if (!workerBroken) {
        workerBroken = true;
        stopWorker();
      }
      return clip;
    });
    const clip = { pcm: data.pcm as Float32Array, rate: data.rate as number };
    remember(`${job.lang.code}|${job.text}`, clip);
    void storeClip(job.lang.code, job.text, clip);
    job.resolve(clip);
  } catch (e) {
    job.reject(e as Error);
  }
}

function pump() {
  if (busy) return;
  const job = waiting.now.shift() ?? waiting.later.shift();
  if (!job) return;
  busy = true;
  void make(job).finally(() => {
    making.delete(`${job.lang.code}|${job.text}`);
    busy = false;
    pump();
  });
}

/** The clip for a text: from memory, from the device, or made now ("now" goes ahead of "later"). */
async function clipFor(text: string, lang: Language, when: "now" | "later"): Promise<Clip> {
  const key = `${lang.code}|${text}`;
  const hot = recent.get(key);
  if (hot) return hot;
  const queued = making.get(key);
  if (queued) {
    // Already on its way. A tap moves it to the front.
    if (when === "now" && waiting.later.includes(queued)) {
      waiting.later.splice(waiting.later.indexOf(queued), 1);
      waiting.now.push(queued);
    }
    return queued.promise;
  }
  const kept = await readClip(lang.code, text);
  if (kept) {
    remember(key, kept);
    return kept;
  }
  const again = making.get(key);
  if (again) return again.promise;
  let resolve!: (clip: Clip) => void;
  let reject!: (e: Error) => void;
  const promise = new Promise<Clip>((res, rej) => ((resolve = res), (reject = rej)));
  const job: Job = { text, lang, promise, resolve, reject };
  making.set(key, job);
  waiting[when].push(job);
  pump();
  return promise;
}

/** Whether this language's voice is loaded and speaks without a wait. */
const isWarm = (code: string) => warmCode === code || loaded?.code === code;

/** Load the engine and this language's voice in the background, so the first tap doesn't wait. */
function warmVoice(code: string) {
  const lang = languageOf(code);
  if (!lang.model || !voiceReady(code) || isWarm(code) || workerBroken) return;
  void inWorker("warm", lang).catch(() => {});
}

/** Warm the voices for these languages while a screen with speaker buttons is open. */
export function useVoiceWarmup(...codes: (string | null | undefined)[]) {
  const voices = useVoices();
  const key = codes.filter((c): c is string => !!c && voices[c]?.status === "ready").join(",");
  useEffect(() => {
    if (key) key.split(",").forEach(warmVoice);
  }, [key]);
}

/** Make clips ahead of time (the words on screen, the next card), so tapping them plays at once. */
export function prepareSpeech(texts: Array<string | undefined>, code: string, when: "now" | "later" = "later") {
  const lang = languageOf(code);
  if (!lang.model || !voiceReady(code)) return;
  for (const text of texts) {
    const words = text && speakable(text);
    if (words) void clipFor(words, lang, when).catch(() => {});
  }
}

let audio: AudioContext | null = null;
let playing: AudioBufferSourceNode | null = null;

/** Call inside the tap handler, before anything async: browsers only allow sound after a tap. */
export function unlockAudio() {
  audio ??= new AudioContext();
  if (audio.state === "suspended") void audio.resume();
}

function play(clip: Clip) {
  unlockAudio();
  const ctx = audio!;
  const buffer = ctx.createBuffer(1, clip.pcm.length, clip.rate);
  buffer.copyToChannel(clip.pcm as Float32Array<ArrayBuffer>, 0);
  playing?.stop();
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.connect(ctx.destination);
  src.start();
  playing = src;
}

/**
 * Speak with the downloaded voice for this language. Rejects if it isn't downloaded. While the engine
 * is still starting, `onCold` may speak another way right now (the device's voice): if it returns true,
 * this clip is only prepared for next time instead of played.
 */
export async function speakNatural(text: string, code: string, onCold?: () => boolean) {
  const lang = languageOf(code);
  if (!lang.model || !voiceReady(code)) throw new Error("no voice");
  const key = `${code}|${text}`;
  // Already being prepared doesn't mean ready: while the engine starts, the device's voice speaks now.
  if (!recent.has(key) && !isWarm(code) && onCold) {
    const kept = await readClip(code, text);
    if (kept) {
      remember(key, kept);
      return play(kept);
    }
    if (onCold()) {
      warmVoice(code);
      void clipFor(text, lang, "now").catch(() => {});
      return;
    }
  }
  play(await clipFor(text, lang, "now"));
}


/** Total size of a download for these languages, in MB, counting the engine if it's still needed. */
export function downloadSize(codes: string[]) {
  const langs = codes.map(languageOf).filter((l) => l.model && !voiceReady(l.code));
  if (!langs.length) return 0;
  const engineNeeded = !LANGUAGES.some((l) => voiceReady(l.code));
  return langs.reduce((n, l) => n + l.model!.mb, engineNeeded ? ENGINE_MB : 0);
}
