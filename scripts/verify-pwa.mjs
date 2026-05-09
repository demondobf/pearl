import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
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

const indexHtml = await readText("index.html");

assert(
  indexHtml.includes('<link rel="manifest" href="/manifest.webmanifest"'),
  "index.html must link the root-scoped web app manifest",
);
assert(
  indexHtml.includes('<meta name="theme-color" content="#050506"'),
  "index.html must declare the PWA theme color",
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

for (const asset of [
  '"/"',
  '"/index.html"',
  '"/manifest.webmanifest"',
  '"/favicon.svg"',
  '"/pwa-icon-192.png"',
  '"/pwa-icon-512.png"',
]) {
  assert(serviceWorker.includes(asset), `service worker must precache ${asset}`);
}

assert(
  serviceWorker.includes("matchAll") && serviceWorker.includes("src|href"),
  "service worker must discover Vite hashed src/href assets from built HTML",
);
assert(
  serviceWorker.includes('request.mode === "navigate"'),
  "service worker must handle navigation fallback",
);
assert(
  serviceWorker.includes("self.clients.claim()"),
  "service worker must claim clients on activation",
);

const registration = await readText("src/register-service-worker.ts");

assert(
  registration.includes("import.meta.env.PROD"),
  "service worker registration must only run in production",
);
assert(
  registration.includes('navigator.serviceWorker.register("/sw.js")'),
  "service worker registration must register the root-scoped /sw.js",
);

const main = await readText("src/main.ts");

assert(
  main.includes('import "./register-service-worker";'),
  "main.ts must import the service worker registration module",
);
