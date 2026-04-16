const CACHE_NAME = "yam-shell-v6";
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

  const destination = request.destination || "";
  const navigationRequest = request.mode === "navigate" || destination === "document";
  const networkFirst =
    navigationRequest ||
    ["script", "style", "manifest", "font"].includes(destination) ||
    /\.(?:js|css|html|webmanifest)$/i.test(new URL(request.url).pathname);

  event.respondWith(networkFirst ? networkFirstResponse(request) : cacheFirstResponse(request));
});

async function networkFirstResponse(request) {
  try {
    const response = await fetch(request);
    if (response && response.status === 200 && response.type !== "opaque") {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    return caches.match("/auth/user-login");
  }
}

async function cacheFirstResponse(request) {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }

  const response = await fetch(request);
  if (response && response.status === 200 && response.type !== "opaque") {
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, response.clone());
  }
  return response;
}
