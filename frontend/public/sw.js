// Minimal service worker: exists mainly to satisfy PWA installability
// (Chrome/Android "Add to Home Screen" long-press-for-shortcuts flow) and
// give a basic offline fallback. Not a full offline-first cache — static
// export content changes on every deploy, so we cache-then-network rather
// than cache-first to avoid serving stale pages/admin bundles.
const CACHE = "costaebella-shell-v1";
const SHELL = ["/", "/offline.html"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(
        () =>
          caches.match(event.request).then((cached) => cached ?? caches.match("/offline.html")),
      ),
  );
});
