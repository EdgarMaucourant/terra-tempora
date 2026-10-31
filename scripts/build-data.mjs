// Builds the globe's border data from Cliopatria (CC BY 4.0).
// Input:  data-raw/cliopatria.geojson, downloaded from the Cliopatria repository
//         on the first run, and scripts/border-overrides/*.geojson, hand-traced
//         borders that replace Cliopatria's for the realms and years they cover
// Output: public/data/index.json plus public/data/borders-*.json, one file per
//         time window, so the app only downloads the years it shows (format:
//         scripts/border-files.mjs).
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import polygonClipping from "polygon-clipping";
import polylabel from "polylabel";
import { coarsen, simplify, writeWindow } from "./border-files.mjs";

// Douglas-Peucker tolerance in degrees (about 5 km at the equator).
const TOLERANCE = 0.05;
// Islands and exclaves smaller than this (km²) are dropped, except a shape's largest part.
const MIN_PART_AREA = 300;
// Target size of one window file before encoding, in coordinate pairs.
const WINDOW_POINTS = 120_000;
const MIN_WINDOW_YEARS = 25;

const KM2_PER_SQ_DEGREE = 12_364;

const SOURCE = "data-raw/cliopatria.geojson";
const OVERRIDES = "scripts/border-overrides";
const SOURCE_ZIP = "https://github.com/Seshat-Global-History-Databank/cliopatria/raw/main/cliopatria.geojson.zip";
// Wikipedia articles and Wikidata items Cliopatria gets wrong, by realm name
// without parentheses: Great Yuan is Dayuan in Fergana, not the Yuan dynasty.
const LINK_FIXES = JSON.parse(readFileSync("scripts/link-fixes.json", "utf8"));
// Land Cliopatria gives the wrong realm, moved to the right one (see below).
const PART_MOVES = JSON.parse(readFileSync("scripts/part-moves.json", "utf8"));

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

// One Cliopatria-style feature as a display shape, or null when nothing is left
// of it after dropping specks.
function toShape(id, p, geometry) {
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  const outers = polygons.map((poly) => poly[0]).filter((ring) => ring.length >= 4);
  if (!outers.length) return null;
  const areas = outers.map(ringArea);
  const largest = areas.indexOf(Math.max(...areas));
  const rings = outers
    .filter((_, i) => i === largest || areas[i] >= MIN_PART_AREA)
    .map((ring) => simplify(ring, TOLERANCE))
    .filter((ring) => ring.length >= 4)
    .map(encodeRing)
    .filter((ring) => ring.length >= 6);
  if (!rings.length) return null;
  return {
    id,
    name: p.Name,
    from: p.FromYear,
    to: p.ToYear,
    wikipedia: p.Wikipedia || null,
    wikidata: p.Wikidata || null,
    ...LINK_FIXES[p.Name.replace(/^\((.*)\)$/, "$1")],
    area: Math.round(p.Area ?? areas.reduce((a, b) => a + b, 0)),
    label: labelPoint(outers[largest]),
    rings,
    // Group records (see "Groups" below), dropped before writing.
    ...(p.Components && { members: p.Components.split(";") }),
    ...(p.MemberOf && { memberOf: p.MemberOf.split(";") }),
  };
}

// Years [from, to] minus the years in `cut`, as zero, one or two ranges.
function cutYears([from, to], [cutFrom, cutTo]) {
  if (cutTo < from || cutFrom > to) return [[from, to]];
  const left = cutFrom > from ? [[from, cutFrom - 1]] : [];
  const right = cutTo < to ? [[cutTo + 1, to]] : [];
  return [...left, ...right];
}

// An encoded ring back to closed [lon, lat] points.
function decodeRing(encoded) {
  const out = [];
  let x = 0;
  let y = 0;
  for (let i = 0; i < encoded.length; i += 2) {
    x += encoded[i];
    y += encoded[i + 1];
    out.push([x / 100, y / 100]);
  }
  out.push(out[0]);
  return out;
}

// A display shape with the area of `geometry` taken out, or null when nothing
// is left. Holes are not kept: shapes only have outer rings.
function clipShape(shape, geometry) {
  const polygons = shape.rings.map((ring) => [decodeRing(ring)]);
  const cutter = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  const outers = polygonClipping.difference(polygons, cutter).map((poly) => poly[0]);
  if (!outers.length) return null;
  const areas = outers.map(ringArea);
  const largest = areas.indexOf(Math.max(...areas));
  const rings = outers
    .filter((_, i) => i === largest || areas[i] >= MIN_PART_AREA)
    .map(encodeRing)
    .filter((ring) => ring.length >= 6);
  if (!rings.length) return null;
  const before = shape.rings.map(decodeRing).map(ringArea).reduce((a, b) => a + b, 0);
  const after = areas.reduce((a, b) => a + b, 0);
  return { ...shape, area: Math.round((shape.area * after) / before), label: labelPoint(outers[largest]), rings };
}

await ensureSource();
const raw = JSON.parse(readFileSync(SOURCE, "utf8"));

// Parts Cliopatria gives the wrong realm in some years (scripts/part-moves.json):
// each part of `from` whose box centre is in `box` ([west, south, east, north])
// goes to `to`, in every record of `from` within `years`. Moved parts become
// records of their own, taking their share of the record's area.
for (const move of PART_MOVES) {
  const links = raw.features.find((f) => f.properties.Name === move.to)?.properties ?? {};
  const [west, south, east, north] = move.box;
  const inBox = (poly) => {
    const xs = poly[0].map(([x]) => x);
    const ys = poly[0].map(([, y]) => y);
    const [x, y] = [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
    return x >= west && x <= east && y >= south && y <= north;
  };
  let moved = 0;
  for (const f of [...raw.features]) {
    const p = f.properties;
    if (p.Name !== move.from || p.Type !== "POLITY" || !f.geometry) continue;
    if (p.FromYear < move.years[0] || p.ToYear > move.years[1]) continue;
    const polygons = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
    const away = polygons.filter(inBox);
    if (!away.length || away.length === polygons.length) continue;
    // Cliopatria's area, shared out by drawn area.
    const share =
      away.map((poly) => ringArea(poly[0])).reduce((a, b) => a + b, 0) /
      polygons.map((poly) => ringArea(poly[0])).reduce((a, b) => a + b, 0);
    const area = p.Area;
    f.geometry = { type: "MultiPolygon", coordinates: polygons.filter((poly) => !inBox(poly)) };
    if (area) p.Area = area * (1 - share);
    raw.features.push({
      type: "Feature",
      properties: {
        Name: move.to,
        FromYear: p.FromYear,
        ToYear: p.ToYear,
        Type: "POLITY",
        Wikipedia: links.Wikipedia,
        Wikidata: links.Wikidata,
        MemberOf: links.MemberOf,
        ...(area && { Area: area * share }),
      },
      geometry: { type: "MultiPolygon", coordinates: away },
    });
    moved++;
  }
  if (!moved) console.warn(`part-moves.json: nothing of ${move.from} moved to ${move.to}`);
}

let shapes = [];
for (const [id, f] of raw.features.entries()) {
  if (f.properties.Type !== "POLITY" || !f.geometry) continue;
  const shape = toShape(id, f.properties, f.geometry);
  if (shape) shapes.push(shape);
}
console.log(`${shapes.length} border shapes from ${raw.features.length} Cliopatria records`);

// Each override feature takes its realm's place for its years: Cliopatria's
// shapes of that name, and of any realm listed in its Replaces (one it
// conquered, or the dynasty it overthrew), are cut out of those years; realms
// listed in its Clips (neighbours it took land from) lose the traced area for
// those years. Then the traced shape goes in. New shapes get ids after
// Cliopatria's.
let nextId = raw.features.length;
const credits = [];
for (const file of existsSync(OVERRIDES) ? readdirSync(OVERRIDES).filter((f) => f.endsWith(".geojson")).sort() : []) {
  const overrides = JSON.parse(readFileSync(`${OVERRIDES}/${file}`, "utf8"));
  for (const f of overrides.features) {
    const p = f.properties;
    const before = shapes.find((s) => s.name === p.Name);
    const replaced = new Set([p.Name, ...(p.Replaces ?? [])]);
    shapes = shapes.flatMap((s) =>
      !replaced.has(s.name)
        ? [s]
        : cutYears([s.from, s.to], [p.FromYear, p.ToYear]).map(([from, to], i) => ({
            ...s,
            id: i === 0 ? s.id : nextId++,
            from,
            to,
          })),
    );
    const clipped = new Set(p.Clips ?? []);
    shapes = shapes.flatMap((s) => {
      if (!clipped.has(s.name) || s.to < p.FromYear || s.from > p.ToYear) return [s];
      const outside = cutYears([s.from, s.to], [p.FromYear, p.ToYear]).map(([from, to], i) => ({
        ...s,
        id: i === 0 ? s.id : nextId++,
        from,
        to,
      }));
      const inside = clipShape(
        { ...s, id: outside.length ? nextId++ : s.id, from: Math.max(s.from, p.FromYear), to: Math.min(s.to, p.ToYear) },
        f.geometry,
      );
      return inside ? [...outside, inside] : outside;
    });
    const shape = toShape(nextId++, { Wikipedia: before?.wikipedia, Wikidata: before?.wikidata, ...p }, f.geometry);
    if (shape) shapes.push(shape);
  }
  if (overrides.credit) credits.push(overrides.credit);
  console.log(`${overrides.features.length} hand-traced shapes from ${file}`);
}

const mainName = (name) => name.replace(/^\((.*)\)$/, "$1");
const boxes = new Map();
function box(s) {
  let b = boxes.get(s.id);
  if (!b) {
    b = [Infinity, -Infinity, Infinity, -Infinity];
    for (const ring of s.rings.map(decodeRing))
      for (const [x, y] of ring) {
        b[0] = Math.min(b[0], x);
        b[1] = Math.max(b[1], x);
        b[2] = Math.min(b[2], y);
        b[3] = Math.max(b[3], y);
      }
    boxes.set(s.id, b);
  }
  return b;
}
const overlaps = (a, b) => a[0] <= b[1] && b[0] <= a[1] && a[2] <= b[3] && b[2] <= a[3];

// A shape's years split wherever one of `others` starts or ends (from `start`
// on), each piece losing the land of the others that cover all its years.
// Pieces before `start` and pieces left empty are dropped from the clipping;
// the first piece keeps the shape's id.
function without(s, others, start = s.from) {
  if (!others.length) return [s];
  const cuts = new Set([start, s.to + 1]);
  for (const o of others) for (const y of [o.from, o.to + 1]) if (y > start && y <= s.to) cuts.add(y);
  const edges = [...cuts].sort((a, b) => a - b);
  const pieces = s.from < start ? [{ ...s, to: start - 1 }] : [];
  for (let i = 0; i + 1 < edges.length; i++) {
    const [from, to] = [edges[i], edges[i + 1] - 1];
    const piece = { ...s, id: pieces.length ? nextId++ : s.id, from, to };
    const inside = others.filter((o) => o.from <= from && o.to >= to);
    if (!inside.length) {
      pieces.push(piece);
      continue;
    }
    const geometry = { type: "MultiPolygon", coordinates: inside.flatMap((o) => o.rings.map((r) => [decodeRing(r)])) };
    const clipped = clipShape(piece, geometry);
    if (clipped) pieces.push(clipped);
  }
  return pieces;
}

// Groups. Cliopatria also records groups of realms, named "(Name)": an empire
// with its parts ("(Spanish Empire)" is the Kingdom of Spain, its colonies,
// called "Spanish Empire", and later the Iberian Union), or a set of states
// ("(Holy Roman Empire)", "(Warring States China)"). A group's shape is the
// union of its members' shapes, so drawing both covers the same land twice:
// hovering it gives either name, and a click picks whichever is on top. Only
// the members are drawn. Each member's shape lists the groups it belongs to in
// its years (`groups`, by main name), so the app can highlight and frame a
// group's members with it. What a group covers beyond its members is stale
// land another realm already holds (the Taifas of Iberia after the Almoravid
// conquest, the Netherlands in 1940), so it goes too.
const groupRecords = shapes.filter((s) => s.members);
const beforeGroups = shapes.length;
shapes = shapes.flatMap(({ members, memberOf, ...s }) => {
  if (members) return [];
  const groups = groupRecords.filter(
    (g) => g.to >= s.from && g.from <= s.to && (g.members.includes(s.name) || memberOf?.includes(g.name)),
  );
  if (!groups.length) return [s];
  // One piece per run of years in the same groups.
  const cuts = new Set([s.from, s.to + 1]);
  for (const g of groups) for (const y of [g.from, g.to + 1]) if (y > s.from && y <= s.to) cuts.add(y);
  const edges = [...cuts].sort((a, b) => a - b);
  const pieces = [];
  for (let i = 0; i + 1 < edges.length; i++) {
    const [from, to] = [edges[i], edges[i + 1] - 1];
    const names = [
      ...new Set(
        groups
          .filter((g) => g.from <= from && g.to >= to)
          .sort((g, h) => h.area - g.area)
          .map((g) => mainName(g.name)),
      ),
    ];
    const last = pieces.at(-1);
    if (last && String(last.groups ?? "") === String(names)) last.to = to;
    else pieces.push({ ...s, id: pieces.length ? nextId++ : s.id, from, to, ...(names.length && { groups: names }) });
  }
  return pieces;
});
// Each group's Wikipedia article and Wikidata item, the ones most of its records give.
const groupLinks = {};
for (const g of groupRecords) {
  const links = (groupLinks[mainName(g.name)] ??= { wikipedia: {}, wikidata: {} });
  for (const key of ["wikipedia", "wikidata"]) if (g[key]) links[key][g[key]] = (links[key][g[key]] ?? 0) + 1;
}
const commonest = (tally) => Object.entries(tally).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
for (const links of Object.values(groupLinks)) {
  links.wikipedia = commonest(links.wikipedia);
  links.wikidata = commonest(links.wikidata);
}
console.log(
  `${groupRecords.length} group shapes left out, ${shapes.length - beforeGroups + groupRecords.length} member shapes split by group`,
);

// Drawn area, not Cliopatria's Area, which counts a realm's other parts too.
const sizes = new Map();
const size = (s) => sizes.get(s.id) ?? sizes.set(s.id, s.rings.map(decodeRing).map(ringArea).reduce((a, b) => a + b, 0)).get(s.id);

// Twins. Now and then Cliopatria draws one realm twice under two names for a
// few years, mostly as it is renamed: Brandenburg-Prussia and the Kingdom of
// Prussia (1702-1717), the English and British colonial empires (1709-1712).
// Where two shapes cover at least TWIN_SHARE of each other in the same years,
// the realm that lasts longer keeps the land and the other is left out for
// those years. From SETTLED_FROM on, the smaller of two overlapping realms
// keeps the land instead (below): there a colony often makes most of its
// empire's shape (the Dutch East Indies of the Batavian Republic).
const TWIN_SHARE = 0.9;
const SETTLED_FROM = 1800;
const lastYear = new Map();
for (const s of shapes) lastYear.set(s.name, Math.max(lastYear.get(s.name) ?? -Infinity, s.to));
const twinCuts = new Map();
const byStart = [...shapes].sort((a, b) => a.from - b.from);
for (let i = 0; i < byStart.length; i++) {
  const a = byStart[i];
  for (let j = i + 1; j < byStart.length && byStart[j].from <= a.to; j++) {
    const b = byStart[j];
    if (b.to < a.from || b.from >= SETTLED_FROM || a.name === b.name || !overlaps(box(a), box(b))) continue;
    const ratio = size(a) / size(b);
    if (ratio < TWIN_SHARE || ratio > 1 / TWIN_SHARE) continue;
    const common = polygonClipping
      .intersection(
        a.rings.map((r) => [decodeRing(r)]),
        b.rings.map((r) => [decodeRing(r)]),
      )
      .reduce((sum, poly) => sum + ringArea(poly[0]), 0);
    if (common < TWIN_SHARE * Math.max(size(a), size(b))) continue;
    const [endA, endB] = [lastYear.get(a.name), lastYear.get(b.name)];
    const loser = endA < endB || (endA === endB && a.id < b.id) ? a : b;
    const years = [Math.max(a.from, b.from), Math.min(a.to, b.to, SETTLED_FROM - 1)];
    twinCuts.set(loser.id, [...(twinCuts.get(loser.id) ?? []), years]);
    console.log(`Twins ${years.join("-")}: ${a.name} and ${b.name}, drawn as ${(loser === a ? b : a).name}`);
  }
}
shapes = shapes.flatMap((s) => {
  let spans = [[s.from, s.to]];
  for (const cut of twinCuts.get(s.id) ?? []) spans = spans.flatMap((span) => cutYears(span, cut));
  return spans.map(([from, to], i) => ({ ...s, id: i === 0 ? s.id : nextId++, from, to }));
});

// From 1800 on, Cliopatria often keeps a colony inside its empire's shape
// after it has a shape of its own, sometimes for decades after independence
// (Algeria stays in the French Fifth Republic until 2023). Where two realms
// overlap in those years, the smaller one keeps the land: the larger loses it,
// year range by year range. Earlier overlaps (vassals, claims) are left as they are.
const smallerThan = (o, s) => size(o) < size(s) || (size(o) === size(s) && o.id > s.id);
const original = shapes;
shapes = original.flatMap((s) => {
  const start = Math.max(s.from, SETTLED_FROM);
  if (s.to < start) return [s];
  const smaller = original.filter(
    (o) => smallerThan(o, s) && o.to >= start && o.from <= s.to && o.name !== s.name && overlaps(box(o), box(s)),
  );
  return without(s, smaller, start);
});
console.log(`${shapes.length - original.length} more shapes after giving overlaps since ${SETTLED_FROM} to the smaller realm`);

const realms = {};
for (const s of shapes) {
  const span = (realms[s.name] ??= [s.from, s.to]);
  span[0] = Math.min(span[0], s.from);
  span[1] = Math.max(span[1], s.to);
}

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

// Old window files go; the other data files (civilizations, events, translations, …) stay.
mkdirSync("public/data", { recursive: true });
for (const file of readdirSync("public/data")) if (/^borders-.*\.json$/.test(file)) rmSync(`public/data/${file}`);
let total = 0;
for (const w of windows) {
  const inWindow = shapes.filter((s) => s.from <= w.to && s.to >= w.from);
  const fine = writeWindow("public/data", w, inWindow);
  const coarse = writeWindow("public/data", w, coarsen(inWindow), "coarse");
  w.file = fine.file;
  w.coarse = coarse.file;
  w.count = inWindow.length;
  total += fine.size + coarse.size;
}

writeFileSync(
  "public/data/index.json",
  JSON.stringify({
    source: "Cliopatria (Seshat Global History Databank), CC BY 4.0",
    credits,
    from: first,
    to: last,
    windows,
    realms,
    groups: groupLinks,
  }),
);
console.log(`${windows.length} window files, ${(total / 1e6).toFixed(1)} MB in all`);
