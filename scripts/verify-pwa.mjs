import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { Script, createContext } from "node:vm";
import { inflateSync } from "node:zlib";

const root = new URL("..", import.meta.url);

function pathFromRoot(path) {
  return join(root.pathname, path);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function readText(path) {
  return readFile(pathFromRoot(path), "utf8");
}

function readPngPixels(png) {
  const width = png.readUInt32BE(16);
  const height = png.readUInt32BE(20);
  const bitDepth = png[24];
  const colorType = png[25];
  const interlace = png[28];

  assert(bitDepth === 8 && colorType === 6 && interlace === 0, "PWA icons must be non-interlaced 8-bit RGBA PNGs");

  let offset = 8;
  const idatChunks = [];

  while (offset < png.length) {
    const length = png.readUInt32BE(offset);
    const type = png.toString("ascii", offset + 4, offset + 8);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;

    if (type === "IDAT") {
      idatChunks.push(png.subarray(dataStart, dataEnd));
    }

    offset = dataEnd + 4;
  }

  const inflated = inflateSync(Buffer.concat(idatChunks));
  const bytesPerPixel = 4;
  const stride = width * bytesPerPixel;
  const pixels = Buffer.alloc(stride * height);
  let sourceOffset = 0;

  function paethPredictor(left, up, upLeft) {
    const estimate = left + up - upLeft;
    const leftDistance = Math.abs(estimate - left);
    const upDistance = Math.abs(estimate - up);
    const upLeftDistance = Math.abs(estimate - upLeft);

    if (leftDistance <= upDistance && leftDistance <= upLeftDistance) {
      return left;
    }

    return upDistance <= upLeftDistance ? up : upLeft;
  }

  for (let y = 0; y < height; y += 1) {
    const filter = inflated[sourceOffset];
    sourceOffset += 1;

    for (let x = 0; x < stride; x += 1) {
      const raw = inflated[sourceOffset];
      sourceOffset += 1;
      const left = x >= bytesPerPixel ? pixels[y * stride + x - bytesPerPixel] : 0;
      const up = y > 0 ? pixels[(y - 1) * stride + x] : 0;
      const upLeft = y > 0 && x >= bytesPerPixel ? pixels[(y - 1) * stride + x - bytesPerPixel] : 0;

      let value;

      if (filter === 0) {
        value = raw;
      } else if (filter === 1) {
        value = raw + left;
      } else if (filter === 2) {
        value = raw + up;
      } else if (filter === 3) {
        value = raw + Math.floor((left + up) / 2);
      } else if (filter === 4) {
        value = raw + paethPredictor(left, up, upLeft);
      } else {
        throw new Error(`Unsupported PNG filter ${filter}`);
      }

      pixels[y * stride + x] = value & 0xff;
    }
  }

  return { height, pixels, stride, width };
}

function assertTransparentCorners(png, label) {
  const { height, pixels, stride, width } = readPngPixels(png);
  const corners = [
    [0, 0],
    [width - 1, 0],
    [0, height - 1],
    [width - 1, height - 1],
  ];

  for (const [x, y] of corners) {
    const position = y * stride + x * 4;

    assert(pixels[position + 3] === 0, `${label} PWA icon corner at ${x},${y} must be transparent`);
  }
}

function createServiceWorkerHarness(serviceWorkerSource) {
  const origin = "https://pearl.test";
  const listeners = new Map();
  const cacheStores = new Map();
  const fetchResponses = new Map();
  const state = {
    claimCalled: false,
    failFetch: false,
    skipWaitingCalled: false,
  };

  function toUrl(input) {
    const value = typeof input === "string" ? input : input.url;

    return new URL(value, origin);
  }

  function cacheKey(input, { ignoreSearch = false } = {}) {
    const url = toUrl(input);

    if (ignoreSearch) {
      url.search = "";
    }

    return url.href;
  }

  function createCache() {
    const entries = new Map();

    return {
      entries,
      async keys() {
        return [...entries.keys()].map((url) => new Request(url));
      },
      async match(request, options) {
        return entries.get(cacheKey(request, options))?.clone();
      },
      async put(request, response) {
        entries.set(cacheKey(request), response.clone());
      },
    };
  }

  const caches = {
    async delete(name) {
      return cacheStores.delete(name);
    },
    async keys() {
      return [...cacheStores.keys()];
    },
    async match(request, options) {
      for (const cache of cacheStores.values()) {
        const response = await cache.match(request, options);

        if (response) {
          return response;
        }
      }

      return undefined;
    },
    async open(name) {
      if (!cacheStores.has(name)) {
        cacheStores.set(name, createCache());
      }

      return cacheStores.get(name);
    },
  };

  function setFetchResponse(url, body, init = {}) {
    fetchResponses.set(cacheKey(url), new Response(body, { status: 200, ...init }));
  }

  async function fetchMock(request) {
    if (state.failFetch) {
      throw new Error("Network unavailable");
    }

    return fetchResponses.get(cacheKey(request))?.clone() ?? new Response("Not found", { status: 404 });
  }

  const self = {
    clients: {
      claim() {
        state.claimCalled = true;
      },
    },
    location: new URL(origin),
    skipWaiting() {
      state.skipWaitingCalled = true;
    },
    addEventListener(type, handler) {
      listeners.set(type, handler);
    },
  };

  new Script(serviceWorkerSource, { filename: "public/sw.js" }).runInContext(
    createContext({
      caches,
      fetch: fetchMock,
      Request,
      Response,
      self,
      URL,
    }),
  );

  async function dispatchExtendableEvent(type) {
    const promises = [];
    const handler = listeners.get(type);

    assert(handler, `service worker must register a ${type} handler`);
    handler({
      waitUntil(promise) {
        promises.push(promise);
      },
    });
    await Promise.all(promises);
  }

  async function dispatchFetch(request) {
    const waitUntilPromises = [];
    let responsePromise;
    const handler = listeners.get("fetch");

    assert(handler, "service worker must register a fetch handler");
    handler({
      request,
      respondWith(promise) {
        responsePromise = promise;
      },
      waitUntil(promise) {
        waitUntilPromises.push(promise);
      },
    });

    assert(responsePromise, `service worker must respond to ${request.url}`);

    const response = await responsePromise;
    await Promise.all(waitUntilPromises);

    return response;
  }

  async function cachedUrls(name) {
    const cache = await caches.open(name);

    return [...cache.entries.keys()];
  }

  return {
    cachedUrls,
    caches,
    dispatchExtendableEvent,
    dispatchFetch,
    listeners,
    origin,
    setFetchResponse,
    state,
  };
}

async function assertServiceWorkerBehavior(serviceWorkerSource) {
  const harness = createServiceWorkerHarness(serviceWorkerSource);
  const initialHtml = `
    <!doctype html>
    <link rel="manifest" href="/manifest.webmanifest">
    <link rel="icon" href="/assets/favicon-built.svg">
    <script type="module" src="/assets/index-built.js"></script>
    <script src="https://cdn.example/ignored.js"></script>
  `;

  harness.setFetchResponse("/index.html", initialHtml, { headers: { "content-type": "text/html" } });
  harness.setFetchResponse("/manifest.webmanifest", "{}");
  harness.setFetchResponse("/pwa-icon-192.png", "192");
  harness.setFetchResponse("/pwa-icon-512.png", "512");
  harness.setFetchResponse("/assets/favicon-built.svg", "<svg></svg>");
  harness.setFetchResponse("/assets/index-built.js", "console.log('built')");

  assert(harness.listeners.has("install"), "service worker must register an install handler");
  assert(harness.listeners.has("activate"), "service worker must register an activate handler");
  assert(harness.listeners.has("fetch"), "service worker must register a fetch handler");

  await harness.dispatchExtendableEvent("install");

  assert(harness.state.skipWaitingCalled, "service worker install must call skipWaiting");

  const installedUrls = await harness.cachedUrls("pearl-pwa");

  for (const path of [
    "/",
    "/index.html",
    "/manifest.webmanifest",
    "/pwa-icon-192.png",
    "/pwa-icon-512.png",
    "/assets/favicon-built.svg",
    "/assets/index-built.js",
  ]) {
    assert(installedUrls.includes(`${harness.origin}${path}`), `service worker install must cache ${path}`);
  }

  assert(
    installedUrls.every((url) => !url.startsWith("https://cdn.example")),
    "service worker install must only cache same-origin HTML-linked assets",
  );

  const refreshedHtml = `
    <!doctype html>
    <script type="module" src="/assets/index-refreshed.js"></script>
  `;

  harness.setFetchResponse("/", refreshedHtml, { headers: { "content-type": "text/html" } });
  harness.setFetchResponse("/assets/index-refreshed.js", "console.log('refreshed')");

  const navigationResponse = await harness.dispatchFetch({
    method: "GET",
    mode: "navigate",
    url: `${harness.origin}/`,
  });
  const refreshedUrls = await harness.cachedUrls("pearl-pwa");

  assert(navigationResponse.ok, "service worker navigation refresh must return the network response");
  assert(
    refreshedUrls.includes(`${harness.origin}/assets/index-refreshed.js`),
    "service worker navigation refresh must cache newly linked app-shell assets",
  );

  harness.state.failFetch = true;

  const fallbackResponse = await harness.dispatchFetch({
    method: "GET",
    mode: "navigate",
    url: `${harness.origin}/settings`,
  });
  const fallbackHtml = await fallbackResponse.text();

  assert(
    fallbackHtml.includes("/assets/index-refreshed.js"),
    "service worker navigation fallback must serve cached /index.html",
  );

  harness.state.failFetch = false;
  harness.setFetchResponse("/runtime.txt", "runtime");

  const runtimeResponse = await harness.dispatchFetch({
    method: "GET",
    mode: "same-origin",
    url: `${harness.origin}/runtime.txt`,
  });
  const runtimeUrls = await harness.cachedUrls("pearl-pwa");

  assert(runtimeResponse.ok, "service worker must return successful same-origin runtime asset responses");
  assert(
    runtimeUrls.includes(`${harness.origin}/runtime.txt`),
    "service worker must runtime-cache successful same-origin GET assets",
  );

  await harness.caches.open("pearl-pwa-v2");
  await harness.dispatchExtendableEvent("activate");

  const cacheNames = await harness.caches.keys();

  assert(harness.state.claimCalled, "service worker activate must claim clients");
  assert(!cacheNames.includes("pearl-pwa-v2"), "service worker activate must delete old pearl-pwa-* caches");
}

const indexHtml = await readText("index.html");

assert(
  indexHtml.includes('<link rel="manifest" href="/manifest.webmanifest"'),
  "index.html must link the root-scoped web app manifest",
);
assert(
  indexHtml.includes('<meta name="theme-color" content="#050506"'),
  "index.html must declare the PWA theme color",
);
assert(
  indexHtml.includes("<style>") && indexHtml.includes("margin: 0;") && indexHtml.includes("canvas"),
  "index.html must inline the tiny app shell styles so the first paint has no default body margin",
);

const manifest = JSON.parse(await readText("public/manifest.webmanifest"));

assert(manifest.name === "Pearl", "manifest name must be Pearl");
assert(manifest.short_name === "Pearl", "manifest short_name must be Pearl");
assert(manifest.start_url === "/", "manifest start_url must be root scoped");
assert(manifest.scope === "/", "manifest scope must be root scoped");
assert(manifest.display === "standalone", "manifest display must be standalone");
assert(manifest.background_color === "#050506", "manifest background_color must match the app shell");
assert(manifest.theme_color === "#050506", "manifest theme_color must match the app shell");

const icons = manifest.icons ?? [];
const requiredIcons = [
  ["/pwa-icon-192.png", "192x192"],
  ["/pwa-icon-512.png", "512x512"],
];

for (const [src, sizes] of requiredIcons) {
  const icon = icons.find((candidate) => candidate.src === src);
  assert(icon, `manifest must include ${src}`);
  assert(icon.sizes === sizes, `${src} must declare ${sizes}`);
  assert(icon.type === "image/png", `${src} must declare image/png`);
  assert(icon.purpose === "any maskable", `${src} must support any maskable purpose`);
  assert(existsSync(pathFromRoot(`public${src}`)), `${src} must exist in public assets`);
}

const icon192 = await readFile(pathFromRoot("public/pwa-icon-192.png"));
const icon512 = await readFile(pathFromRoot("public/pwa-icon-512.png"));

assert(icon192.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), "192px PWA icon must be a PNG");
assert(icon512.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), "512px PWA icon must be a PNG");
assert(icon192.readUInt32BE(16) === 192 && icon192.readUInt32BE(20) === 192, "192px PNG PWA icon must be 192x192");
assert(icon512.readUInt32BE(16) === 512 && icon512.readUInt32BE(20) === 512, "512px PNG PWA icon must be 512x512");
assertTransparentCorners(icon192, "192px");
assertTransparentCorners(icon512, "512px");

const serviceWorker = await readText("public/sw.js");

assert(
  serviceWorker.includes('const CACHE_NAME = "pearl-pwa"'),
  "service worker cache name must be unversioned because reinstalling is the upgrade path",
);
assert(
  !serviceWorker.includes('"/favicon.svg"'),
  "service worker must not precache the source favicon path because Vite emits a hashed production asset",
);

await assertServiceWorkerBehavior(serviceWorker);

const registration = await readText("src/register-service-worker.ts");

assert(
  registration.includes("import.meta.env.PROD"),
  "service worker registration must only run in production",
);
assert(
  registration.includes('.register("/sw.js"') && registration.includes('updateViaCache: "none"'),
  "service worker registration must register the root-scoped /sw.js",
);
assert(
  registration.includes('"controllerchange"') && registration.includes("sessionStorage") && registration.includes("location.reload()"),
  "service worker registration must reload once when the app first becomes controlled",
);
assert(
  registration.includes("!import.meta.env.PROD") && registration.includes(".unregister()"),
  "development builds must unregister stale service workers so localhost stays online-fresh",
);

const main = await readText("src/main.ts");

assert(
  main.includes('import "./register-service-worker";'),
  "main.ts must import the service worker registration module",
);
assert(
  !main.includes('import "./styles.css";') && !indexHtml.includes('<link rel="stylesheet" href="./src/styles.css"'),
  "app shell styles must stay inline instead of being loaded from the removed source stylesheet",
);
