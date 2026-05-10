const CACHE_NAME = "pearl-pwa";
const REQUIRED_APP_SHELL = [
  "/manifest.webmanifest",
  "/pwa-icon-192.png",
  "/pwa-icon-512.png",
];

async function fetchRequired(url) {
  const response = await fetch(url, { cache: "reload" });

  if (!response.ok) {
    throw new Error(`Unable to precache ${url}: ${response.status}`);
  }

  return response;
}

async function cacheRequired(cache, url) {
  const response = await fetchRequired(url);

  await cache.put(url, response);
}

async function cacheRequiredAssets(cache, urls) {
  await Promise.all(urls.map((url) => cacheRequired(cache, url)));
}

function getSameOriginHtmlAssets(html) {
  return [...html.matchAll(/(?:src|href)=["']([^"']+)["']/g)]
    .map((match) => new URL(match[1], self.location.origin))
    .filter((url) => url.origin === self.location.origin)
    .map((url) => url.href);
}

async function cacheHtmlAssets(cache, html) {
  const assetUrls = getSameOriginHtmlAssets(html);

  await Promise.all(assetUrls.map((url) => cacheRequired(cache, url)));
}

async function cacheAppShell(cache, page) {
  const html = await page.clone().text();

  await cacheHtmlAssets(cache, html);
  await cache.put("/index.html", page.clone());
  await cache.put("/", page.clone());
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await cacheRequiredAssets(cache, REQUIRED_APP_SHELL);
      const page = await fetchRequired("/index.html");
      await cacheAppShell(cache, page);
    }),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("pearl-pwa-") && key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") {
    return;
  }

  const requestUrl = new URL(request.url);

  if (requestUrl.origin !== self.location.origin) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            event.waitUntil(caches.open(CACHE_NAME).then((cache) => cacheAppShell(cache, response.clone())));
          }

          return response;
        })
        .catch(() => caches.match("/index.html", { ignoreSearch: true })),
    );
    return;
  }

  event.respondWith(
    caches.match(request, { ignoreSearch: true }).then((cached) => {
      if (cached) {
        return cached;
      }

      return fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }

        return response;
      });
    }),
  );
});
