// Builds the globe's border data from the rebuilt borders in borders/ (see
// borders/README.md), and from nothing else.
// Input:  Natural Earth 1:10m provinces (public domain), downloaded into
//         data-raw/ on the first run: the pieces every map is made of;
//         borders/2026.json, who owns each piece today; borders/cuts.geojson,
//         pieces cut along an older line; borders/families/*.json, each
//         country's changes walked back from 2026; borders/realms.json, the
//         realms' names and links.
// Output: public/data/index.json plus public/data/borders-*.json, one file per
//         time window (format: scripts/border-files.mjs).
//
// A year shows the map as it stood on 31 December of that year. Land no
// family has reviewed for a year is drawn as "not yet reviewed".
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import polygonClipping from "polygon-clipping";
import polylabel from "polylabel";
import { topology } from "topojson-server";
import { presimplify, simplify } from "topojson-simplify";
import { merge } from "topojson-client";
import { coarsen, writeWindow } from "./border-files.mjs";

const PIECES_FILE = "data-raw/ne_10m_admin_1_states_provinces.geojson";
const PIECES_URL =
  "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_1_states_provinces.geojson";
const OUT = "public/data";
// The year today's map stands for, and the first year of the timeline.
const TODAY = 2026;
const FIRST_YEAR = -3400;
// Visvalingam area below which a point is dropped, in square degrees: about
// the detail of a 5 km tolerance.
const MIN_WEIGHT = 0.0004;
// Parts of a shape smaller than this (km²) are dropped, unless the shape has
// nothing larger (Macau, Gibraltar, small island states).
const MIN_PART_AREA = 20;

const read = (path) => JSON.parse(readFileSync(path, "utf8"));
const today = read("borders/2026.json");
const realms = read("borders/realms.json");
const cuts = read("borders/cuts.geojson");
const families = readdirSync("borders/families")
  .filter((f) => f.endsWith(".json"))
  .sort()
  .map((f) => ({ file: f, ...read(`borders/families/${f}`) }));

async function ensurePieces() {
  if (existsSync(PIECES_FILE)) return;
  console.log(`Downloading ${PIECES_URL}`);
  const response = await fetch(PIECES_URL);
  if (!response.ok) throw new Error(`Could not download Natural Earth (${response.status})`);
  mkdirSync("data-raw", { recursive: true });
  writeFileSync(PIECES_FILE, Buffer.from(await response.arrayBuffer()));
}

// ---------------------------------------------------------------- geometry

const R = 6371;
const RAD = Math.PI / 180;
/** Area of a closed ring in km², on the sphere. */
function sphereArea(ring) {
  let sum = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[i + 1];
    sum += (x2 - x1) * RAD * (Math.sin(y1 * RAD) + Math.sin(y2 * RAD));
  }
  return (Math.abs(sum) / 2) * R * R;
}

const polygonsOf = (g) => (g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : []);

/** Rings stored as integers of 0.01°, delta-encoded: [x0, y0, dx1, dy1, …]. */
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

function labelPoint(ring) {
  return polylabel([ring], 0.05).map((v) => Math.round(v * 100) / 100);
}

// ---------------------------------------------------------------- pieces

await ensurePieces();
const provinces = read(PIECES_FILE).features;

/** Every piece of land: a Natural Earth province, or a part cut out of one. */
const pieces = new Map();
for (const f of provinces) {
  const p = f.properties;
  pieces.set(p.adm1_code, { id: p.adm1_code, unit: p.adm0_a3, ground: p.gu_a3, name: p.name, geometry: f.geometry });
}
for (const cut of cuts.features) {
  const from = pieces.get(cut.properties.from);
  if (!from) throw new Error(`cuts.geojson: no piece ${cut.properties.from}`);
  const outline = polygonsOf(cut.geometry);
  const inside = orient(polygonClipping.intersection(polygonsOf(from.geometry), outline));
  const outside = orient(polygonClipping.difference(polygonsOf(from.geometry), outline));
  pieces.set(cut.properties.id, { ...from, id: cut.properties.id, name: cut.properties.note, geometry: { type: "MultiPolygon", coordinates: inside } });
  from.geometry = { type: "MultiPolygon", coordinates: outside };
}

/**
 * Polygons wound as Natural Earth winds them (outer rings clockwise), which
 * the merging of pieces relies on; polygon-clipping winds them the other way.
 */
function orient(polygons) {
  const signed = (ring) => {
    let sum = 0;
    for (let i = 0; i < ring.length - 1; i++) sum += (ring[i + 1][0] - ring[i][0]) * (ring[i + 1][1] + ring[i][1]);
    return sum;
  };
  return polygons.map((poly) => poly.map((ring, i) => ((signed(ring) > 0) === (i === 0) ? ring : [...ring].reverse())));
}

/** The pieces a selector names: a piece id, a Natural Earth unit (PRT) or ground unit (CXR). */
function select(selector) {
  if (pieces.has(selector)) return [selector];
  const found = [...pieces.values()].filter((p) => p.unit === selector || p.ground === selector).map((p) => p.id);
  if (!found.length) throw new Error(`No piece matches "${selector}"`);
  return found;
}

// ---------------------------------------------------------------- owners

/** Today's owner of a piece: { owner, territory?, hatch? }, or null for land nobody owns. */
function todayOf(piece) {
  const own = (o) => (o === undefined ? undefined : o);
  const found = own(today.pieces[piece.id]) ?? own(today.groundUnits[piece.ground]) ?? own(today.units[piece.unit]);
  if (found === undefined) throw new Error(`2026.json: no owner for ${piece.id} (${piece.unit})`);
  return found;
}

const state = new Map([...pieces.values()].map((p) => [p.id, todayOf(p)]));

// Every change, newest first, with the pieces it names resolved.
const changes = families
  .flatMap((f) =>
    f.changes.map((c) => ({
      ...c,
      family: f.family,
      year: Number(c.date.slice(0, 4)),
      before: c.before.map((b) => ({ ...b, ids: b.pieces.flatMap(select) })),
    })),
  )
  .sort((a, b) => b.date.localeCompare(a.date));

/** The first year each piece is reviewed back to (today's map is reviewed for every piece). */
// Land nobody owns today (Antarctica, the Spratly Islands) is left out.
const reviewedFrom = new Map([...pieces.keys()].map((id) => [id, state.get(id) === null ? -Infinity : TODAY]));
for (const f of families) {
  for (const r of f.reviewed) {
    for (const id of r.pieces.flatMap(select)) reviewedFrom.set(id, Math.min(reviewedFrom.get(id), r.from));
  }
}
const firstReviewed = Math.min(...[...reviewedFrom.values()].filter(Number.isFinite));

// Problems that stop the build: a change or a former owner with no source, an owner with no realm.
const problems = [];
const knownRealm = (name, where) => {
  if (!realms[name]) problems.push(`${where}: "${name}" is not in borders/realms.json`);
};
for (const [id, s] of state) {
  if (!s) continue;
  knownRealm(s.owner, `2026.json (${id})`);
  if (s.territory) knownRealm(s.territory, `2026.json (${id})`);
  if (s.hatch) knownRealm(s.hatch.by, `2026.json (${id})`);
}
for (const c of changes) {
  const where = `${c.family} ${c.date}`;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(c.date)) problems.push(`${where}: date must be YYYY-MM-DD`);
  if (!c.what || !c.source?.title || !/^https:\/\//.test(c.source?.url ?? "")) problems.push(`${where}: needs what, and a source with a title and an https url`);
  if (!["exact", "close", "rough"].includes(c.confidence)) problems.push(`${where}: confidence must be exact, close or rough`);
  for (const b of c.before) {
    if (b.owner && (!b.source?.title || !/^https:\/\//.test(b.source?.url ?? ""))) {
      problems.push(`${where}: each "before" needs a source about the land as it was, with a title and an https url`);
    }
    if (b.owner) knownRealm(b.owner, where);
    if (b.territory) knownRealm(b.territory, where);
    if (b.hatch) knownRealm(b.hatch.by, where);
  }
}
if (problems.length) {
  for (const p of problems) console.error(p);
  process.exit(1);
}

// ---------------------------------------------------------------- years

/**
 * What each year draws, as keyed groups of pieces: a realm's own land, a
 * territory of it, land hatched by the state that holds it, or land not yet
 * reviewed. Walked back from today, undoing each year's changes.
 */
const runs = new Map(); // key -> list of { from, to, ids, meta }
function addYear(year, groups) {
  for (const [key, g] of groups) {
    const list = runs.get(key) ?? runs.set(key, []).get(key);
    const ids = [...g.ids].sort().join(",");
    const sig = `${ids}|${JSON.stringify(g.meta)}`;
    const last = list[list.length - 1];
    if (last && last.sig === sig && last.from === year + 1) last.from = year;
    else list.push({ from: year, to: year, sig, ids: [...g.ids], meta: g.meta });
  }
}

/** The change that explains a group of pieces at a year: the latest one up to it, else the next one after. */
function changeFor(ids, year) {
  const set = new Set(ids);
  // Only changes of owner or territory: a hatching beginning (Indonesia
  // invading Portuguese Timor) leaves the land's own border as it was.
  const touching = changes.filter((c) => !c.hatchOnly && c.before.some((b) => b.ids.some((id) => set.has(id))));
  return touching.find((c) => c.year <= year) ?? touching.findLast((c) => c.year > year) ?? null;
}

const baseSource = { title: "Natural Earth", url: today.source.url, what: `Borders of ${TODAY}` };
/**
 * The source of a border is about the realm drawn: after a change, the
 * change's own source (Angola, since 1975); before it, the source of what the
 * land was (Portuguese Angola, until 1975).
 */
function sourceOf(c, year, ids) {
  if (!c) return baseSource;
  const until = c.year > year;
  const set = new Set(ids);
  const from = until ? c.before.find((b) => b.ids.some((id) => set.has(id))) : c;
  return {
    title: from.source.title,
    url: from.source.url,
    ...(from.map && { map: from.map }),
    what: c.what,
    date: c.date,
    ...(until && { until: true }),
    confidence: c.confidence,
  };
}

/** A realm's name for a year, when one of its periods names it differently. */
function periodName(name, year) {
  const periods = (realms[name]?.periods ?? []).filter((p) => Number(p.from.slice(0, 4)) <= year);
  const period = periods.sort((a, b) => b.from.localeCompare(a.from))[0];
  return period && period.name !== name ? period.name : undefined;
}

// Changes that only begin or end a hatching, found by walking back once.
{
  const walk = new Map(state);
  for (const c of changes) {
    c.hatchOnly = c.before.every((b) =>
      b.ids.every((id) => {
        const after = walk.get(id);
        return after && b.owner === after.owner && (b.territory ?? null) === (after.territory ?? null);
      }),
    );
    for (const b of c.before) {
      const value = b.owner ? { owner: b.owner, ...(b.territory && { territory: b.territory }), ...(b.hatch && { hatch: b.hatch }) } : null;
      for (const id of b.ids) walk.set(id, value);
    }
  }
}

// Who held each piece, by the name shown on it (a territory's, else its
// owner's), with the years: for the history of each place of today.
const heldBy = new Map(); // piece id -> Map(name -> [from, to])

const current = new Map(state);
let pendingChanges = [...changes];
for (let year = TODAY; year >= firstReviewed; year--) {
  // Undo the changes made after 31 December of this year, newest first.
  while (pendingChanges.length && pendingChanges[0].year > year) {
    const c = pendingChanges.shift();
    for (const b of c.before) {
      const value = b.owner ? { owner: b.owner, ...(b.territory && { territory: b.territory }), ...(b.hatch && { hatch: b.hatch }) } : null;
      for (const id of b.ids) current.set(id, value);
    }
  }
  const groups = new Map();
  const add = (key, id, meta) => (groups.get(key) ?? groups.set(key, { ids: [], meta }).get(key)).ids.push(id);
  for (const [id, s] of current) {
    // Unreviewed land goes by today's country: one shape for all of it would
    // be too large for the globe to draw.
    if (reviewedFrom.get(id) > year) add(`unreviewed|${state.get(id).owner}`, id, { kind: "unreviewed" });
    else if (!s) continue;
    else {
      if (s.territory) add(`territory|${s.owner}|${s.territory}`, id, { name: s.territory, partOf: s.owner });
      else add(`realm|${s.owner}`, id, { name: s.owner });
      if (s.hatch) {
        const h = s.hatch;
        add(`hatch|${s.owner}|${h.by}|${h.since}`, id, {
          kind: "hatch",
          name: s.owner,
          by: h.by,
          since: h.since,
          note: h.note,
          source: { title: h.source.title, url: h.source.url, ...(h.map && { map: h.map }) },
        });
      }
    }
  }
  for (const [id, s] of current) {
    if (!s || reviewedFrom.get(id) > year) continue;
    const name = s.territory ?? s.owner;
    const seen = heldBy.get(id) ?? heldBy.set(id, new Map()).get(id);
    const span = seen.get(name);
    seen.set(name, span ? [year, span[1]] : [year, year]);
  }
  for (const [key, g] of groups) {
    if (g.meta.kind) continue;
    // Some territories carry their state's name on the map: "Azores (Portugal)".
    const owner = g.meta.partOf && realms[g.meta.name]?.withOwner ? periodName(g.meta.partOf, year) ?? g.meta.partOf : null;
    const display = periodName(g.meta.name, year) ?? (owner ? `${g.meta.name} (${owner})` : undefined);
    g.meta = { ...g.meta, ...(display && { display }), source: sourceOf(changeFor(g.ids, year), year, g.ids) };
    groups.set(key, g);
  }
  addYear(year, groups);
}

// ---------------------------------------------------------------- shapes

console.log(`${pieces.size} pieces, ${changes.length} changes, reviewed back to ${firstReviewed}`);
const pieceList = [...pieces.values()];
const indexOf = new Map(pieceList.map((p, i) => [p.id, i]));
let topo = topology({ pieces: { type: "GeometryCollection", geometries: pieceList.map((p) => p.geometry) } });
topo = presimplify(topo);
topo = simplify(topo, MIN_WEIGHT);

/**
 * Rings wider than BAND degrees of longitude cut into bands that wide: the
 * globe fills a very wide ring (Russia) unevenly. Only for land drawn without
 * borders, as the cuts would show as lines.
 */
const BAND = 30;
function banded(ring) {
  const xs = ring.map((p) => p[0]);
  const [x0, x1] = [Math.min(...xs), Math.max(...xs)];
  if (x1 - x0 <= BAND) return [ring];
  const out = [];
  for (let x = Math.floor(x0 / BAND) * BAND; x < x1; x += BAND) {
    const box = [[[x, -90], [x + BAND, -90], [x + BAND, 90], [x, 90], [x, -90]]];
    for (const poly of polygonClipping.intersection([ring], box)) out.push(poly[0]);
  }
  return out;
}

/** The outer rings of a group of pieces merged into one shape, small parts dropped. */
function outline(ids, { bands = false } = {}) {
  const geoms = ids.map((id) => topo.objects.pieces.geometries[indexOf.get(id)]).filter((g) => g.type);
  const merged = merge(topo, geoms);
  const outers = polygonsOf(merged)
    .map((poly) => poly[0])
    .filter((ring) => ring.length >= 4)
    .map((ring) => ({ ring, area: sphereArea(ring) }));
  if (!outers.length) return null;
  const largest = outers.reduce((a, b) => (b.area > a.area ? b : a));
  const kept = outers.filter((o) => o === largest || o.area >= Math.min(MIN_PART_AREA, largest.area));
  const rings = kept
    .flatMap((o) => (bands ? banded(o.ring) : [o.ring]))
    .map(encodeRing)
    .filter((r) => r.length >= 6);
  // A part too small to keep three points at 0.01° is drawn as a small square.
  if (!rings.length) {
    const [x, y] = largest.ring[0].map((v) => Math.round(v * 100));
    rings.push([x - 1, y - 1, 2, 0, 0, 2, -2, 0]);
  }
  // True areas, from the unsimplified pieces, sum over the group.
  return { rings, label: labelPoint(largest.ring), area: kept.reduce((s, o) => s + o.area, 0) };
}

const pieceArea = new Map(pieceList.map((p) => [p.id, polygonsOf(p.geometry).reduce((s, poly) => s + sphereArea(poly[0]), 0)]));
const shapes = [];
let nextId = 1;
const outlineCache = new Map();
for (const [key, list] of runs) {
  for (const run of list) {
    const ids = run.ids.sort();
    const cacheKey = ids.join(",");
    const m = run.meta;
    const bands = m.kind === "unreviewed";
    const cacheKey2 = `${bands}|${cacheKey}`;
    const o = outlineCache.get(cacheKey2) ?? outlineCache.set(cacheKey2, outline(ids, { bands })).get(cacheKey2);
    if (!o) continue;
    const realm = m.kind === "unreviewed" ? null : realms[m.name];
    shapes.push({
      id: nextId++,
      name: m.kind === "unreviewed" ? "" : m.name,
      from: run.from,
      to: run.to,
      wikipedia: realm?.wikipedia ?? null,
      wikidata: realm?.wikidata ?? null,
      area: Math.round(ids.reduce((s, id) => s + pieceArea.get(id), 0)),
      ...(m.partOf && { partOf: m.partOf }),
      ...(m.display && { display: m.display }),
      ...(m.kind && { kind: m.kind }),
      ...(m.by && { by: m.by, since: m.since, note: m.note }),
      ...(m.source && { source: m.source }),
      label: o.label,
      rings: o.rings,
    });
  }
}
// Before the first reviewed year, all land is not yet reviewed, drawn by today's country.
const landByOwner = new Map();
for (const [id, s] of state) if (s) (landByOwner.get(s.owner) ?? landByOwner.set(s.owner, []).get(s.owner)).push(id);
for (const ids of landByOwner.values()) {
  const o = outline(ids.sort(), { bands: true });
  if (!o) continue;
  shapes.push({
    id: nextId++,
    name: "",
    from: FIRST_YEAR,
    to: firstReviewed - 1,
    wikipedia: null,
    wikidata: null,
    area: 0,
    kind: "unreviewed",
    label: null,
    rings: o.rings,
  });
}

// ---------------------------------------------------------------- windows

for (const f of readdirSync(OUT)) if (/^borders-.*\.json$/.test(f)) rmSync(`${OUT}/${f}`);
// Today on its own (every country is drawn), the reviewed years before it, and
// the years before any review (all land not yet reviewed).
const WINDOWS = [
  { from: FIRST_YEAR, to: firstReviewed - 1 },
  { from: firstReviewed, to: TODAY - 1 },
  { from: TODAY, to: TODAY },
];
const windows = [];
for (const w of WINDOWS) {
  const inside = shapes.filter((s) => s.from <= w.to && s.to >= w.from);
  if (!inside.length) continue;
  const full = writeWindow(OUT, w, inside);
  const coarse = writeWindow(OUT, w, coarsen(inside), "coarse");
  windows.push({ ...w, file: full.file, coarse: coarse.file, count: inside.length });
  console.log(`${w.from}..${w.to}: ${inside.length} shapes, ${(full.size / 1e6).toFixed(2)} MB (coarse ${(coarse.size / 1e6).toFixed(2)} MB)`);
}

const spans = {};
for (const s of shapes) {
  if (s.kind) continue;
  const span = spans[s.name];
  spans[s.name] = span ? [Math.min(span[0], s.from), Math.max(span[1], s.to)] : [s.from, s.to];
}
// Names in French and Spanish of every realm, territory and period drawn.
const names = {};
for (const [name, r] of Object.entries(realms)) {
  names[name] = { fr: r.fr, es: r.es };
  for (const p of r.periods ?? []) if (p.name !== name) names[p.name] = { fr: p.fr ?? p.name, es: p.es ?? p.name };
}
// "Azores (Portugal)", in French and Spanish too.
for (const s of shapes) {
  if (!s.display || names[s.display] || !s.partOf) continue;
  const own = realms[s.name];
  const owner = names[s.display.slice(s.name.length + 2, -1)] ?? {};
  names[s.display] = { fr: `${own?.fr ?? s.name} (${owner.fr ?? s.partOf})`, es: `${own?.es ?? s.name} (${owner.es ?? s.partOf})` };
}
// Every place of today (a country, or a territory such as Macau) with the
// realms and territories that held its land, oldest first.
const places = {};
for (const [id, s] of state) {
  if (!s) continue;
  const place = s.territory ?? s.owner;
  const spans = places[place] ?? (places[place] = {});
  for (const [name, [from, to]] of heldBy.get(id) ?? []) {
    const span = spans[name];
    spans[name] = span ? [Math.min(span[0], from), Math.max(span[1], to)] : [from, to];
  }
}
for (const [place, spans] of Object.entries(places)) {
  places[place] = Object.entries(spans)
    .sort((a, b) => a[1][0] - b[1][0] || a[1][1] - b[1][1])
    .map(([name, [from, to]]) => ({ name, from, to }));
}

writeFileSync(
  `${OUT}/index.json`,
  JSON.stringify({
    source: "Natural Earth (public domain), reassigned year by year from the sources each change names",
    credits: [
      {
        realms: "Every border: today's provinces and countries, regrouped by owner for each year",
        title: today.source.title,
        author: "Natural Earth",
        url: today.source.url,
        license: today.source.license,
      },
    ],
    from: FIRST_YEAR,
    to: TODAY,
    reviewedFrom: firstReviewed,
    windows,
    realms: spans,
    names,
    notCountries: Object.keys(realms).filter((n) => realms[n].notACountry),
    places,
  }),
);
console.log(`${shapes.length} shapes in ${windows.length} windows`);
