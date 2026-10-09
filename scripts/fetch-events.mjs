// Reads the key events of every civilization from Wikidata and saves them in
// public/data/wd-events/, so the app needs no live Wikidata query: the battles,
// sieges, wars, campaigns and treaties a realm took part in or signed, the
// births and deaths of its rulers and founders, and the founding of its
// capitals. Each needs an English Wikipedia article, a date within the realm's
// years and (except wars) a place. The best-known events of each realm are
// kept, ranked by how many Wikipedia editions cover them.
//
//   node scripts/fetch-events.mjs [--minutes N] [--again] [civ-id …]
//
// Civilizations already in the files are skipped, unless --again is given or
// they are named, so a run stopped by --minutes (default 50) picks up where
// it left off next time. The files are saved after every batch.

import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";

const SPARQL = "https://query.wikidata.org/sparql";
const AGENT = "history-globe/0.1 (https://github.com/EdgarMaucourant/history-globe)";
const OUT = "public/data/wd-events";
// Kept in step with src/wikiEvents.ts.
const SHARDS = 16;
const BATCH = 8;
// Queries run at once; Wikidata allows five per client.
const PARALLEL = 3;
const PER_CIV = 24;
const PER_CIV_PEOPLE = 8;

// The kinds of conflict and agreement looked for, by their Wikidata class.
// Their subclasses are listed once up front, so the per-realm queries need
// no costly subclass walk.
const TYPES = { Q178561: "battle", Q188055: "siege", Q198: "war", Q831663: "war", Q131569: "treaty" };

function classesQuery(type) {
  return `SELECT ?c WHERE { ?c wdt:P279* wd:${type} }`;
}

// Three light queries per batch of realms rather than one heavy one.
const PARTS = {
  conflicts: `
    ?e wdt:P710|wdt:P1891 ?civ; wdt:P31 ?class.
    VALUES ?class { CLASSES }
    BIND("conflict" AS ?kind)
    OPTIONAL { ?e wdt:P585 ?date }
    OPTIONAL { ?e wdt:P580 ?d2 }
    OPTIONAL { ?e wdt:P582 ?end }
    OPTIONAL { ?e wdt:P625 ?coord }
    OPTIONAL {
      ?e wdt:P276 ?place. ?place wdt:P625 ?c2.
      OPTIONAL { ?place rdfs:label ?placeLabel. FILTER(LANG(?placeLabel) = "en") }
    }`,
  people: `
    ?civ wdt:P35|wdt:P6|wdt:P112 ?e. ?e wdt:P31 wd:Q5.
    { ?e wdt:P569 ?date; wdt:P19 ?place. BIND("birth" AS ?kind) } UNION
    { ?e wdt:P570 ?date; wdt:P20 ?place. BIND("death" AS ?kind) }
    ?place wdt:P625 ?coord.
    OPTIONAL { ?place rdfs:label ?placeLabel. FILTER(LANG(?placeLabel) = "en") }`,
  capitals: `
    ?civ wdt:P36 ?e. ?e wdt:P571 ?date; wdt:P625 ?coord. BIND("city" AS ?kind)`,
};

function query(part, qids) {
  return `SELECT ?civ ?e ?kind ?class ?eLabel ?desc ?date ?d2 ?end ?coord ?c2 ?placeLabel ?title ?links WHERE {
  VALUES ?civ { ${qids.map((q) => `wd:${q}`).join(" ")} }
  ${PARTS[part].trim().replace("CLASSES", [...kindOfClass.keys()].map((c) => `wd:${c}`).join(" "))}
  ?article schema:about ?e; schema:isPartOf <https://en.wikipedia.org/>; schema:name ?title.
  ?e wikibase:sitelinks ?links.
  OPTIONAL { ?e rdfs:label ?eLabel. FILTER(LANG(?eLabel) = "en") }
  OPTIONAL { ?e schema:description ?desc. FILTER(LANG(?desc) = "en") }
}`;
}

const qidOf = (uri) => uri.slice(uri.lastIndexOf("/") + 1);

/** Wikidata dates are astronomical (0 is 1 BCE); the app has no year 0. */
function yearOf(date) {
  const m = /^(-?)(\d+)-/.exec(date ?? "");
  if (!m) return null;
  const y = Number(m[2]) * (m[1] ? -1 : 1);
  return y <= 0 ? y - 1 : y;
}

function pointOf(wkt) {
  if (!wkt || wkt.startsWith("<")) return null; // Coordinates on the Moon and so on.
  const m = /Point\(([-\d.eE]+) ([-\d.eE]+)\)/.exec(wkt);
  return m ? [Math.round(Number(m[1]) * 100) / 100, Math.round(Number(m[2]) * 100) / 100] : null;
}

// When an item matches several kinds, the most specific wins.
const RANK = { siege: 5, battle: 4, treaty: 3, war: 2, birth: 1, death: 1, city: 1 };

function titleOf(kind, label) {
  if (kind === "birth") return `Birth of ${label}`;
  if (kind === "death") return `Death of ${label}`;
  if (kind === "city") return `Founding of ${label}`;
  return label;
}

// Wikidata class → kind of event, filled in before the realms are fetched.
const kindOfClass = new Map();

function parse(bindings) {
  const found = new Map();
  for (const b of bindings) {
    const year = yearOf(b.date?.value ?? b.d2?.value);
    if (year == null) continue;
    let kind = b.kind.value;
    if (kind === "conflict") {
      kind = kindOfClass.get(qidOf(b.class.value));
      if (!kind) continue;
    }
    const civ = qidOf(b.civ.value);
    const people = kind === "birth" || kind === "death";
    const key = `${civ} ${qidOf(b.e.value)} ${people ? kind : "event"}`;
    const known = found.get(key);
    if (known && RANK[known.kind] >= RANK[kind]) continue;
    const end = yearOf(b.end?.value);
    const desc = b.desc?.value ?? "";
    found.set(key, {
      civ,
      kind,
      year,
      to: end != null && end > year ? end : undefined,
      title: titleOf(kind, b.eLabel?.value ?? b.title.value.replace(/_/g, " ")),
      place: b.placeLabel?.value ?? known?.place ?? "",
      lonLat: pointOf(b.coord?.value) ?? pointOf(b.c2?.value) ?? known?.lonLat ?? null,
      summary: desc && desc[0].toUpperCase() + desc.slice(1) + (/[.!?]$/.test(desc) ? "" : "."),
      wikipedia: b.title.value.replace(/ /g, "_"),
      links: Number(b.links.value),
    });
  }
  const byCiv = new Map();
  for (const e of found.values()) {
    if (!byCiv.has(e.civ)) byCiv.set(e.civ, []);
    byCiv.get(e.civ).push(e);
  }
  return byCiv;
}
/** The realm's best-known events within its own years. */
function pick(c, raw) {
  const inSpan = raw.filter((e) => {
    if (e.kind === "birth") return e.year >= c.from - 90 && e.year <= c.to;
    if (e.kind === "death" || e.kind === "city") return e.year >= c.from && e.year <= c.to + 1;
    return e.year >= c.from - 1 && e.year <= c.to + 1;
  });
  // A war without a place stands at the realm's heart.
  const placed = inSpan.filter((e) => e.lonLat || (e.kind === "war" && c.center));
  placed.sort((a, b) => b.links - a.links);
  const kept = [];
  let people = 0;
  for (const e of placed) {
    if (kept.length >= PER_CIV) break;
    const person = e.kind === "birth" || e.kind === "death";
    if (person && people >= PER_CIV_PEOPLE) continue;
    if (person) people++;
    // Empty fields are left out of the file.
    kept.push({
      kind: e.kind,
      year: e.year,
      to: e.to,
      title: e.title,
      place: e.place || undefined,
      lonLat: e.lonLat,
      summary: e.summary || undefined,
      wikipedia: e.wikipedia,
    });
  }
  return kept;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class Timeout extends Error {}

async function sparql(text) {
  for (let attempt = 0; ; attempt++) {
    let response;
    try {
      response = await fetch(SPARQL, {
        method: "POST",
        headers: {
          Accept: "application/sparql-results+json",
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": AGENT,
        },
        body: new URLSearchParams({ query: text }),
        signal: AbortSignal.timeout(75_000),
      });
    } catch (error) {
      if (attempt >= 2) throw error;
      await sleep(5000);
      continue;
    }
    if (response.ok) return (await response.json()).results.bindings;
    // Wikidata stops a query after 60 s and answers 500 or 504; retrying won't help.
    if ([500, 502, 504].includes(response.status)) throw new Timeout(`Wikidata answered ${response.status}`);
    if (attempt >= 4) throw new Error(`Wikidata answered ${response.status}`);
    const retryAfter = Number(response.headers.get("retry-after")) || 0;
    await sleep(Math.max(retryAfter * 1000, 5000 * (attempt + 1)));
  }
}

/** The events of these realms from one part of the query; a batch that times out is split. */
async function fetchPart(part, civs) {
  try {
    return await sparql(query(part, civs.map((c) => c.wikidata)));
  } catch (error) {
    if (civs.length === 1) {
      console.warn(`  ${civs[0].id} (${part}): ${error.message}`);
      return [];
    }
    const half = Math.ceil(civs.length / 2);
    return [...(await fetchPart(part, civs.slice(0, half))), ...(await fetchPart(part, civs.slice(half)))];
  }
}

async function fetchCivs(civs) {
  const bindings = [];
  for (const part of Object.keys(PARTS)) bindings.push(...(await fetchPart(part, civs)));
  return parse(bindings);
}

function shardOf(id) {
  let h = 0;
  for (const ch of id) h = (Math.imul(h, 31) + ch.charCodeAt(0)) >>> 0;
  return h % SHARDS;
}

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const minutesAt = args.indexOf("--minutes");
const minutes = minutesAt >= 0 ? Number(args[minutesAt + 1]) : 50;
const named = new Set(args.filter((a, i) => !a.startsWith("--") && args[i - 1] !== "--minutes"));

const { civilizations } = JSON.parse(readFileSync("public/data/civilizations.json", "utf8"));
// Realms with hand-written events (public/data/events.json) don't need these.
const curated = new Set(JSON.parse(readFileSync("public/data/events.json", "utf8")).events.flatMap((e) => e.civs));

mkdirSync(OUT, { recursive: true });
const shards = Array.from({ length: SHARDS }, (_, i) => {
  const file = `${OUT}/${i}.json`;
  return existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {};
});
const done = (c) => c.id in shards[shardOf(c.id)];
const wanted = civilizations.filter(
  (c) => c.wikidata && !curated.has(c.id) && (named.size ? named.has(c.id) : flag("--again") || !done(c)),
);
console.log(`${wanted.length} civilizations to fetch.`);

for (const [type, kind] of Object.entries(TYPES)) {
  const classes = await sparql(classesQuery(type));
  for (const b of classes) {
    const c = qidOf(b.c.value);
    const had = kindOfClass.get(c);
    if (!had || RANK[kind] > RANK[had]) kindOfClass.set(c, kind);
  }
  console.log(`${classes.length} kinds of ${kind}`);
}

const save = () => shards.forEach((s, i) => writeFileSync(`${OUT}/${i}.json`, JSON.stringify(s)));
const started = Date.now();
const deadline = started + minutes * 60_000;
let next = 0;
let fetched = 0;
let total = 0;

async function worker() {
  while (next < wanted.length && Date.now() < deadline) {
    const batch = wanted.slice(next, next + BATCH);
    next += BATCH;
    const byQid = await fetchCivs(batch);
    for (const c of batch) {
      // Realms with no events are kept too, as done.
      const events = pick(c, byQid.get(c.wikidata) ?? []);
      shards[shardOf(c.id)][c.id] = events;
      total += events.length;
    }
    fetched += batch.length;
    save();
    console.log(`${fetched}/${wanted.length} civilizations, ${total} events, ${Math.round((Date.now() - started) / 1000)} s`);
  }
}
await Promise.all(Array.from({ length: PARALLEL }, worker));

const left = civilizations.filter((c) => c.wikidata && !curated.has(c.id) && !done(c)).length;
console.log(`Saved ${total} events for ${fetched} civilizations in ${OUT}/. ${left} left for another run.`);
