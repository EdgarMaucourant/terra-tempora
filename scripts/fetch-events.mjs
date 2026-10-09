// Reads the key events of every civilization from Wikidata and saves them in
// public/data/wd-events/, so the app needs no live Wikidata query: the battles,
// sieges, wars, campaigns and treaties a realm took part in or signed, the
// births and deaths of its rulers and founders, and the founding of its
// capitals. Each needs an English Wikipedia article, a date within the realm's
// years and (except wars) a place. The best-known events of each realm are
// kept, ranked by how many Wikipedia editions cover them.
//
//   node scripts/fetch-events.mjs [civ-id …]
//
// With civilization ids, only those are fetched and merged into the files.

import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";

const SPARQL = "https://query.wikidata.org/sparql";
const AGENT = "history-globe/0.1 (https://github.com/EdgarMaucourant/history-globe)";
const OUT = "public/data/wd-events";
// Kept in step with src/wikiEvents.ts.
const SHARDS = 16;
const BATCH = 6;
const PER_CIV = 24;
const PER_CIV_PEOPLE = 8;

function query(qids) {
  return `SELECT ?civ ?e ?kind ?eLabel ?desc ?date ?end ?coord ?placeLabel ?title ?links WHERE {
  VALUES ?civ { ${qids.map((q) => `wd:${q}`).join(" ")} }
  {
    { ?e wdt:P710 ?civ } UNION { ?e wdt:P1891 ?civ }
    ?e wdt:P31 ?class.
    ?class wdt:P279* ?type.
    VALUES (?type ?kind) {
      (wd:Q178561 "battle") (wd:Q188055 "siege") (wd:Q198 "war") (wd:Q831663 "war") (wd:Q131569 "treaty")
    }
    OPTIONAL { ?e wdt:P585 ?d1 }
    OPTIONAL { ?e wdt:P580 ?d2 }
    OPTIONAL { ?e wdt:P582 ?end }
    BIND(COALESCE(?d1, ?d2) AS ?date)
    OPTIONAL { ?e wdt:P625 ?c1 }
    OPTIONAL { ?e wdt:P276 ?place. ?place wdt:P625 ?c2 }
    BIND(COALESCE(?c1, ?c2) AS ?coord)
  } UNION {
    ?civ wdt:P35|wdt:P6|wdt:P112 ?e. ?e wdt:P31 wd:Q5.
    { ?e wdt:P569 ?date; wdt:P19 ?place. BIND("birth" AS ?kind) } UNION
    { ?e wdt:P570 ?date; wdt:P20 ?place. BIND("death" AS ?kind) }
    ?place wdt:P625 ?coord.
  } UNION {
    ?civ wdt:P36 ?e. ?e wdt:P571 ?date; wdt:P625 ?coord. BIND("city" AS ?kind)
  }
  ?article schema:about ?e; schema:isPartOf <https://en.wikipedia.org/>; schema:name ?title.
  ?e wikibase:sitelinks ?links.
  OPTIONAL { ?e rdfs:label ?eLabel. FILTER(LANG(?eLabel) = "en") }
  OPTIONAL { ?e schema:description ?desc. FILTER(LANG(?desc) = "en") }
  OPTIONAL { ?place rdfs:label ?placeLabel. FILTER(LANG(?placeLabel) = "en") }
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

function parse(bindings) {
  const found = new Map();
  for (const b of bindings) {
    const year = yearOf(b.date?.value);
    if (year == null) continue;
    const civ = qidOf(b.civ.value);
    const kind = b.kind.value;
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
      title: titleOf(kind, b.eLabel?.value ?? b.title.value),
      place: b.placeLabel?.value ?? "",
      lonLat: pointOf(b.coord?.value) ?? known?.lonLat ?? null,
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

async function ask(qids) {
  for (let attempt = 0; ; attempt++) {
    const response = await fetch(SPARQL, {
      method: "POST",
      headers: {
        Accept: "application/sparql-results+json",
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": AGENT,
      },
      body: new URLSearchParams({ query: query(qids) }),
    });
    if (response.ok) return (await response.json()).results.bindings;
    const retryAfter = Number(response.headers.get("retry-after")) || 0;
    // 500 is usually the 60 s timeout; the caller splits the batch.
    if (response.status === 500 || attempt >= 4) throw new Error(`Wikidata answered ${response.status}`);
    await sleep(Math.max(retryAfter * 1000, 5000 * (attempt + 1)));
  }
}

async function fetchCivs(civs) {
  try {
    return parse(await ask(civs.map((c) => c.wikidata)));
  } catch (error) {
    if (civs.length === 1) {
      console.warn(`  ${civs[0].id}: ${error.message}`);
      return new Map();
    }
    // Split a batch that timed out, so one large realm does not sink the others.
    const half = Math.ceil(civs.length / 2);
    const a = await fetchCivs(civs.slice(0, half));
    const b = await fetchCivs(civs.slice(half));
    return new Map([...a, ...b]);
  }
}

function shardOf(id) {
  let h = 0;
  for (const ch of id) h = (Math.imul(h, 31) + ch.charCodeAt(0)) >>> 0;
  return h % SHARDS;
}

const { civilizations } = JSON.parse(readFileSync("public/data/civilizations.json", "utf8"));
const only = new Set(process.argv.slice(2));
const wanted = civilizations.filter((c) => c.wikidata && (!only.size || only.has(c.id)));

mkdirSync(OUT, { recursive: true });
const shards = Array.from({ length: SHARDS }, (_, i) => {
  const file = `${OUT}/${i}.json`;
  return only.size && existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {};
});

let total = 0;
const started = Date.now();
for (let i = 0; i < wanted.length; i += BATCH) {
  const batch = wanted.slice(i, i + BATCH);
  const byQid = await fetchCivs(batch);
  for (const c of batch) {
    const events = pick(c, byQid.get(c.wikidata) ?? []);
    total += events.length;
    if (events.length) shards[shardOf(c.id)][c.id] = events;
    else delete shards[shardOf(c.id)][c.id];
  }
  console.log(`${Math.min(i + BATCH, wanted.length)}/${wanted.length} civilizations, ${total} events, ${Math.round((Date.now() - started) / 1000)} s`);
  await sleep(1000);
}

shards.forEach((s, i) => writeFileSync(`${OUT}/${i}.json`, JSON.stringify(s)));
console.log(`Saved ${total} events for ${wanted.length} civilizations in ${OUT}/.`);
