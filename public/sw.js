// Cranoly service worker: makes the installed app work offline.
// Hashed build assets are cached forever; pages are network-first with a cached fallback.
const CACHE = "cranoly-v6";
const SHELL = ["/", "/notes", "/search", "/mind-map", "/dictionary", "/formatting", "/flashcards", "/flashcards/study", "/settings", "/manifest.webmanifest", "/icon.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => Promise.allSettled(SHELL.map((url) => cache.add(url))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      // Only old copies of the app itself. Downloaded voices ("cranoly-voices-…") and scan languages stay.
      .then((keys) => Promise.all(keys.filter((k) => /^(graphite|cranoly)-v\d+$/.test(k) && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function cacheFirst(request) {
  const hit = await caches.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok) (await caches.open(CACHE)).put(request, response.clone());
  return response;
}

async function networkFirst(request, fallbackUrl) {
  try {
    const response = await fetch(request);
    if (response.ok) (await caches.open(CACHE)).put(request, response.clone());
    return response;
  } catch (error) {
    const hit =
      (await caches.match(request, { ignoreSearch: true })) ?? (fallbackUrl && (await caches.match(fallbackUrl)));
    if (hit) return hit;
    throw error;
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  // Hashed build files, icons and the word dictionaries (versioned by ?v=) never change at the same address.
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/") || url.pathname.startsWith("/dict/")) {
    event.respondWith(cacheFirst(request));
  } else if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, "/"));
  } else {
    event.respondWith(networkFirst(request));
  }
});
