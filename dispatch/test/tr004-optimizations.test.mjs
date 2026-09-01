import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, statSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function readPngSize(path) {
  const buf = readFileSync(path);
  assert.equal(buf.toString("ascii", 1, 4), "PNG");
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

test("TR-004: dispatch HTML uses TrustedRiders metadata, not starter web-chat", () => {
  const html = readFileSync(join(root, "index.html"), "utf8");

  assert.match(html, /<title>TrustedRiders Dispatch<\/title>/);
  assert.doesNotMatch(html, /web-chat/i);
  assert.doesNotMatch(html, /vite\.svg/i);
  assert.match(html, /<meta name="description" content="TrustedRiders operations dispatch console/);
  assert.match(html, /rel="icon"[^>]+href="\/favicon-32\.png"/);
  assert.match(html, /rel="apple-touch-icon"[^>]+href="\/apple-touch-icon\.png"/);
  assert.doesNotMatch(html, /unpkg\.com\/leaflet/);
});

test("O-images: tab favicon is a resized 32x32 variant, not the 144x140 source", () => {
  const favicon32 = join(root, "public/favicon-32.png");
  const favicon48 = join(root, "public/favicon-48.png");
  const source = join(root, "../assets/TR_favicon.png");

  const size32 = statSync(favicon32).size;
  const sourceSize = statSync(source).size;
  const dim32 = readPngSize(favicon32);
  const dim48 = readPngSize(favicon48);
  const dimSource = readPngSize(source);

  assert.equal(dim32.width, 32);
  assert.equal(dim32.height, 32);
  assert.equal(dim48.width, 48);
  assert.equal(dim48.height, 48);
  assert.equal(dimSource.width, 144);
  assert.equal(dimSource.height, 140);
  assert.ok(size32 < 8 * 1024, `favicon-32.png is ${size32} bytes; expected under 8KB`);
  assert.ok(size32 < sourceSize, `favicon-32.png (${size32}) must be smaller than source (${sourceSize})`);
});

test("O-loading: map lazy-load fallback is a visible loading state", () => {
  const loading = readFileSync(join(root, "src/MapLoading.tsx"), "utf8");
  const app = readFileSync(join(root, "src/App.tsx"), "utf8");

  assert.match(loading, /Loading map/);
  assert.match(loading, /role="status"/);
  assert.match(app, /lazy\(\(\) => import\("\.\/LiveMap"\)\)/);
  assert.match(app, /<Suspense fallback=\{<MapLoading \/>\}>/);
  assert.doesNotMatch(app, /import L from "leaflet"/);
});

test("Live map tiles are keyless OSM, not Carto API-key watermark tiles", () => {
  const liveMap = readFileSync(join(root, "src/LiveMap.tsx"), "utf8");
  assert.match(liveMap, /tile\.openstreetmap\.org/);
  assert.match(liveMap, /OpenStreetMap contributors/);
  assert.doesNotMatch(liveMap, /basemaps\.cartocdn\.com/);
});

test("O-bundle: Vite splits Leaflet + LiveMap off the stranger-path app chunk", () => {
  const vite = readFileSync(join(root, "vite.config.ts"), "utf8");
  assert.match(vite, /return "leaflet-map"/);
  assert.match(vite, /node_modules\/leaflet/);
});

test("O-bundle: production build emits a separate leaflet-map chunk", () => {
  execFileSync("npm", ["run", "build"], {
    cwd: root,
    stdio: "pipe",
    timeout: 120_000,
  });

  const assets = join(root, "dist/assets");
  const files = readdirSync(assets);
  const js = files.filter((name) => name.endsWith(".js"));
  const leafletChunk = js.find((name) => name.startsWith("leaflet-map-"));
  const indexChunk = js.find((name) => name.startsWith("index-"));
  const css = files.filter((name) => name.endsWith(".css"));
  const leafletCss = css.find((name) => name.startsWith("leaflet-map-"));

  assert.ok(leafletChunk, `expected leaflet-map-*.js in ${js.join(", ")}`);
  assert.ok(indexChunk, `expected index-*.js in ${js.join(", ")}`);
  assert.ok(leafletCss, `expected leaflet-map-*.css in ${css.join(", ")}`);
  assert.notEqual(leafletChunk, indexChunk);

  const leafletBytes = statSync(join(assets, leafletChunk)).size;
  const indexBytes = statSync(join(assets, indexChunk)).size;
  assert.ok(leafletBytes > 20 * 1024, `leaflet chunk too small to be Leaflet: ${leafletBytes}`);
  assert.ok(indexBytes > 0, `index chunk missing bytes`);

  const html = readFileSync(join(root, "dist/index.html"), "utf8");
  assert.match(html, /TrustedRiders Dispatch/);
  assert.match(html, /favicon-32\.png/);
  assert.match(html, /leaflet-map-/);
  assert.doesNotMatch(html, /web-chat/i);
});
