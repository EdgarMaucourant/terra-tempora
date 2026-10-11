// Builds the list of civilizations shown on the landing page from the border
// files in public/data (run `npm run data` first if they are missing).
// Output: public/data/civilizations.json, and public/data/civilization-shapes.json
//         with each one's outline, which only the landing page's cards need
//
// One civilization per Cliopatria realm name. Cliopatria writes a realm's
// overseas or subordinate parts as "(Name)"; those are folded into "Name".
import { readFileSync, writeFileSync } from "node:fs";

// Realms that belong together beyond what Wikidata records as predecessors and
// successors. Any member opens the globe with the whole family highlighted.
const FAMILIES = {
  mongol: [
    "Mongol Empire",
    "Yuan Dynasty",
    "Ilkhanate",
    "Golden Horde",
    "Chagatai Khanate",
    "Northern Yuan",
    "Eastern Chagatai Khanate",
    "Mongol Khanate",
  ],
};
// Silhouettes are drawn in a 100 × 100 box; this is the simplification
// tolerance in box units.
const SILHOUETTE_TOLERANCE = 0.9;
// Parts smaller than this share of the largest part are left out of the silhouette.
const SILHOUETTE_MIN_PART = 0.04;
const SILHOUETTE_MAX_PARTS = 8;
// Hand corrections to a civilization's years where its borders don't span its
// history, by id: [from, to].
const DATE_FIXES = JSON.parse(readFileSync("scripts/date-fixes.json", "utf8"));

const index = JSON.parse(readFileSync("public/data/index.json", "utf8"));
const shapes = new Map();
for (const w of index.windows) {
  for (const s of JSON.parse(readFileSync(`public/data/${w.file}`, "utf8"))) shapes.set(s.id, s);
}

function decodeRing(encoded) {
  const out = [];
  let x = 0;
  let y = 0;
  for (let i = 0; i < encoded.length; i += 2) {
    x += encoded[i];
    y += encoded[i + 1];
    out.push([x / 100, y / 100]);
  }
  return out;
}

function ringArea(ring) {
  let sum = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[(i + 1) % ring.length];
    sum += x1 * y2 - x2 * y1;
  }
  return Math.abs(sum) / 2;
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

// The realm's outline at its largest, projected flat (longitude scaled by the
// cosine of the middle latitude) and fitted into a 100 × 100 box. Returned as
// rings of integer [x, y, x, y, …] in that box.
function silhouette(shape) {
  let rings = shape.rings.map(decodeRing);
  // Shapes that cross the antimeridian would stretch across the whole box.
  const lons = rings.flat().map(([x]) => x);
  if (Math.max(...lons) - Math.min(...lons) > 180) {
    rings = rings.map((r) => r.map(([x, y]) => [x < 0 ? x + 360 : x, y]));
  }
  const areas = rings.map(ringArea);
  const largest = Math.max(...areas);
  rings = rings
    .map((r, i) => ({ r, a: areas[i] }))
    .filter(({ a }) => a >= largest * SILHOUETTE_MIN_PART)
    .sort((p, q) => q.a - p.a)
    .slice(0, SILHOUETTE_MAX_PARTS)
    .map(({ r }) => r);
  const all = rings.flat();
  const minY = Math.min(...all.map(([, y]) => y));
  const maxY = Math.max(...all.map(([, y]) => y));
  const k = Math.cos((((minY + maxY) / 2) * Math.PI) / 180);
  const flat = rings.map((r) => r.map(([x, y]) => [x * k, -y]));
  const fx = flat.flat().map(([x]) => x);
  const fy = flat.flat().map(([, y]) => y);
  const [x0, x1, y0, y1] = [Math.min(...fx), Math.max(...fx), Math.min(...fy), Math.max(...fy)];
  const scale = 100 / Math.max(x1 - x0, y1 - y0, 1e-6);
  const ox = (100 - (x1 - x0) * scale) / 2;
  const oy = (100 - (y1 - y0) * scale) / 2;
  return flat
    .map((r) => simplify([...r, r[0]].map(([x, y]) => [ox + (x - x0) * scale, oy + (y - y0) * scale]), SILHOUETTE_TOLERANCE))
    .filter((r) => r.length >= 4)
    .map((r) => r.slice(0, -1).flatMap(([x, y]) => [Math.round(x), Math.round(y)]));
}

const slugify = (name) =>
  name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const familyOf = new Map(Object.entries(FAMILIES).flatMap(([key, names]) => names.map((n) => [n, key])));

// Group the shapes by realm, folding "(Name)" into "Name".
const groups = new Map();
for (const s of shapes.values()) {
  const key = s.name.replace(/^\((.*)\)$/, "$1");
  let g = groups.get(key);
  if (!g) groups.set(key, (g = { name: key, names: new Set(), shapes: [] }));
  g.names.add(s.name);
  g.shapes.push(s);
}

const civilizations = [];
const outlines = {};
const slugs = new Set();
for (const g of groups.values()) {
  // The realm's own shapes, not its overseas parts, give its dates, link and silhouette.
  const own = g.shapes.filter((s) => s.name === g.name);
  const main = own.length ? own : g.shapes;
  const peak = main.reduce((best, s) => (s.area > best.area ? s : best));
  const count = (key) => {
    const tally = new Map();
    for (const s of main) if (s[key]) tally.set(s[key], (tally.get(s[key]) ?? 0) + 1);
    return [...tally].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  };
  let slug = slugify(g.name) || `realm-${peak.id}`;
  while (slugs.has(slug)) slug += "-2";
  slugs.add(slug);
  civilizations.push({
    id: slug,
    name: g.name,
    // Cliopatria names folded into this one, e.g. "(British Empire)".
    names: [...g.names].sort(),
    wikidata: count("wikidata"),
    wikipedia: count("wikipedia"),
    from: Math.min(...main.map((s) => s.from)),
    to: Math.max(...main.map((s) => s.to)),
    // The year the realm reached its largest extent, and where.
    peakYear: Math.round((peak.from + peak.to) / 2),
    area: peak.area,
    center: peak.label,
    family: familyOf.get(g.name) ?? null,
  });
  outlines[slug] = silhouette(peak);
}
for (const c of civilizations) {
  const fix = DATE_FIXES[c.id];
  if (!fix) continue;
  [c.from, c.to] = fix;
  // Opening the realm goes to its peak year, so keep that within its years.
  c.peakYear = Math.min(c.to, Math.max(c.from, c.peakYear));
}
for (const id of Object.keys(DATE_FIXES)) {
  if (!civilizations.some((c) => c.id === id)) console.warn(`date-fixes.json: no civilization "${id}"`);
}
civilizations.sort((a, b) => b.area - a.area);

const json = JSON.stringify({ source: index.source, families: FAMILIES, civilizations });
writeFileSync("public/data/civilizations.json", json);
// Outlines in the same order as the list.
const shapesJson = JSON.stringify(Object.fromEntries(civilizations.map((c) => [c.id, outlines[c.id]])));
writeFileSync("public/data/civilization-shapes.json", shapesJson);
console.log(
  `${civilizations.length} civilizations, ${(json.length / 1e3).toFixed(0)} kB, outlines ${(shapesJson.length / 1e3).toFixed(0)} kB`,
);
