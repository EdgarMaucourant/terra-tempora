// Builds the globe's border data from Cliopatria (CC BY 4.0).
// Input:  data-raw/cliopatria.geojson, downloaded from the Cliopatria repository
//         on the first run
// Output: public/data/index.json plus public/data/borders-*.json, one file per
//         time window, so the app only downloads the years it shows.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import polylabel from "polylabel";

// Polities shown as the featured subject; the rest of the world is context.
const FEATURED = new Set([
  "Mongol Empire",
  "Yuan Dynasty",
  "Ilkhanate",
  "Golden Horde",
  "Chagatai Khanate",
  "Northern Yuan",
  "Eastern Chagatai Khanate",
  "Mongol Khanate",
]);
// Douglas-Peucker tolerance in degrees (about 5 km at the equator).
const TOLERANCE = 0.05;
// Islands and exclaves smaller than this (km²) are dropped, except a shape's largest part.
const MIN_PART_AREA = 300;
// Target size of one window file before encoding, in coordinate pairs.
const WINDOW_POINTS = 120_000;
const MIN_WINDOW_YEARS = 25;

const KM2_PER_SQ_DEGREE = 12_364;

const SOURCE = "data-raw/cliopatria.geojson";
const SOURCE_ZIP = "https://github.com/Seshat-Global-History-Databank/cliopatria/raw/main/cliopatria.geojson.zip";

// Downloads and unzips the Cliopatria borders unless they are already here.
async function ensureSource() {
  if (existsSync(SOURCE)) return;
  console.log(`Downloading ${SOURCE_ZIP}`);
  const response = await fetch(SOURCE_ZIP);
  if (!response.ok) throw new Error(`Could not download Cliopatria (${response.status})`);
  mkdirSync("data-raw/unzipped", { recursive: true });
  writeFileSync("data-raw/cliopatria.geojson.zip", Buffer.from(await response.arrayBuffer()));
  execFileSync("unzip", ["-o", "-q", "data-raw/cliopatria.geojson.zip", "-d", "data-raw/unzipped"]);
  // The file inside is named after the release, e.g. cliopatria_polities_only_v021.geojson.
  const inside = readdirSync("data-raw/unzipped").find((name) => name.endsWith(".geojson"));
  if (!inside) throw new Error("The Cliopatria download has no .geojson file in it");
  renameSync(`data-raw/unzipped/${inside}`, SOURCE);
  rmSync("data-raw/unzipped", { recursive: true });
  rmSync("data-raw/cliopatria.geojson.zip");
}

// Approximate ring area in km², corrected for latitude.
function ringArea(ring) {
  let sum = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[i + 1];
    sum += (x2 - x1) * (y2 + y1) * Math.cos((((y1 + y2) / 2) * Math.PI) / 180);
  }
  return (Math.abs(sum) / 2) * KM2_PER_SQ_DEGREE;
}

function simplify(points, tolerance) {
  if (points.length < 4) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  const t2 = tolerance * tolerance;
  while (stack.length) {
    const [a, b] = stack.pop();
    const [ax, ay] = points[a];
    const [bx, by] = points[b];
    const dx = bx - ax;
    const dy = by - ay;
    const len = dx * dx + dy * dy;
    let best = -1;
    let index = -1;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = points[i];
      const t = len === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len));
      const qx = ax + t * dx - px;
      const qy = ay + t * dy - py;
      const d = qx * qx + qy * qy;
      if (d > best) {
        best = d;
        index = i;
      }
    }
    if (best > t2) {
      keep[index] = 1;
      stack.push([a, index], [index, b]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

// Area-weighted centroid of a ring (planar, in degrees).
function ringCentroid(ring) {
  let a = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[i + 1];
    const f = x1 * y2 - x2 * y1;
    a += f;
    cx += (x1 + x2) * f;
    cy += (y1 + y2) * f;
  }
  return a === 0 ? null : [cx / (3 * a), cy / (3 * a)];
}

function insideRing([x, y], ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// Label at the visual centre when it falls inside the shape, otherwise at the
// point deepest inside it.
function labelPoint(ring) {
  const c = ringCentroid(ring);
  const point = c && insideRing(c, ring) ? c : polylabel([ring], 0.1);
  return point.map((v) => Math.round(v * 100) / 100);
}

// Rings are stored as integers of 0.01°, delta-encoded: [x0, y0, dx1, dy1, …].
function encodeRing(ring) {
  const out = [];
  let px = 0;
  let py = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const x = Math.round(ring[i][0] * 100);
    const y = Math.round(ring[i][1] * 100);
    if (i > 0 && x === px && y === py) continue;
    out.push(i === 0 ? x : x - px, i === 0 ? y : y - py);
    px = x;
    py = y;
  }
  return out;
}

await ensureSource();
const raw = JSON.parse(readFileSync(SOURCE, "utf8"));
const shapes = [];
const realms = {};
for (const [id, f] of raw.features.entries()) {
  const p = f.properties;
  if (p.Type !== "POLITY" || !f.geometry) continue;
  const polygons = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
  const outers = polygons.map((poly) => poly[0]).filter((ring) => ring.length >= 4);
  if (!outers.length) continue;
  const areas = outers.map(ringArea);
  const largest = areas.indexOf(Math.max(...areas));
  const rings = outers
    .filter((_, i) => i === largest || areas[i] >= MIN_PART_AREA)
    .map((ring) => simplify(ring, TOLERANCE))
    .filter((ring) => ring.length >= 4)
    .map(encodeRing)
    .filter((ring) => ring.length >= 6);
  if (!rings.length) continue;
  shapes.push({
    id,
    name: p.Name,
    from: p.FromYear,
    to: p.ToYear,
    wikipedia: p.Wikipedia || null,
    wikidata: p.Wikidata || null,
    area: Math.round(p.Area),
    featured: FEATURED.has(p.Name),
    label: labelPoint(outers[largest]),
    rings,
  });
  const span = (realms[p.Name] ??= [p.FromYear, p.ToYear]);
  span[0] = Math.min(span[0], p.FromYear);
  span[1] = Math.max(span[1], p.ToYear);
}
console.log(`${shapes.length} border shapes from ${raw.features.length} Cliopatria records`);

// Cut time into windows of roughly equal size. A shape goes into every window
// its years overlap, so one window file holds everything visible in its years.
const first = Math.min(...shapes.map((s) => s.from));
const last = Math.max(...shapes.map((s) => s.to));
const points = (s) => s.rings.reduce((n, r) => n + r.length / 2, 0);
const windows = [];
let start = first;
while (start <= last) {
  let end = start + MIN_WINDOW_YEARS - 1;
  const weight = (from, to) =>
    shapes.filter((s) => s.from <= to && s.to >= from).reduce((n, s) => n + points(s), 0);
  while (end < last && weight(start, end + MIN_WINDOW_YEARS) < WINDOW_POINTS) end += MIN_WINDOW_YEARS;
  end = Math.min(end, last);
  windows.push({ from: start, to: end });
  start = end + 1;
}

rmSync("public/data", { recursive: true, force: true });
mkdirSync("public/data", { recursive: true });
let total = 0;
for (const w of windows) {
  const inWindow = shapes.filter((s) => s.from <= w.to && s.to >= w.from);
  w.file = `borders-${w.from}-${w.to}.json`;
  w.count = inWindow.length;
  const json = JSON.stringify(inWindow);
  total += json.length;
  writeFileSync(`public/data/${w.file}`, json);
}

const featured = Object.entries(realms)
  .filter(([name]) => FEATURED.has(name))
  .map(([name, [from, to]]) => ({ name, from, to }))
  .sort((a, b) => a.from - b.from);

writeFileSync(
  "public/data/index.json",
  JSON.stringify({
    source: "Cliopatria (Seshat Global History Databank), CC BY 4.0",
    from: first,
    to: last,
    windows,
    featured,
    realms,
  }),
);
console.log(`${windows.length} window files, ${(total / 1e6).toFixed(1)} MB in all`);
