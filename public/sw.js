const CACHE_NAME = "yam-shell-v5";
const PRECACHE = [
  "/",
  "/auth",
  "/auth/user-login",
  "/auth/user-register",
  "/auth/admin-login",
  "/auth/admin-register",
  "/app",
  "/install",
  "/privacy",
  "/styles.css",
  "/site.js",
  "/auth.js",
  "/app.js",
  "/admin.js",
  "/api-client.js",
  "/analytics.js",
  "/charts.js",
  "/version-check.js",
  "/generated-version.js",
  "/pwa.js",
  "/storage.js",
  "/quotes.js",
  "/manifest.webmanifest",
  "/assets/icon/yam-icon-192.png",
  "/assets/icon/yam-icon-512.png",
  "/assets/icon/yam-apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") {
    return;
  }

  if (request.url.includes("/api/")) {
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) {
        return cached;
      }

      return fetch(request)
        .then((response) => {
          if (!response || response.status !== 200 || response.type === "opaque") {
            return response;
          }

          const nextResponse = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, nextResponse));
          return response;
        })
        .catch(() => caches.match("/"));
    })
  );
});
